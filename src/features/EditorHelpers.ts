/**
 * Editor helpers — pure functions for editor text operations.
 * Extracted from main.ts to keep it lean.
 */

import { MarkdownView, Editor } from 'obsidian';
import { Context, TextType } from '../types';
import { VocabularyTerm } from '../highlight/VocabularyScanner';

export function getSelectionInfo(
	app: { workspace: any }
): { text: string; context: Context; type: TextType } | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return null;
	const editor = view.editor;
	const selection = editor.getSelection();
	if (!selection?.trim()) return null;
	const doc = editor.getValue();
	const from = editor.posToOffset(editor.getCursor('from'));
	const to = editor.posToOffset(editor.getCursor('to'));

	return {
		text: selection,
		context: {
			before: truncateBefore(doc.slice(0, from)),
			selected: selection,
			after: truncateAfter(doc.slice(to)),
		},
		type: classifyText(selection),
	};
}

/**
 * Truncate context to ~300 chars per side, extending to nearest sentence boundary
 * so we never cut mid-word/mid-sentence.
 */

const CTX_LEN = 300;
const SENTENCE_END = /[。！？\n.?!;；]/g;  // prefer these
const MAX_EXTEND = 100;  // don't extend more than this past CTX_LEN

function truncateBefore(text: string): string {
	if (text.length <= CTX_LEN) return text;
	// Take last CTX_LEN chars, then find first sentence break within them
	const chunk = text.slice(-CTX_LEN);
	const b = findFirstBreak(chunk, SENTENCE_END);
	return b > 0 ? chunk.slice(b) : chunk;
}

function truncateAfter(text: string): string {
	if (text.length <= CTX_LEN) return text;
	// Take first CTX_LEN, then extend to next sentence break (max +MAX_EXTEND)
	const searchEnd = Math.min(text.length, CTX_LEN + MAX_EXTEND);
	const extended = text.slice(0, searchEnd);
	const b = findLastBreak(extended.slice(CTX_LEN)); // look only in the extension zone
	if (b >= 0) {
		return extended.slice(0, CTX_LEN + b + 1);
	}
	return text.slice(0, CTX_LEN);
}

function findFirstBreak(text: string, regex: RegExp): number {
	// Find first separator, return position after it
	let m: RegExpExecArray | null;
	const r = new RegExp(regex.source, 'g');
	while ((m = r.exec(text)) !== null) {
		if (m.index > text.length * 0.3) return m.index + 1;
	}
	return 0;
}

function findLastBreak(text: string): number {
	// Find last separator in the extension zone
	let last = -1;
	let m: RegExpExecArray | null;
	const r = new RegExp(SENTENCE_END.source, 'g');
	while ((m = r.exec(text)) !== null) last = m.index;
	return last;
}

export function getWordUnderCursor(app: { workspace: any }): string | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return null;
	const editor = view.editor;
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	const wordRegex = /[\p{L}\p{N}'-]+/gu;
	let m: RegExpExecArray | null;
	while ((m = wordRegex.exec(line)) !== null) {
		if (cursor.ch >= m.index && cursor.ch <= m.index + m[0].length) return m[0];
	}
	return null;
}

export function classifyText(text: string): TextType {
	const t = text.trim();
	if (!t || !/\p{L}/u.test(t)) return 'invalid';
	return 'word'; // AI judges phrase vs sentence
}

export function getWordAtMousePosition(editor: Editor, evt: MouseEvent): string | null {
	const cm = (editor as any).cm;
	if (!cm?.posAtCoords) return null;
	const offset: number | null = cm.posAtCoords({ x: evt.clientX, y: evt.clientY });
	if (offset === null) return null;
	const lineObj = cm.state.doc.lineAt(offset);
	const lineText: string = lineObj.text;
	const ch = offset - lineObj.from;
	const wordRegex = /[\p{L}\p{N}'-]+/gu;
	let m: RegExpExecArray | null;
	while ((m = wordRegex.exec(lineText)) !== null) {
		if (ch >= m.index && ch <= m.index + m[0].length) return m[0];
	}
	return null;
}

export function getVocabTermAtPosition(
	editor: Editor, evt: MouseEvent, vocabTerms: VocabularyTerm[]
): VocabularyTerm | null {
	const cm = (editor as any).cm;
	if (!cm?.posAtCoords) return null;
	const offset: number | null = cm.posAtCoords({ x: evt.clientX, y: evt.clientY });
	if (offset === null) return null;
	const docText = editor.getValue();
	const lowerText = docText.toLowerCase();
	for (const term of vocabTerms) {
		const lower = term.text.toLowerCase();
		const len = term.text.length;
		const scanStart = Math.max(0, offset - len + 1);
		for (let i = scanStart; i <= offset && i + len <= docText.length; i++) {
			if (lowerText.slice(i, i + len) !== lower) continue;
			const beforeOk = i === 0 || !/[\p{L}\p{N}'-]/u.test(docText[i - 1]);
			const afterOk = i + len >= docText.length || !/[\p{L}\p{N}'-]/u.test(docText[i + len]);
			if (!beforeOk || !afterOk) continue;
			if (offset >= i && offset < i + len) return term;
		}
	}
	return null;
}

export function getSelectionEndCoords(app: { workspace: any }): { right: number; top: number } | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return null;
	const cm = (view.editor as any).cm;
	if (!cm?.coordsAtPos) return null;
	const cursorTo = view.editor.getCursor('to');
	const coords = cm.coordsAtPos(view.editor.posToOffset(cursorTo));
	return coords ?? null;
}
