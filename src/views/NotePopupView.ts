/**
 * NotePopupView — floating popup showing full note content or AI response.
 * Two modes:
 *   show()  — file-backed note with "打开完整笔记" + "重新解释" buttons
 *   showPlain() — text-only AI response (translation / hint), no file buttons
 */

import { TextType } from '../types';
import { i18n } from '../i18n';

export interface ParsedNote {
	word: string;
	type: 'word' | 'phrase';
	createdAt: string;
	meaning: string;
	pronunciation: string;
	etymology: string;
	examples: { sentence: string; analysis: string }[];
}

export function parseNoteContent(raw: string): ParsedNote {
	const result: ParsedNote = {
		word: '',
		type: 'word',
		createdAt: '',
		meaning: '',
		pronunciation: '',
		etymology: '',
		examples: [],
	};

	const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
	if (fmMatch) {
		const fm = fmMatch[1];
		const wordMatch = fm.match(/词:\s*(.+)/);
		const typeMatch = fm.match(/类型:\s*(.+)/);
		const timeMatch = fm.match(/创建时间:\s*(.+)/);
		if (wordMatch) result.word = wordMatch[1].trim();
		if (typeMatch) result.type = typeMatch[1].trim() as 'word' | 'phrase';
		if (timeMatch) result.createdAt = timeMatch[1].trim();
	}

	const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '');

	const meaningMatch = body.match(/##\s*含义\s*\n([\s\S]*?)(?=\n##|$)/);
	if (meaningMatch) result.meaning = meaningMatch[1].trim();

	const pronMatch = body.match(/##\s*读音\s*\n([\s\S]*?)(?=\n##|$)/);
	if (pronMatch) result.pronunciation = pronMatch[1].trim();

	const etymMatch = body.match(/##\s*词源\s*\n([\s\S]*?)(?=\n##|$)/);
	if (etymMatch) result.etymology = etymMatch[1].trim();

	const examplesMatch = body.match(/##\s*例句与语境分析\s*\n([\s\S]*?)(?=\n##|$)/);
	if (examplesMatch) {
		const lines = examplesMatch[1].trim().split('\n');
		for (const line of lines) {
			const m = line.match(/-\s*"([^"]+)"\s*→\s*(.+)/);
			if (m) result.examples.push({ sentence: m[1], analysis: m[2].trim() });
		}
	}

	return result;
}

export class NotePopupView {
	private popup: HTMLElement | null = null;
	private onReinterpret?: (word: string, context: string) => Promise<{ content: string }>;
	private onConfirmAppend?: (word: string) => Promise<void>;
	private onOpenFile?: (path: string) => void;
	private renderMd?: (md: string, el: HTMLElement) => Promise<void>;
	private currentContext: string = '';

	setReinterpretHandler(handler: (word: string, context: string) => Promise<{ content: string }>): void {
		this.onReinterpret = handler;
	}

	setContext(ctx: string): void {
		this.currentContext = ctx;
	}

	setConfirmAppendHandler(handler: (word: string) => Promise<void>): void {
		this.onConfirmAppend = handler;
	}

	setOpenFileHandler(handler: (path: string) => void): void {
		this.onOpenFile = handler;
	}

	setMarkdownRenderer(renderer: (md: string, el: HTMLElement) => Promise<void>): void {
		this.renderMd = renderer;
	}

	show(x: number, y: number, note: ParsedNote, filePath: string): void {
		this.hide();
		this.popup = this.buildNotePopup(note, filePath);
		this.position(x, y);
		document.body.appendChild(this.popup);
		this.makeDraggable();
	}

	showPlain(x: number, y: number, title: string, content: string, _type: TextType): void {
		this.hide();
		this.popup = this.buildPlainPopup(title, content);
		this.position(x, y);
		document.body.appendChild(this.popup);
		this.makeDraggable();
	}

	hide(): void {
		if (this.popup) {
			this.popup.remove();
			this.popup = null;
		}
	}

	get isVisible(): boolean {
		return this.popup !== null;
	}

	// ── Note popup (file-backed) ──

	private buildNotePopup(note: ParsedNote, filePath: string): HTMLElement {
		const el = this.createContainer();

		// Header
		const header = el.createDiv('lang-learn-note-header');
		const tg = header.createDiv('lang-learn-note-title-group');
		tg.createSpan({ text: note.word, cls: 'lang-learn-note-word' });
		// Speaker icon for TTS
		const speaker = tg.createSpan({ text: '🔊', cls: 'lang-learn-note-speaker' });
		speaker.addEventListener('click', (e) => {
			e.stopPropagation();
			const u = new SpeechSynthesisUtterance(note.word);
			u.lang = detectLang(note.word, note.pronunciation);
			speechSynthesis.cancel();
			speechSynthesis.speak(u);
		});
		tg.createSpan({ text: note.type === 'phrase' ? i18n().note.phrase : i18n().note.word, cls: 'lang-learn-note-type' });
		if (note.createdAt) tg.createSpan({ text: note.createdAt, cls: 'lang-learn-note-date' });
		this.addCloseBtn(header);

		// Body
		const body = el.createDiv('lang-learn-note-body');
		this.addSection(body, i18n().note.meaning, note.meaning);
		if (note.pronunciation) this.addSection(body, i18n().note.pronunciation, note.pronunciation);
		if (note.etymology) this.addCollapsibleSection(body, i18n().note.etymology, note.etymology);
		if (note.examples.length > 0) this.addExamplesSection(body, i18n().note.example, note.examples);

		// Footer
		const footer = el.createDiv('lang-learn-note-footer');
		this.addButton(footer, i18n().note.fullNote, 'lang-learn-btn', () => {
			this.hide();
			this.onOpenFile?.(filePath);
		});
		this.addButton(footer, i18n().note.reinterpret, 'lang-learn-btn lang-learn-btn-primary', async () => {
			if (!this.onReinterpret) return;

			const body = el.querySelector('.lang-learn-note-body') as HTMLElement;
			body.empty();
			body.createDiv({ text: i18n().selection.processing, cls: 'lang-learn-note-text' });

			try {
				const result = await this.onReinterpret(note.word, this.currentContext);
				body.empty();
				body.createDiv({ text: i18n().note.meaning, cls: 'lang-learn-note-label' });
				const resultDiv = body.createDiv('lang-learn-note-text');
				await this.setTextContent(resultDiv, result.content);

				const btnRow = body.createDiv('lang-learn-note-footer');
				const confirmBtn = btnRow.createEl('button', { text: i18n().note.confirmAppend, cls: 'lang-learn-btn lang-learn-btn-primary' });
				const cancelBtn = btnRow.createEl('button', { text: i18n().note.cancel, cls: 'lang-learn-btn' });

				confirmBtn.addEventListener('click', async (e) => {
					e.stopPropagation(); confirmBtn.textContent = '...'; confirmBtn.disabled = true;
					try { await this.onConfirmAppend?.(note.word); body.empty(); body.createDiv({ text: i18n().note.appended, cls: 'lang-learn-note-text' }); }
					catch { body.createDiv({ text: i18n().note.appendFailed, cls: 'lang-learn-note-text' }); }
				});
				cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); this.hide(); });
			} catch (e) {
				body.empty(); body.createDiv({ text: `${i18n().selection.error}: ${e}`, cls: 'lang-learn-note-text' });
			}
		});

		return el;
	}

	// ── Plain popup (translation / hint) ──

	private buildPlainPopup(title: string, content: string): HTMLElement {
		const el = this.createContainer();

		// Header
		const header = el.createDiv('lang-learn-note-header');
		header.createSpan({ text: title, cls: 'lang-learn-note-word' });
		this.addCloseBtn(header);

		// Body
		const body = el.createDiv('lang-learn-note-body');
		const textDiv = body.createDiv('lang-learn-note-text');
		this.setTextContent(textDiv, content);

		return el;
	}

	// ── Helpers ──

	private async setTextContent(el: HTMLElement, text: string): Promise<void> {
		if (this.renderMd) {
			await this.renderMd(text, el);
		} else {
			el.setText(text);
		}
	}

	private createContainer(): HTMLElement {
		const el = document.createElement('div');
		el.className = 'lang-learn-note-popup';
		return el;
	}

	private addCloseBtn(parent: HTMLElement): void {
		const btn = parent.createSpan({ text: '✕', cls: 'lang-learn-note-close' });
		btn.addEventListener('click', (e) => { e.stopPropagation(); this.hide(); });
	}

	private addSection(parent: HTMLElement, label: string, text: string): void {
		const sec = parent.createDiv('lang-learn-note-section');
		sec.createDiv({ text: label, cls: 'lang-learn-note-label' });
		const div = sec.createDiv('lang-learn-note-text');
		this.setTextContent(div, text);
	}

	private addCollapsibleSection(parent: HTMLElement, label: string, text: string): void {
		const sec = parent.createDiv('lang-learn-note-section');
		const hdr = sec.createDiv('lang-learn-note-label-collapsible');
		const toggle = hdr.createSpan({ text: '▸' });
		hdr.createSpan({ text: ` ${label}` });
		const ctn = sec.createDiv('lang-learn-note-text lang-learn-note-collapsed');
		this.setTextContent(ctn, text);
		hdr.addEventListener('click', () => {
			const ok = ctn.classList.toggle('lang-learn-note-collapsed');
			toggle.setText(ok ? '▸' : '▾');
		});
	}

	private addExamplesSection(
		parent: HTMLElement, label: string,
		examples: { sentence: string; analysis: string }[]
	): void {
		const sec = parent.createDiv('lang-learn-note-section');
		sec.createDiv({ text: label, cls: 'lang-learn-note-label' });
		for (const ex of examples) {
			const blk = sec.createDiv('lang-learn-note-example');
			blk.createDiv({ text: `"${ex.sentence}"`, cls: 'lang-learn-note-sentence' });
			blk.createDiv({ text: ex.analysis, cls: 'lang-learn-note-analysis' });
		}
	}

	private addButton(parent: HTMLElement, text: string, cls: string, onClick: () => void): void {
		const btn = parent.createEl('button', { text, cls });
		btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
	}

	// ── Drag ──

	private dragState: { ox: number; oy: number } | null = null;

	private makeDraggable(): void {
		if (!this.popup) return;
		const header = this.popup.querySelector('.lang-learn-note-header') as HTMLElement;
		if (!header) return;
		header.style.cursor = 'move';

		const onDown = (e: MouseEvent) => {
			if ((e.target as HTMLElement).closest('.lang-learn-note-close, button')) return;
			const rect = this.popup!.getBoundingClientRect();
			this.dragState = { ox: e.clientX - rect.left, oy: e.clientY - rect.top };
			e.preventDefault();
		};
		const onMove = (e: MouseEvent) => {
			if (!this.dragState || !this.popup) return;
			this.popup.style.left = `${e.clientX - this.dragState.ox}px`;
			this.popup.style.top = `${e.clientY - this.dragState.oy}px`;
		};
		const onUp = () => { this.dragState = null; };

		header.addEventListener('mousedown', onDown);
		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);

		const origHide = this.hide.bind(this);
		this.hide = () => {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
			header.removeEventListener('mousedown', onDown);
			origHide();
		};
	}

	private position(x: number, y: number): void {
		if (!this.popup) return;
		const r = this.popup.getBoundingClientRect();
		const vw = window.innerWidth, vh = window.innerHeight;
		let left = x + 12, top = y - r.height - 12;
		if (left + r.width > vw - 16) left = vw - r.width - 16;
		if (top < 8) top = y + 16;
		if (top + r.height > vh - 16) top = vh - r.height - 16;
		if (top < 8) top = 8;
		if (left < 8) left = 8;
		this.popup.style.left = `${left}px`;
		this.popup.style.top = `${top}px`;
	}
}

/** Guess TTS language from word + pronunciation */
function detectLang(word: string, pron: string): string {
	const combined = pron + word;
	if (/[ぁ-んァ-ン]/.test(pron)) return 'ja-JP';          // hiragana/katakana → Japanese
	if (/[\u3040-\u309f\u30a0-\u30ff]/.test(combined)) return 'ja-JP'; // word has kana
	if (/[\u4e00-\u9fff]/.test(pron)) return 'zh-CN';       // pronunciation is Chinese chars
	if (/[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/.test(pron)) return 'zh-CN';
	if (/[ㄱ-ㅎ가-힣]/.test(combined)) return 'ko-KR';
	return 'en-US';
}
