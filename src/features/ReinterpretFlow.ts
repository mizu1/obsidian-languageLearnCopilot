/**
 * ReinterpretFlow — "reinterpret in context" + confirm append.
 * Wires handlers to NotePopupView and HoverPopoverView.
 */

import { MarkdownView, TFile } from 'obsidian';
import { Plugin } from 'obsidian';
import { InteractionCoordinator } from '../coordinator/InteractionCoordinator';
import { NotePopupView, parseNoteContent } from '../views/NotePopupView';
import { HoverPopoverView } from '../views/HoverPopoverView';
import { VocabularyTerm } from '../highlight/VocabularyScanner';
import { getSelectionEndCoords } from './EditorHelpers';

export class ReinterpretFlow {
	constructor(
		private plugin: Plugin,
		private coordinator: InteractionCoordinator,
		private notePopup: NotePopupView,
		private hoverView: HoverPopoverView,
		private getVocabTerms: () => VocabularyTerm[],
		private onScanNeeded: () => Promise<void>,
	) {}

	init(): void {
		this.notePopup.setReinterpretHandler(async (word, ctx) => this.reinterpret(word, ctx));
		this.notePopup.setConfirmAppendHandler(async (word) => this.confirmAppend(word));
		this.hoverView.setOpenNotePopupHandler(async (word) => this.openFromHover(word));
	}

	private async reinterpret(word: string, ctx: string): Promise<{ content: string }> {
		// Use the context captured when popup was opened — no full-document search needed

		let originalNote = '';
		const cache = this.coordinator.getWordInfo(word);
		if (cache?.path) {
			const file = this.plugin.app.vault.getAbstractFileByPath(cache.path);
			if (file instanceof TFile) originalNote = await this.plugin.app.vault.read(file);
		} else {
			const term = this.getVocabTerms().find(t => t.text.toLowerCase() === word.toLowerCase());
			if (term) {
				const file = this.plugin.app.vault.getAbstractFileByPath(term.path);
				if (file instanceof TFile) originalNote = await this.plugin.app.vault.read(file);
			}
		}

		const result = await this.coordinator.reinterpretInContext(word, ctx, originalNote);
		return { content: result.content };
	}

	private async confirmAppend(word: string): Promise<void> {
		await this.coordinator.confirmAppendToNote(word, '');
		await this.onScanNeeded();
	}

	private async openFromHover(word: string): Promise<void> {
		const cache = this.coordinator.getWordInfo(word);
		if (cache?.path) {
			const file = this.plugin.app.vault.getAbstractFileByPath(cache.path);
			if (file instanceof TFile) {
				const raw = await this.plugin.app.vault.read(file);
				const coords = getSelectionEndCoords(this.plugin.app);
				if (coords) {
					// Capture context before showing popup
					const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
					if (view) {
						const doc = view.editor.getValue();
						const idx = doc.toLowerCase().indexOf(word.toLowerCase());
						if (idx >= 0) {
							const start = Math.max(0, idx - 300);
							const end = Math.min(doc.length, idx + word.length + 300);
							this.notePopup.setContext(doc.slice(start, end));
						}
					}
					this.notePopup.show(coords.right, coords.top, parseNoteContent(raw), cache.path);
				}
			}
		}
	}
}
