/**
 * SelectionActionBar — floating button that appears near text selection.
 * Uses callback pattern: main.ts provides the action handler.
 */

import { Context, TextType } from '../types';
import { i18n } from '../i18n';

export type SelectionActionCallback = (
	text: string, context: Context, type: TextType
) => Promise<void>;

export class SelectionActionBar {
	private onAction: SelectionActionCallback;
	private button: HTMLElement | null = null;

	constructor(onAction: SelectionActionCallback) {
		this.onAction = onAction;
	}

	setCallback(onAction: SelectionActionCallback): void {
		this.onAction = onAction;
	}

	show(x: number, y: number, text: string, context: Context, type: TextType): void {
		this.hide();

		this.button = document.createElement('div');
		this.button.className = 'lang-learn-selection-btn';
		this.button.textContent = type === 'sentence' || type === 'paragraph'
			? i18n().selection.translate
			: i18n().selection.analyze;

		this.button.addEventListener('click', async (e) => {
			e.stopPropagation();
			const btn = this.button!;
			btn.textContent = '...';
			btn.classList.add('lang-learn-selection-btn-loading');

			try {
				await this.onAction(text, context, type);
			} finally {
				this.hide();
			}
		});

		void this.button.offsetHeight;
		this.button.classList.add('lang-learn-selection-btn-visible');

		this.position(x, y);
		document.body.appendChild(this.button);
	}

	hide(): void {
		if (this.button) {
			this.button.classList.remove('lang-learn-selection-btn-visible');
			const el = this.button;
			setTimeout(() => el.remove(), 150);
			this.button = null;
		}
	}

	get isVisible(): boolean {
		return this.button !== null;
	}

	private position(x: number, y: number): void {
		if (!this.button) return;

		const rect = this.button.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		let left = x + 8;
		let top = y - rect.height - 8;

		if (left + rect.width > vw - 16) left = vw - rect.width - 16;
		if (top < 8) top = y + 16;
		if (left < 8) left = 8;

		this.button.style.left = `${left}px`;
		this.button.style.top = `${top}px`;
	}
}
