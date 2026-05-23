/**
 * VocabManager — vocabulary scanning, highlighting, cache population.
 */

import { TFile } from 'obsidian';
import { Plugin } from 'obsidian';
import { InteractionCoordinator } from '../coordinator/InteractionCoordinator';
import { VocabularyScanner, VocabularyTerm } from '../highlight/VocabularyScanner';
import { setHighlightTerms, refreshAllEditors } from '../highlight/VocabularyHighlighter';
import { parseNoteContent } from '../views/NotePopupView';

export class VocabManager {
	vocabTerms: VocabularyTerm[] = [];
	private scanDebounce: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private plugin: Plugin,
		private settings: { wordNotesFolder: string; phraseNotesFolder: string },
		private vocabScanner: VocabularyScanner,
		private coordinator: InteractionCoordinator,
	) {}

	init(): void {
		this.plugin.registerEvent(
			this.plugin.app.vault.on('create', (f) => this.onChange(f.path))
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on('delete', (f) => this.onChange(f.path))
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on('rename', (f) => this.onChange(f.path))
		);
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('active-leaf-change', () => this.scanAndHighlight())
		);
	}

	private onChange(path: string): void {
		const wf = this.settings.wordNotesFolder;
		const pf = this.settings.phraseNotesFolder;
		if (path.startsWith(wf + '/') || path.startsWith(pf + '/') || path === wf || path === pf) {
			if (this.scanDebounce) clearTimeout(this.scanDebounce);
			this.scanDebounce = setTimeout(() => this.scanAndHighlight(), 300);
		}
	}

	async scanAndHighlight(): Promise<void> {
		this.vocabScanner.updatePaths(this.settings.wordNotesFolder, this.settings.phraseNotesFolder);
		const terms = await this.vocabScanner.scan();
		this.vocabTerms = terms;
		setHighlightTerms(terms);
		refreshAllEditors();

		// Populate cache for getWordInfo() hover/reinterpret
		for (const term of terms) {
			const file = this.plugin.app.vault.getAbstractFileByPath(term.path);
			if (file instanceof TFile) {
				try {
					const raw = await this.plugin.app.vault.read(file);
					const note = parseNoteContent(raw);
					this.coordinator.updateCache(term.text, {
						path: term.path, type: term.type,
						meaning: note.meaning, etymology: note.etymology,
						collocations: [], relatedWords: [],
						sentenceExamples: note.examples,
						lastModified: Date.now(),
						relationFlags: { synonym: 0, antonym: 0, cognate: 0 },
					});
				} catch { /* skip */ }
			}
		}
	}
}
