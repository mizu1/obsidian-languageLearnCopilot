/**
 * UserMessageBuilder — constructs user messages for different task types.
 * Decoupled from Interpreter so each task type can have its own format.
 */

import { AgentTask } from '../types';

export function buildUserMessage(task: AgentTask): string {
	switch (task.type) {
		case 'reinterpret':
			return buildReinterpretMessage(task);
		case 'relation':
			return buildRelationMessage(task);
		case 'explain':
		default:
			return buildExplainMessage(task);
	}
}

function buildExplainMessage(task: AgentTask): string {
	const parts: string[] = [];
	parts.push(`选中的文本: "${task.selectedText}"`);

	if (task.context.before || task.context.after) {
		parts.push('上下文:');
		if (task.context.before) parts.push(`...${task.context.before}`);
		parts.push(`>>> ${task.selectedText} <<<`);
		if (task.context.after) parts.push(`${task.context.after}...`);
	}

	return parts.join('\n');
}

function buildReinterpretMessage(task: AgentTask): string {
	const parts: string[] = [];

	parts.push(`## 当前语境`);
	parts.push(`选中的文本: "${task.selectedText}"`);

	// Embed >>> <<< at the word's actual position in context
	const fullCtx = (task.context.before || '') + task.selectedText + (task.context.after || '');
	const wordIdx = fullCtx.toLowerCase().indexOf(task.selectedText.toLowerCase());

	if (wordIdx >= 0) {
		const ctxStart = Math.max(0, wordIdx - 300);
		const ctxEnd = Math.min(fullCtx.length, wordIdx + task.selectedText.length + 300);
		parts.push(
			`上下文: ...${fullCtx.slice(ctxStart, wordIdx)}` +
			`>>>${fullCtx.slice(wordIdx, wordIdx + task.selectedText.length)}<<<` +
			`${fullCtx.slice(wordIdx + task.selectedText.length, ctxEnd)}...`
		);
	} else if (task.context.before) {
		parts.push(`上下文: ...${task.context.before.slice(-300)} >>> ${task.selectedText} <<< ${(task.context.after || '').slice(0, 300)}...`);
	}

	parts.push(`\n## 原笔记内容`);
	parts.push(task.originalNote || '(无)');

	parts.push(`\n## 任务`);
	parts.push(`1. 判断原笔记中的解释是否适用于当前语境`);
	parts.push(`2. 如果适用 → 引用笔记中的对应内容进行解释，并引导用户思考为什么该解释在此处适用`);
	parts.push(`3. 如果不适用（发现了新的含义或用法）→ 先解释当前语境下的含义，然后调用 writeWordExplanation 补充新内容`);
	parts.push(`\n请直接开始分析，不需要调用工具来读取笔记。`);

	return parts.join('\n');
}

function buildRelationMessage(task: AgentTask): string {
	const words = task.wordList || [];
	return [
		'## 词汇列表',
		words.join(', '),
		'',
		'## 任务',
		'请分析这些词汇之间的关系（近义、反义、同源等），生成关系图谱。',
	].join('\n');
}
