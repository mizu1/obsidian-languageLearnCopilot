/**
 * ContextManager — builds structured context from full text + selection position.
 * Caches the last built context to avoid redundant work.
 */

import { Context } from '../../types';

export interface BuiltContext {
	before: string;
	selected: string;
	after: string;
}

export class ContextManager {
	private last: BuiltContext | null = null;

	buildContext(
		fullText: string,
		selectionStart: number,
		selectionEnd: number,
		radius: number
	): BuiltContext {
		const start = Math.max(0, selectionStart - radius);
		const end = Math.min(fullText.length, selectionEnd + radius);

		const ctx: BuiltContext = {
			before: fullText.slice(start, selectionStart),
			selected: fullText.slice(selectionStart, selectionEnd),
			after: fullText.slice(selectionEnd, end),
		};

		this.last = ctx;
		return ctx;
	}

	buildFromTaskContext(ctx: Context): Context {
		return {
			before: ctx.before,
			selected: ctx.selected,
			after: ctx.after,
		};
	}

	getLastContext(): BuiltContext | null {
		return this.last;
	}
}
