/**
 * Note creation tools: writeWordExplanation, writePhraseExplanation.
 * Produce structured Markdown with frontmatter.
 */

import { Vault, TFile } from 'obsidian';
import { Tool, ToolDef } from './types';

// ── Tool: writeWordExplanation ──

function wordDef(): ToolDef {
	return {
		name: 'writeWordExplanation',
		description:
			'生成并写入单词的结构化笔记。' +
			'包含 frontmatter（词、类型、创建时间）和正文（含义、构词法、派生含义、例句分析、常见用法）。' +
			'如果笔记已存在，追加新的例句和语境分析。',
		parameters: {
			type: 'object',
			properties: {
				dirPath:           { type: 'string', description: '存放笔记的目录路径，如 _word_notes' },
				word:              { type: 'string', description: '单词本身' },
				morphology:        { type: 'string', description: '构词法分析，如 "词根+前缀"。没有则留空字符串' },
				coreMeaning:       { type: 'string', description: '核心含义，必须标注词性，如 "n. 苹果"、"v. 打破"、"adj. 美丽的"' },
			pronunciation:     { type: 'string', description: '音标/读音标注。英语用 IPA 如 /ˈæp.əl/，日语用平假名，中文用拼音，其他语言用对应体系' },
				derivedMeanings:   {
					type: 'array',
					description: '派生含义列表，每项格式 "含义: 派生方式"，说明如何从核心含义演化而来。如 "考验: 由核心含义\'测试\'引申"',
					items: { type: 'string' },
				},
				exampleSentences:  {
					type: 'array',
					description: '例句列表，每项格式为 "句子 → 分析"',
					items: { type: 'string' },
				},
				commonUsages:      {
					type: 'array',
					description: '常见用法列表',
					items: { type: 'string' },
				},
			},
			required: ['dirPath', 'word', 'coreMeaning'],
		},
	};
}

function makeWriteWord(vault: Vault): (args: Record<string, unknown>) => Promise<string> {
	return async (args) => {
		const dirPath    = args.dirPath as string;
		const word       = (args.word as string).trim();
		const morphology = (args.morphology as string) || '';
		const coreMeaning = (args.coreMeaning as string).trim();
		const pronunciation = (args.pronunciation as string) || '';
		const derivedMeanings = Array.isArray(args.derivedMeanings) ? args.derivedMeanings : [];
		const exampleSentences = Array.isArray(args.exampleSentences) ? args.exampleSentences : [];
		const commonUsages = Array.isArray(args.commonUsages) ? args.commonUsages : [];

		const fileName = word.toLowerCase().replace(/[#?\[\]\/\\:*"<>|]/g, '_');
		const filePath = `${dirPath}/${fileName}.md`;

		// Build frontmatter
		const date = new Date().toISOString().split('T')[0];
		let content = `---
词: ${word}
类型: word
创建时间: ${date}
---

## 含义
${coreMeaning}
`;

		if (pronunciation) {
			content += `
## 读音
${pronunciation}
`;
		}

		if (morphology) {
			content += `
## 构词法
${morphology}
`;
		}

		if (derivedMeanings.length > 0) {
			content += `
## 派生含义
${derivedMeanings.map(d => `- ${d}`).join('\n')}
`;
		}

		if (exampleSentences.length > 0) {
			content += `
## 例句与语境分析
${exampleSentences.map(e => {
	const parts = e.split('→');
	const sentence = parts[0]?.trim() || '';
	const analysis = parts.slice(1).join('→').trim();
	return `- "${sentence}" → ${analysis}`;
}).join('\n')}
`;
		}

		if (commonUsages.length > 0) {
			content += `
## 常见用法
${commonUsages.map(u => `- ${u}`).join('\n')}
`;
		}

		// Write or append
		const existing = vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			const raw = await vault.read(existing);
			// Append new example sentences after existing ones
			if (exampleSentences.length > 0) {
				const exampleBlock = exampleSentences.map(e => {
					const parts = e.split('→');
					const s = parts[0]?.trim() || '';
					const a = parts.slice(1).join('→').trim();
					return `- "${s}" → ${a}`;
				}).join('\n');
				const updated = raw.trimEnd() + '\n' + exampleBlock + '\n';
				await vault.modify(existing, updated);
			}
		} else {
			// Ensure folder exists
			const folder = vault.getAbstractFileByPath(dirPath);
			if (!folder) {
				await vault.createFolder(dirPath);
			}
			await vault.create(filePath, content);
		}

		return `success: ${filePath}`;
	};
}

// ── Tool: writePhraseExplanation ──

function phraseDef(): ToolDef {
	return {
		name: 'writePhraseExplanation',
		description:
			'生成并写入短语的结构化笔记。' +
			'包含 frontmatter（词、类型、创建时间）和正文（含义、词内单词含义、语法/历史背景、例句分析）。' +
			'如果笔记已存在，追加新的例句。',
		parameters: {
			type: 'object',
			properties: {
				dirPath:          { type: 'string', description: '存放笔记的目录路径，如 _phrase_notes' },
				phrase:           { type: 'string', description: '短语本身' },
				coreMeaning:      { type: 'string', description: '短语的整体含义' },
				wordMeanings:     {
					type: 'array',
					description: '短语内各单词含义，每项格式 "单词: 含义"',
					items: { type: 'string' },
				},
				grammarBackground: { type: 'string', description: '语法解释或历史背景' },
				exampleSentences:  {
					type: 'array',
					description: '例句列表，每项格式 "句子 → 分析"',
					items: { type: 'string' },
				},
			},
			required: ['dirPath', 'phrase', 'coreMeaning'],
		},
	};
}

function makeWritePhrase(vault: Vault): (args: Record<string, unknown>) => Promise<string> {
	return async (args) => {
		const dirPath = args.dirPath as string;
		const phrase = (args.phrase as string).trim();
		const coreMeaning = (args.coreMeaning as string).trim();
		const wordMeanings = Array.isArray(args.wordMeanings) ? args.wordMeanings : [];
		const grammarBg = (args.grammarBackground as string) || '';
		const exampleSentences = (args.exampleSentences as string[]) || [];

		const fileName = phrase.toLowerCase()
			.replace(/[#?\[\]\/\\:*"<>|]/g, '_')
			.replace(/\s+/g, '_');
		const filePath = `${dirPath}/${fileName}.md`;

		const date = new Date().toISOString().split('T')[0];
		let content = `---
词: ${phrase}
类型: phrase
创建时间: ${date}
---

## 含义
${coreMeaning}
`;

		if (wordMeanings.length > 0) {
			content += `
## 短语内单词含义
${wordMeanings.map(w => `- ${w}`).join('\n')}
`;
		}

		if (grammarBg) {
			content += `
## 语法与背景
${grammarBg}
`;
		}

		if (exampleSentences.length > 0) {
			content += `
## 例句与语境分析
${exampleSentences.map(e => {
	const parts = e.split('→');
	const s = parts[0]?.trim() || '';
	const a = parts.slice(1).join('→').trim();
	return `- "${s}" → ${a}`;
}).join('\n')}
`;
		}

		const existing = vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			if (exampleSentences.length > 0) {
				const raw = await vault.read(existing);
				const block = exampleSentences.map(e => {
					const parts = e.split('→');
					const s = parts[0]?.trim() || '';
					const a = parts.slice(1).join('→').trim();
					return `- "${s}" → ${a}`;
				}).join('\n');
				await vault.modify(existing, raw.trimEnd() + '\n' + block + '\n');
			}
		} else {
			if (!vault.getAbstractFileByPath(dirPath)) {
				await vault.createFolder(dirPath);
			}
			await vault.create(filePath, content);
		}

		return `success: ${filePath}`;
	};
}

// ── Factory ──

export interface NoteTools {
	writeWordExplanation: Tool;
	writePhraseExplanation: Tool;
}

export function createNoteTools(vault: Vault): NoteTools {
	return {
		writeWordExplanation:  { def: wordDef(), execute: makeWriteWord(vault) },
		writePhraseExplanation: { def: phraseDef(), execute: makeWritePhrase(vault) },
	};
}
