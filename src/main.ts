/**
 * Language Learn Plugin — entry point.
 * All feature logic delegated to src/features/ modules.
 */

import { Plugin, WorkspaceLeaf, MarkdownRenderer, Component, Notice } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, LanguageCode } from './types';
import { setLang, i18n } from './i18n';
import { InteractionCoordinator } from './coordinator/InteractionCoordinator';
import { HoverPopoverView } from './views/HoverPopoverView';
import { AIPanelView, AI_PANEL_VIEW_TYPE } from './views/AIPanelView';
import { LanguageLearnSettingsTab } from './views/LanguageLearnSettingsTab';
import { SelectionActionBar } from './views/SelectionActionBar';
import { NotePopupView } from './views/NotePopupView';
import { registerCommands } from './commands';
import { VocabularyScanner } from './highlight/VocabularyScanner';
import { vocabularyHighlightExtension } from './highlight/VocabularyHighlighter';
import { ToolsManager } from './agent/ToolsManager';
import { InterpreterFactory } from './agent/interpreter/InterpreterFactory';

import { SelectionFlow } from './features/SelectionFlow';
import { HoverFlow } from './features/HoverFlow';
import { VocabManager } from './features/VocabManager';
import { ReinterpretFlow } from './features/ReinterpretFlow';
import { ChatHistoryManager } from './features/ChatHistoryManager';
import { RelationManager } from './agent/RelationManager';
import {
	getSelectionInfo, getWordUnderCursor, getSelectionEndCoords,
} from './features/EditorHelpers';

export default class LanguageLearnPlugin extends Plugin {
	settings!: PluginSettings;
	coordinator!: InteractionCoordinator;

	async onload(): Promise<void> {
		await this.loadSettings();

		const vault = this.app.vault;

		// ── Agent layer ──
		this.toolsManager = new ToolsManager(vault);
		const factory = new InterpreterFactory(vault, this.toolsManager);
		const interpreter = factory.create(this.settings);
		this.runToolsSelfTest();

		this.coordinator = new InteractionCoordinator(interpreter, this.settings);
		(this.coordinator as any).setSkillManager?.(factory.skillManager);

		// ── Relation manager ──
		const relationMgr = new RelationManager(vault, interpreter);
		const savedFlags = (await this.loadData())?.relationFlags || {};
		relationMgr.loadFlags(savedFlags);
		this.coordinator.setRelationManager(relationMgr);

		// ── Views ──
		const hoverView = new HoverPopoverView(this.coordinator);
		const notePopup = new NotePopupView();
		notePopup.setMarkdownRenderer(async (md, el) => {
			await MarkdownRenderer.renderMarkdown(md, el, '', this as unknown as Component);
		});
		const vocabScanner = new VocabularyScanner(vault, this.settings.wordNotesFolder, this.settings.phraseNotesFolder);

		// ── Vocab manager ──
		const vocabMgr = new VocabManager(this, this.settings, vocabScanner, this.coordinator);
		vocabMgr.init();
		this.vocabMgr = vocabMgr;
		this.registerEditorExtension(vocabularyHighlightExtension());
		await vocabMgr.scanAndHighlight();

		// ── Selection flow ──
		const selectionBar = new SelectionActionBar(async () => {});
		const selectionFlow = new SelectionFlow(
			this, this.coordinator, this.settings, selectionBar, notePopup,
			() => vocabMgr.scanAndHighlight(),
		);
		selectionFlow.init();

		// ── Hover flow ──
		const hoverFlow = new HoverFlow(
			this, this.coordinator, hoverView, notePopup, this.settings,
			() => vocabMgr.vocabTerms,
		);
		hoverFlow.init();

		// ── Reinterpret flow ──
		const reinterpretFlow = new ReinterpretFlow(
			this, this.coordinator, notePopup, hoverView,
			() => vocabMgr.vocabTerms,
			() => vocabMgr.scanAndHighlight(),
		);
		reinterpretFlow.init();

		const historyMgr = new ChatHistoryManager(vault);

		// ── Register views + settings ──
		this.registerView(AI_PANEL_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
			const view = new AIPanelView(leaf, this.coordinator, historyMgr);
			view.setMarkdownRenderer(async (md, el) => {
				await MarkdownRenderer.renderMarkdown(md, el, '', this as unknown as Component);
			});
			view.setGenerateRelationsHandler(async () => {
				await this.coordinator.generateRelationGraph(
					this.vocabMgr?.vocabTerms || [], this.settings.wordNotesFolder
				);
				await this.saveFlags();
			});
		view.setClearFlagsHandler(async () => {
			const mgr = (this.coordinator as any).relationMgr;
			if (!mgr) return;
			await mgr.clearAllLinks(
				this.vocabMgr?.vocabTerms || [],
				this.settings.wordNotesFolder
			);
			mgr.clearAllFlags(this.vocabMgr?.vocabTerms || []);
			await this.saveFlags();
			new Notice(i18n().notice.cleared);
		});
			return view;
		});
		this.addRibbonIcon('languages', '打开语言学习面板', () => this.activateView());
		this.settingsTab = new LanguageLearnSettingsTab(this.app, this.settings, this.saveSettings.bind(this));
		this.addSettingTab(this.settingsTab);

		// Commands
		this.registerCommands();

		// Progress → panel
		this.coordinator.onProgress((log) => {
			const leaves = this.app.workspace.getLeavesOfType(AI_PANEL_VIEW_TYPE);
			if (leaves.length > 0) {
				const panel = leaves[0].view as AIPanelView;
				if (log.message === 'completed') {
					panel.showCompleted();
				} else {
					panel.showProgress(log);
				}
			}
		});

		// Open file from popup
		notePopup.setOpenFileHandler((path: string) => {
			const file = vault.getAbstractFileByPath(path);
			if (file) this.app.workspace.getLeaf().openFile(file as any);
		});

		// Keep refs for onunload
		this.hoverView = hoverView;
		this.selectionBar = selectionBar;
		this.notePopup = notePopup;
	}

	onunload(): void {
		this.saveFlags();
		this.hoverView?.hide();
		this.selectionBar?.hide();
		this.notePopup?.hide();
	}

	// ── Settings ──
	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		setLang(this.settings.nativeLanguage);
	}
	async saveSettings(settings?: PluginSettings): Promise<void> {
		if (settings) this.settings = settings;
		await this.saveData(this.settings);
		this.coordinator?.updateSettings(this.settings);
		setLang(this.settings.nativeLanguage);
		(this.coordinator as any).executor?.skillManager?.updateLanguages(
			this.settings.nativeLanguage, this.settings.targetLanguage
		);
		// Push new model settings to interpreter so next AI call uses them
		const interp = (this.coordinator as any).executor;
		if (interp) {
			interp.settings = { ...this.settings };
			interp.configure(this.settings.model, this.settings.apiKey, this.settings.apiEndpoint);
		}
	}

	private async saveFlags(): Promise<void> {
		const mgr = (this.coordinator as any).relationMgr;
		if (!mgr) return;
		const data = await this.loadData() || {};
		data.relationFlags = mgr.getFlags();
		await this.saveData(data);
	}
	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(AI_PANEL_VIEW_TYPE)[0];
		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) await rightLeaf.setViewState({ type: AI_PANEL_VIEW_TYPE, active: true });
			leaf = workspace.getLeavesOfType(AI_PANEL_VIEW_TYPE)[0];
		}
		if (leaf) workspace.revealLeaf(leaf);
	}

	// ── Commands ──
	private registerCommands(): void {
		registerCommands(this, {
			coordinator: this.coordinator,
			getSelection: () => getSelectionInfo(this.app),
			getWordUnderCursor: () => getWordUnderCursor(this.app),
		refreshIndex: async () => {
			const mgr = (this.coordinator as any).relationMgr;
			if (mgr) {
				await mgr.clearAllLinks(this.vocabMgr?.vocabTerms || [], this.settings.wordNotesFolder);
				mgr.clearAllFlags(this.vocabMgr?.vocabTerms || []);
				await this.saveFlags();
			}
			await this.vocabMgr?.scanAndHighlight();
			new Notice('✓ 已重置所有关系标记');
		},
			generateRelations: async () => {
				await this.coordinator.generateRelationGraph(
					this.vocabMgr?.vocabTerms || [],
					this.settings.wordNotesFolder
				);
				await this.saveFlags();
				await this.vocabMgr?.scanAndHighlight();
			},
		});
	}

	// ── Stored refs (for onunload) ──
	private hoverView!: HoverPopoverView;
	private selectionBar!: SelectionActionBar;
	private notePopup!: NotePopupView;
	private toolsManager!: ToolsManager;
	private vocabMgr?: any;
	private settingsTab?: LanguageLearnSettingsTab;

	// ── Self-test ──
	private async runToolsSelfTest(): Promise<void> {
		const log = (...args: unknown[]) => console.log('[ToolTest]', ...args);
		const vault = this.app.vault; const tm = this.toolsManager;
		const DW = '_test_word_notes'; const DP = '_test_phrase_notes';
		try {
			log('=== 自测开始 ===');
			await tm.execute('writeWordExplanation', { dirPath: DW, word: 'test', coreMeaning: '测试', exampleSentences: ['This is a test → test 指测试'] });
			await tm.execute('writePhraseExplanation', { dirPath: DP, phrase: 'break the ice', coreMeaning: '打破沉默', wordMeanings: ['break: 打破', 'ice: 冰'] });
			log('=== 自测通过 ===');
		} catch (e) { log('=== 自测失败 ===', e); }
		try { if (vault.getAbstractFileByPath(DW)) await vault.delete(vault.getAbstractFileByPath(DW) as any, true); } catch {}
		try { if (vault.getAbstractFileByPath(DP)) await vault.delete(vault.getAbstractFileByPath(DP) as any, true); } catch {}
	}
}
