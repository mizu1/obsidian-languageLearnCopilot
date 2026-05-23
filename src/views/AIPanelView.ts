/**
 * AIPanelView — right-sidebar panel for:
 *  - Showing full AI responses
 *  - Confirming note appends
 *  - Displaying batch progress logs
 *  - Manual chat input (extension)
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { InteractionCoordinator } from '../coordinator/InteractionCoordinator';
import { ChatHistoryManager } from '../features/ChatHistoryManager';
import { AIResult, ProgressLog, ChatMessage } from '../types';
import { i18n } from '../i18n';

export const AI_PANEL_VIEW_TYPE = 'lang-learn-ai-panel';

export class AIPanelView extends ItemView {
	private coordinator: InteractionCoordinator;
	private historyMgr: ChatHistoryManager;
	private rootEl: HTMLElement;
	private sessionBar: HTMLElement;
	private chatContainer: HTMLElement;
	private progressContainer: HTMLElement;
	private sessionSelect!: HTMLSelectElement;
	private renderMd?: (md: string, el: HTMLElement) => Promise<void>;
	private onGenerateRelations?: () => Promise<void>;
	private onClearFlags?: () => void;

	constructor(leaf: WorkspaceLeaf, coordinator: InteractionCoordinator, historyMgr: ChatHistoryManager) {
		super(leaf);
		this.coordinator = coordinator;
		this.historyMgr = historyMgr;

		this.rootEl = document.createElement('div');
		this.rootEl.className = 'lang-learn-panel';

		this.sessionBar = this.rootEl.createDiv('lang-learn-panel-session-bar');
		this.chatContainer = this.rootEl.createDiv('lang-learn-panel-chat');
		this.progressContainer = this.rootEl.createDiv('lang-learn-panel-progress');
	}

	setMarkdownRenderer(renderer: (md: string, el: HTMLElement) => Promise<void>): void {
		this.renderMd = renderer;
	}

	setGenerateRelationsHandler(fn: () => Promise<void>): void {
		this.onGenerateRelations = fn;
	}

	setClearFlagsHandler(fn: () => void): void {
		this.onClearFlags = fn;
	}

	getViewType(): string {
		return AI_PANEL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return i18n().panel.title;
	}

	getIcon(): string {
		return 'languages';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.appendChild(this.rootEl);

		this.renderSessionBar();
		this.renderInputBox();

		// Load today's session history
		const path = await this.historyMgr.getOrCreateSession();
		this.refreshSessionList();
		const msgs = await this.historyMgr.loadSession(path);
		if (msgs.length > 0) {
			this.loadHistory(msgs);
		} else {
			this.renderWelcome();
		}
	}

	async onClose(): Promise<void> {
		this.rootEl.empty();
	}

	// ── Public API ──

	showResult(result: AIResult): void {
		const msg = this.chatContainer.createDiv('lang-learn-panel-message lang-learn-panel-assistant');
		const span = msg.createSpan();
		if (this.renderMd) {
			this.renderMd(result.content, span);
		} else {
			span.setText(result.content);
		}

		if (!result.validationPassed) {
			msg.createDiv({ text: '⚠ 校验未通过', cls: 'lang-learn-panel-warning' });
		}
		this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
	}

	showProgress(log: ProgressLog): void {
		this.progressContainer.empty();
		this.progressContainer.createDiv({
			text: `正在处理: ${log.stage}`,
			cls: 'lang-learn-panel-progress-stage',
		});

		const bar = this.progressContainer.createDiv('lang-learn-panel-progress-bar');
		const pct = log.total > 0 ? (log.processed / log.total) * 100 : 100;
		bar.createDiv({
			cls: 'lang-learn-panel-progress-fill',
		}).style.width = `${pct}%`;

		this.progressContainer.createDiv({
			text: `${log.processed} / ${log.total}`,
			cls: 'lang-learn-panel-progress-text',
		});

		if (log.message) {
			this.progressContainer.createDiv({
				text: log.message,
				cls: 'lang-learn-panel-progress-msg',
			});
		}
	}

	showCompleted(): void {
		this.progressContainer.empty();
		this.progressContainer.createDiv({
			text: i18n().panel.completed,
			cls: 'lang-learn-panel-progress-stage',
		});
	}

	renderConfirmButton(word: string, content: string): void {
		const confirm = this.chatContainer.createDiv('lang-learn-panel-confirm');
		confirm.createSpan({ text: `追加 "${word}" 的新语境解释到笔记？` });

		const btnRow = confirm.createDiv('lang-learn-panel-confirm-btns');

		const yesBtn = btnRow.createEl('button', {
			text: '确认追加',
			cls: 'lang-learn-btn lang-learn-btn-primary',
		});
		yesBtn.addEventListener('click', async () => {
			await this.coordinator.confirmAppendToNote(word, content);
			confirm.createDiv({
				text: '已追加到笔记 ✓',
				cls: 'lang-learn-panel-success',
			});
			yesBtn.disabled = true;
		});

		const noBtn = btnRow.createEl('button', {
			text: '取消',
			cls: 'lang-learn-btn',
		});
		noBtn.addEventListener('click', () => {
			confirm.remove();
		});
	}

	addUserMessage(text: string): void {
		const msg = this.chatContainer.createDiv('lang-learn-panel-message lang-learn-panel-user');
		msg.createSpan({ text: text });
		this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
	}

	clearChat(): void {
		this.chatContainer.empty();
	}

	loadHistory(messages: ChatMessage[]): void {
		this.chatContainer.empty();
		for (const msg of messages) {
			const cls = msg.role === 'user'
				? 'lang-learn-panel-user'
				: 'lang-learn-panel-assistant';
			const div = this.chatContainer.createDiv(`lang-learn-panel-message ${cls}`);
			const span = div.createSpan();
			if (this.renderMd && msg.role === 'assistant') {
				this.renderMd(msg.content, span);
			} else {
				span.setText(msg.content);
			}
		}
		this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
	}

	// ── Session bar ──

	private renderSessionBar(): void {
		this.sessionBar.empty();

		this.sessionSelect = this.sessionBar.createEl('select', {
			cls: 'lang-learn-session-select',
		});
		this.refreshSessionList();

		this.sessionSelect.addEventListener('change', async () => {
			const path = this.sessionSelect.value;
			if (!path) return;
			this.historyMgr.setCurrentSession(path);
			const msgs = await this.historyMgr.loadSession(path);
			this.clearChat();
			if (msgs.length > 0) {
				this.loadHistory(msgs);
			} else {
				this.renderWelcome();
			}
		});

		// Refresh on dropdown click (catches external file changes)
		this.sessionSelect.addEventListener('focus', () => this.refreshSessionList());

		const newBtn = this.sessionBar.createEl('button', {
			text: i18n().panel.newChat,
			cls: 'lang-learn-btn lang-learn-btn-small',
		});
		newBtn.addEventListener('click', async () => {
			this.historyMgr.resetSession();
			await this.historyMgr.getOrCreateSession();
			this.refreshSessionList();
			this.clearChat();
			this.renderWelcome();
		});

		// Separator
		const sep = this.sessionBar.createSpan({ cls: 'lang-learn-session-sep' });

		// Generate relations button
		const relBtn = this.sessionBar.createEl('button', {
			text: i18n().panel.graph,
			cls: 'lang-learn-btn lang-learn-btn-small',
		});
		relBtn.addEventListener('click', () => {
			relBtn.textContent = '...';
			relBtn.disabled = true;
			this.onGenerateRelations?.().finally(() => {
				relBtn.textContent = '图谱';
				relBtn.disabled = false;
			});
		});

		// Clear flags button
		const clearBtn = this.sessionBar.createEl('button', {
			text: i18n().panel.reset,
			cls: 'lang-learn-btn lang-learn-btn-small',
		});
		clearBtn.addEventListener('click', () => {
			this.onClearFlags?.();
		});
	}

	private refreshSessionList(): void {
		const sessions = this.historyMgr.listSessions();
		const current = this.historyMgr.getCurrentSessionPath();
		this.sessionSelect.empty();

		for (const s of sessions) {
			const opt = this.sessionSelect.createEl('option');
			opt.value = s.path;
			opt.text = s.basename;
			if (s.path === current) opt.selected = true;
		}

		if (sessions.length === 0) {
			const opt = this.sessionSelect.createEl('option');
			opt.text = i18n().vocab.noHistory;
		}
	}

	private renderInputBox(): void {
		const inputRow = this.rootEl.createDiv('lang-learn-panel-input-row');

		const input = inputRow.createEl('input', {
			type: 'text',
			placeholder: i18n().panel.placeholder,
			cls: 'lang-learn-panel-input',
		});

		const sendBtn = inputRow.createEl('button', {
			text: i18n().panel.send,
			cls: 'lang-learn-btn lang-learn-btn-primary',
		});

		sendBtn.addEventListener('click', async () => {
			const text = input.value.trim();
			if (!text) return;

			input.value = '';
			input.disabled = true;
			sendBtn.disabled = true;

			// User bubble
			this.addUserMessage(text);
			this.historyMgr.appendMessage('user', text);

			// Empty assistant bubble for streaming
			const msgDiv = this.chatContainer.createDiv('lang-learn-panel-message lang-learn-panel-assistant');
			const contentSpan = msgDiv.createSpan();
			let fullResponse = '';

			try {
				await (this.coordinator as any).sendUserMessageStreaming(
					text,
					(chunk: string) => {
						fullResponse += chunk;
						contentSpan.setText(fullResponse);
						this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
					}
				);
				if (fullResponse) {
					this.historyMgr.appendMessage('assistant', fullResponse);
					// Re-render as markdown after streaming completes
					if (this.renderMd) {
						contentSpan.empty();
						await this.renderMd(fullResponse, contentSpan);
					}
				}
			} catch (e) {
				contentSpan.setText(`错误: ${e}`);
			} finally {
				input.disabled = false;
				sendBtn.disabled = false;
				input.focus();
			}
		});

		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				sendBtn.click();
			}
		});
	}

	private renderWelcome(): void {
		const welcome = this.chatContainer.createDiv('lang-learn-panel-welcome');
		welcome.createDiv({ text: i18n().panel.welcome });
		welcome.createDiv({ text: i18n().panel.welcomeSub, cls: 'lang-learn-panel-welcome-sub' });
	}

	refreshLanguage(): void {
		this.sessionBar.empty(); this.renderSessionBar();
		const input = this.rootEl.querySelector('.lang-learn-panel-input') as HTMLInputElement;
		if (input) input.placeholder = i18n().panel.placeholder;
	}
}
