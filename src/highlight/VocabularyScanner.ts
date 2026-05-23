/**
 * VocabularyScanner — scans word_notes and phrase_notes folders,
 * builds a sorted vocabulary list for highlighting.
 * Longest terms first → ensures phrase-over-word priority.
 */

import { Vault, TFile } from 'obsidian';

export interface VocabularyTerm {
	text: string;      // display text (underscores restored to spaces)
	path: string;      // full path to the .md file
	type: 'word' | 'phrase';
}

export class VocabularyScanner {
	private vault: Vault;
	private wordFolder: string;
	private phraseFolder: string;

	constructor(vault: Vault, wordFolder: string, phraseFolder: string) {
		this.vault = vault;
		this.wordFolder = wordFolder;
		this.phraseFolder = phraseFolder;
	}

	updatePaths(wordFolder: string, phraseFolder: string): void {
		this.wordFolder = wordFolder;
		this.phraseFolder = phraseFolder;
	}

	/**
	 * Scan both folders and return all terms sorted by length descending.
	 * Phrases (which are longer) naturally come first.
	 */
	async scan(): Promise<VocabularyTerm[]> {
		const terms: VocabularyTerm[] = [];

		await this.scanFolder(this.wordFolder, 'word', terms);
		await this.scanFolder(this.phraseFolder, 'phrase', terms);

		// Sort by text length descending → longest match priority
		terms.sort((a, b) => b.text.length - a.text.length);

		return terms;
	}

	private async scanFolder(
		folderPath: string,
		type: 'word' | 'phrase',
		output: VocabularyTerm[]
	): Promise<void> {
		const folder = this.vault.getAbstractFileByPath(folderPath);
		if (!folder) return;

		if (!(folder as any).children) return;

		const children = (folder as any).children as TFile[];
		for (const file of children) {
			if (file.extension !== 'md') continue;

			const fileName = file.basename;
			// Restore spaces for phrases (underscores → spaces)
			const displayText = type === 'phrase'
				? fileName.replace(/_/g, ' ')
				: fileName;

			output.push({
				text: displayText,
				path: file.path,
				type,
			});
		}
	}
}
