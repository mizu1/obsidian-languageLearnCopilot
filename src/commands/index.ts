/**
 * Command definitions — 5 commands registered to Obsidian command palette.
 * All commands delegate to InteractionCoordinator.
 */

import { InteractionCoordinator } from '../coordinator/InteractionCoordinator';
import { Context, TextType } from '../types';

export const COMMAND_IDS = {
	ANALYZE_SELECTED: 'analyze-selected-text',
	FORCE_STORE: 'force-store-text',
	REANALYZE: 'reanalyze-current',
	GENERATE_RELATIONS: 'generate-relation-graph',
	REFRESH_INDEX: 'refresh-index',
} as const;

export interface CommandCallbacks {
	coordinator: InteractionCoordinator;
	getSelection: () => { text: string; context: Context; type: TextType } | null;
	getWordUnderCursor: () => string | null;
	refreshIndex: () => Promise<void>;
	generateRelations: () => Promise<void>;
}

export function registerCommands(
	plugin: { addCommand: (cmd: any) => void },
	callbacks: CommandCallbacks
): void {
	// 1. Analyze selected text
	plugin.addCommand({
		id: COMMAND_IDS.ANALYZE_SELECTED,
		name: '分析选中文本',
		icon: 'search',
		callback: async () => {
			const sel = callbacks.getSelection();
			if (!sel) return;
			await callbacks.coordinator.analyzeSelectedText(
				sel.text, sel.context, sel.type
			);
		},
	});

	// 2. Force store selected text
	plugin.addCommand({
		id: COMMAND_IDS.FORCE_STORE,
		name: '强制存储选中文本',
		icon: 'plus-circle',
		callback: async () => {
			const sel = callbacks.getSelection();
			if (!sel) return;
			// Force word-level analysis even for longer text
			await callbacks.coordinator.analyzeSelectedText(
				sel.text, sel.context, 'word'
			);
		},
	});

	// 3. Reanalyze current word/phrase under cursor
	plugin.addCommand({
		id: COMMAND_IDS.REANALYZE,
		name: '重新分析当前单词/短语',
		icon: 'refresh-cw',
		callback: async () => {
			const word = callbacks.getWordUnderCursor();
			if (!word) return;
			const cache = callbacks.coordinator.getWordInfo(word);
			await callbacks.coordinator.reinterpretInContext(
				word, '', cache?.meaning ?? ''
			);
		},
	});

	// 4. Generate relation graph
	plugin.addCommand({
		id: COMMAND_IDS.GENERATE_RELATIONS,
		name: '生成关系图谱',
		icon: 'git-branch',
		callback: async () => {
			await callbacks.generateRelations();
		},
	});

	// 5. Refresh index
	plugin.addCommand({
		id: COMMAND_IDS.REFRESH_INDEX,
		name: '刷新索引',
		icon: 'refresh-cw',
		callback: async () => {
			await callbacks.refreshIndex();
		},
	});
}
