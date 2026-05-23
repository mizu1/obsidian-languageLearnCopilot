/**
 * SelectionFlow — selection → check folder → AI → popup.
 * Includes action bar and context menu registration.
 */

import { Plugin, MarkdownView } from 'obsidian';
import { Menu, Notice, TFile } from 'obsidian';
import { Context, TextType } from '../types';
import { InteractionCoordinator } from '../coordinator/InteractionCoordinator';
import { SelectionActionBar, SelectionActionCallback } from '../views/SelectionActionBar';
import { NotePopupView, parseNoteContent, ParsedNote } from '../views/NotePopupView';
import { getSelectionInfo, getSelectionEndCoords } from './EditorHelpers';

export class SelectionFlow {
	constructor(
		private plugin: Plugin,
		private coordinator: InteractionCoordinator,
		private settings: { wordNotesFolder: string; phraseNotesFolder: string },
		private selectionBar: SelectionActionBar,
		private notePopup: NotePopupView,
		private onScanNeeded: () => Promise<void>,
	) {}

	init(): void {
		const onAction: SelectionActionCallback = async (text, ctx, type) => {
			await this.handle(text, ctx, type);
		};
		this.selectionBar.setCallback(onAction);
		this.registerActionBar();
		this.registerContextMenu();
	}

	private registerActionBar(): void {
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		const showBar = () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) { this.selectionBar.hide(); return; }
				const sel = view.editor.getSelection();
				if (!sel?.trim()) { this.selectionBar.hide(); return; }
				const info = getSelectionInfo(this.plugin.app);
				if (!info || info.type === 'invalid') { this.selectionBar.hide(); return; }
				const cm = (view.editor as any).cm;
				if (!cm) return;
				const cursorTo = view.editor.getCursor('to');
				const coords = typeof cm.coordsAtPos === 'function'
					? cm.coordsAtPos(view.editor.posToOffset(cursorTo)) : null;
				if (!coords) return;
				this.selectionBar.show(coords.right, coords.top, info.text, info.context, info.type);
			}, 100);
		};
		this.plugin.registerDomEvent(document, 'mouseup', (evt: MouseEvent) => {
			if ((evt.target as HTMLElement).closest('.cm-editor')) showBar();
		});
		this.plugin.registerDomEvent(document, 'keyup', (evt: KeyboardEvent) => {
			if (evt.shiftKey && (evt.target as HTMLElement).closest('.cm-editor')) showBar();
		});
	}

	private registerContextMenu(): void {
		this.plugin.registerDomEvent(document, 'contextmenu', (evt: MouseEvent) => {
			if (!(evt.target as HTMLElement).closest('.cm-editor')) return;
			const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) return;
			const sel = view.editor.getSelection();
			if (!sel?.trim()) return;
			evt.preventDefault();
			evt.stopPropagation();
			const menu = new Menu();
			const info = getSelectionInfo(this.plugin.app);
			const label = info && (info.type === 'sentence' || info.type === 'paragraph')
				? '翻译选中文本' : '分析选中文本';
			menu.addItem((item: any) => item.setTitle(label).setIcon('languages').onClick(async () => {
				if (!info) return;
				this.selectionBar.hide();
				await this.handle(info.text, info.context, info.type);
			}));
			menu.showAtMouseEvent(evt);
		});
	}

	async handle(text: string, context: Context, type: TextType): Promise<void> {
		const coords = getSelectionEndCoords(this.plugin.app);
		if (coords) {
			this.notePopup.showPlain(coords.right, coords.top, '处理中', '正在分析，请稍候...', type);
		} else {
			new Notice('正在分析...');
		}

		try {
			const existingPath = this.findExisting(text, type);
			if (existingPath) {
				const file = this.plugin.app.vault.getAbstractFileByPath(existingPath);
				if (file instanceof TFile) {
					const raw = await this.plugin.app.vault.read(file);
					this.notePopup.hide();
					this.showNoteAtSelection(parseNoteContent(raw), existingPath);
					return;
				}
			}

			const result = await this.coordinator.analyzeSelectedText(text, context, type);
			this.notePopup.hide();

			if (result.metadata?.path) {
				const fp = result.metadata.path as string;
				const file = this.plugin.app.vault.getAbstractFileByPath(fp);
				if (file instanceof TFile) {
					const raw = await this.plugin.app.vault.read(file);
					const note = parseNoteContent(raw);
					this.coordinator.updateCache(text, {
						path: fp, type: type === 'phrase' ? 'phrase' : 'word',
						meaning: note.meaning, etymology: note.etymology,
						collocations: [], relatedWords: [],
						sentenceExamples: note.examples,
						lastModified: Date.now(),
						relationFlags: { synonym: 0, antonym: 0, cognate: 0 },
					});
					await this.onScanNeeded();
					this.showNoteAtSelection(note, fp);
					return;
				}
			}

			const title = `翻译: ${text.slice(0, 40)}${text.length > 40 ? '...' : ''}`;
			this.showPlainAtSelection(title, result.content, type);
		} catch (e) {
			this.notePopup.hide();
			const errMsg = e instanceof Error ? e.message : String(e);
			if (coords) {
				this.notePopup.showPlain(coords.right, coords.top, '出错了',
					`处理失败: ${errMsg}\n\n请检查 AI 配置是否正确。`, type);
			} else {
				new Notice(`处理失败: ${errMsg}`);
			}
		}
	}

	private findExisting(text: string, type: TextType): string | null {
		const folder = type === 'phrase' ? this.settings.phraseNotesFolder : this.settings.wordNotesFolder;
		const safe = text.toLowerCase().trim().replace(/[#?\[\]\/\\:*"<>|]/g, '_');
		const fileName = type === 'phrase' ? safe.replace(/\s+/g, '_') : safe;
		const path = `${folder}/${fileName}.md`;
		return this.plugin.app.vault.getAbstractFileByPath(path) ? path : null;
	}

	private showNoteAtSelection(note: ParsedNote, fp: string): void {
		const coords = getSelectionEndCoords(this.plugin.app);
		if (!coords) return;
		this.captureContext(note.word);
		this.notePopup.show(coords.right, coords.top, note, fp);
	}

	private captureContext(word: string): void {
		const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;
		const doc = view.editor.getValue();
		const idx = doc.toLowerCase().indexOf(word.toLowerCase());
		if (idx >= 0) {
			const start = Math.max(0, idx - 300);
			const end = Math.min(doc.length, idx + word.length + 300);
			this.notePopup.setContext(doc.slice(start, end));
		}
	}

	private showPlainAtSelection(title: string, content: string, type: TextType): void {
		const coords = getSelectionEndCoords(this.plugin.app);
		if (coords) this.notePopup.showPlain(coords.right, coords.top, title, content, type);
	}
}
