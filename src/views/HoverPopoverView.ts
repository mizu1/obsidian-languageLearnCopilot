/**
 * HoverPopoverView — shows word/phrase info when hovering over known text.
 * Displays a floating popup near the cursor with meaning, etymology, example,
 * and action buttons.
 */

import { InteractionCoordinator } from '../coordinator/InteractionCoordinator';
import { WordCacheEntry } from '../types';

export class HoverPopoverView {
	private coordinator: InteractionCoordinator;
	private popup: HTMLElement | null = null;
	private onOpenNotePopup?: (word: string) => void;

	constructor(coordinator: InteractionCoordinator) {
		this.coordinator = coordinator;
	}

	setOpenNotePopupHandler(handler: (word: string) => void): void {
		this.onOpenNotePopup = handler;
	}

	show(x: number, y: number, word: string, entry: WordCacheEntry): void {
		this.hide();
		this.popup = this.buildPopup(word, entry);
		this.positionPopup(x, y);
		document.body.appendChild(this.popup);
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

	private buildPopup(word: string, entry: WordCacheEntry): HTMLElement {
		const el = document.createElement('div');
		el.className = 'lang-learn-hover-popup';

		// Header: word + type badge
		const header = el.createDiv('lang-learn-hover-header');
		header.createSpan({ text: word, cls: 'lang-learn-hover-word' });
		header.createSpan({
			text: entry.type === 'phrase' ? '短语' : '单词',
			cls: 'lang-learn-hover-type',
		});

		// Meaning (always shown)
		const meaning = el.createDiv('lang-learn-hover-section');
		meaning.createDiv({ text: '含义', cls: 'lang-learn-hover-label' });
		meaning.createDiv({ text: entry.meaning, cls: 'lang-learn-hover-text' });

		// Etymology (collapsible, shown if exists)
		if (entry.etymology) {
			const etymology = el.createDiv('lang-learn-hover-section');
			const etHeader = etymology.createDiv('lang-learn-hover-label-collapsible');
			const toggle = etHeader.createSpan({ text: '▸' });
			etHeader.createSpan({ text: ' 词源' });

			const content = etymology.createDiv({
				text: entry.etymology,
				cls: 'lang-learn-hover-text lang-learn-hover-collapsed',
			});

			etHeader.addEventListener('click', () => {
				const collapsed = content.classList.toggle('lang-learn-hover-collapsed');
				toggle.setText(collapsed ? '▸' : '▾');
			});
		}

		// Example sentence (shown if exists)
		if (entry.sentenceExamples.length > 0) {
			const example = el.createDiv('lang-learn-hover-section');
			example.createDiv({ text: '例句', cls: 'lang-learn-hover-label' });
			const ex = entry.sentenceExamples[0];
			example.createDiv({
				text: `"${ex.sentence}"`,
				cls: 'lang-learn-hover-sentence',
			});
			example.createDiv({
				text: ex.analysis,
				cls: 'lang-learn-hover-analysis',
			});
		}

		// Action buttons
		const buttons = el.createDiv('lang-learn-hover-buttons');

		const viewBtn = buttons.createEl('button', {
			text: '查看完整笔记',
			cls: 'lang-learn-btn',
		});
		viewBtn.addEventListener('click', () => {
			this.hide();
		});

		const reinterpretBtn = buttons.createEl('button', {
			text: '在此语境下重新解释',
			cls: 'lang-learn-btn lang-learn-btn-secondary',
		});
		reinterpretBtn.addEventListener('click', () => {
			this.hide();
			this.onOpenNotePopup?.(word);
		});

		return el;
	}

	private positionPopup(x: number, y: number): void {
		if (!this.popup) return;

		const popup = this.popup;
		const rect = popup.getBoundingClientRect();
		const viewportW = window.innerWidth;
		const viewportH = window.innerHeight;

		let left = x + 12;
		let top = y - 12;

		// Keep within viewport
		if (left + rect.width > viewportW - 16) {
			left = x - rect.width - 12;
		}
		if (top + rect.height > viewportH - 16) {
			top = viewportH - rect.height - 16;
		}
		if (top < 8) top = 8;
		if (left < 8) left = 8;

		popup.style.left = `${left}px`;
		popup.style.top = `${top}px`;
	}
}
