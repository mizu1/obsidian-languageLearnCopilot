/**
 * VocabularyHighlighter — CodeMirror 6 decorations that highlight known
 * words and phrases in the editor. Longest-match priority via sorted terms.
 *
 * Uses StateEffect to force re-decoration when terms change,
 * avoiding the zero-width-change workaround that CM6 optimizes away.
 */

import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from '@codemirror/view';
import { Extension, StateEffect } from '@codemirror/state';
import { VocabularyTerm } from './VocabularyScanner';

// ── StateEffect for term updates ──

const setTermsEffect = StateEffect.define<VocabularyTerm[]>();

// ── Shared state ──

let currentTerms: VocabularyTerm[] = [];

export function setHighlightTerms(terms: VocabularyTerm[]): void {
	currentTerms = terms;
}

// ── Compute decorations ──

function isBoundary(text: string, pos: number): boolean {
	if (pos < 0 || pos >= text.length) return true;
	return !/[a-zA-Z0-9'-]/.test(text[pos]);
}

function computeDecorations(text: string, terms: VocabularyTerm[]): DecorationSet {
	if (terms.length === 0) return Decoration.none;

	const lowerText = text.toLowerCase();
	const occupied: boolean[] = new Array(text.length).fill(false);
	const marks: { from: number; to: number }[] = [];

	for (const term of terms) {
		const lowerTerm = term.text.toLowerCase();
		let searchFrom = 0;

		while (true) {
			const idx = lowerText.indexOf(lowerTerm, searchFrom);
			if (idx === -1) break;

			const end = idx + term.text.length;
			if (isBoundary(text, idx - 1) && isBoundary(text, end)) {
				let overlaps = false;
				for (let i = idx; i < end && !overlaps; i++) {
					if (occupied[i]) overlaps = true;
				}
				if (!overlaps) {
					marks.push({ from: idx, to: end });
					for (let i = idx; i < end; i++) occupied[i] = true;
				}
			}
			searchFrom = idx + 1;
		}
	}

	if (marks.length === 0) return Decoration.none;

	return Decoration.set(
		marks.map(m =>
			Decoration.mark({ class: 'lang-learn-highlight' }).range(m.from, m.to)
		),
		true
	);
}

// ── ViewPlugin ──

const highlightPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = computeDecorations(view.state.doc.toString(), currentTerms);
		}

		update(update: ViewUpdate): void {
			// StateEffect: terms changed → full recompute
			for (const tr of update.transactions) {
				for (const effect of tr.effects) {
					if (effect.is(setTermsEffect)) {
						this.decorations = computeDecorations(
							update.state.doc.toString(),
							effect.value
						);
						return;
					}
				}
			}

			// Document change → recompute with current terms
			if (update.docChanged) {
				this.decorations = computeDecorations(
					update.state.doc.toString(),
					currentTerms
				);
			} else {
				// Position mapping only (e.g. selection change)
				this.decorations = this.decorations.map(update.changes);
			}
		}
	},
	{ decorations: v => v.decorations }
);

// ── Export ──

export function vocabularyHighlightExtension(): Extension {
	return highlightPlugin;
}

export function refreshAllEditors(): void {
	const terms = currentTerms;
	for (const view of getActiveEditorViews()) {
		view.dispatch({
			effects: setTermsEffect.of(terms),
		});
	}
}

function getActiveEditorViews(): EditorView[] {
	const editors = document.querySelectorAll('.cm-editor .cm-content');
	const views: EditorView[] = [];
	for (const el of editors) {
		const view = (el as any).cmView?.view as EditorView | undefined;
		if (view) views.push(view);
	}
	return views;
}
