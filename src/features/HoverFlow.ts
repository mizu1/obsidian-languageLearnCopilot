/**
 * HoverFlow — mouse hover detection + click-on-highlighted-word.
 */

import { MarkdownView, TFile } from 'obsidian';
import { Plugin } from 'obsidian';
import { InteractionCoordinator } from '../coordinator/InteractionCoordinator';
import { HoverPopoverView } from '../views/HoverPopoverView';
import { NotePopupView, parseNoteContent } from '../views/NotePopupView';
import { VocabularyTerm } from '../highlight/VocabularyScanner';
import { getWordAtMousePosition, getVocabTermAtPosition } from './EditorHelpers';

export class HoverFlow {
	constructor(
		private plugin: Plugin,
		private coordinator: InteractionCoordinator,
		private hoverView: HoverPopoverView,
		private notePopup: NotePopupView,
		private settings: { hoverEnabled: boolean },
		private getVocabTerms: () => VocabularyTerm[],
	) {}

	init(): void {
		this.registerHover();
		this.registerHighlightClick();
	}

	private registerHover(): void {
		let timer: ReturnType<typeof setTimeout> | null = null;
		this.plugin.registerDomEvent(document, 'mousemove', (evt: MouseEvent) => {
			if (!this.settings.hoverEnabled) return;
			if (timer) { clearTimeout(timer); timer = null; }
			timer = setTimeout(() => {
				const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return;
				if (!(evt.target as HTMLElement).closest('.cm-editor')) { this.hoverView.hide(); return; }
				const word = getWordAtMousePosition(view.editor, evt);
				if (!word) { this.hoverView.hide(); return; }
				const entry = this.coordinator.getWordInfo(word);
				if (!entry) { this.hoverView.hide(); return; }
				this.hoverView.show(evt.clientX, evt.clientY, word, entry);
			}, 400);
		});
		this.plugin.registerDomEvent(document, 'click', () => {
			if (this.hoverView.isVisible) this.hoverView.hide();
		});
		this.plugin.registerDomEvent(document, 'scroll', () => {
			if (this.hoverView.isVisible) this.hoverView.hide();
		}, true);
	}

	private registerHighlightClick(): void {
		this.plugin.registerDomEvent(document, 'click', async (evt: MouseEvent) => {
			if (!(evt.target as HTMLElement).closest('.cm-editor')) return;
			const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) return;
			const term = getVocabTermAtPosition(view.editor, evt, this.getVocabTerms());
			if (!term) return;
			const file = this.plugin.app.vault.getAbstractFileByPath(term.path);
			if (file instanceof TFile) {
				const raw = await this.plugin.app.vault.read(file);
				this.captureContext(view, term.text);
				this.notePopup.show(evt.clientX, evt.clientY, parseNoteContent(raw), term.path);
			}
		});
	}

	private captureContext(view: MarkdownView, word: string): void {
		const doc = view.editor.getValue();
		const idx = doc.toLowerCase().indexOf(word.toLowerCase());
		if (idx >= 0) {
			const start = Math.max(0, idx - 300);
			const end = Math.min(doc.length, idx + word.length + 300);
			this.notePopup.setContext(doc.slice(start, end));
		} else {
			this.notePopup.setContext('');
		}
	}
}
