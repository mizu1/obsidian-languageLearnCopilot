/**
 * File operation tools: read, write, replace, list directory.
 * All operate on the Obsidian vault through a Vault reference.
 */

import { Vault, TFile, TFolder } from 'obsidian';
import { Tool, ToolDef } from './types';

// ── Tool: readDirectoryStructure ──

function readDirDef(): ToolDef {
	return {
		name: 'readDirectoryStructure',
		strict: true,
		description:
			'列出指定目录下的所有文件和文件夹。' +
			'使用 "/" 表示仓库根目录。' +
			'文件夹在结果中带 / 后缀，文件不带。',
		parameters: {
			type: 'object',
			properties: {
				dirPath: {
					type: 'string',
					description:
						'目录的完整路径。' +
						'根目录: "/"。' +
						'示例: "/"、"_word_notes"、"架构图"、"prompt/system_prompt"。' +
						'不填默认显示根目录。',
				},
			},
			required: [],
			additionalProperties: false,
		},
	};
}

function makeReadDir(vault: Vault): (args: Record<string, unknown>) => Promise<string> {
	return async (args) => {
		const dirPath = (args.dirPath as string) || '/';
		const folder = vault.getAbstractFileByPath(dirPath);
		if (!folder || !(folder as any).children) {
			return `failure: 目录 "${dirPath}" 不存在或不是文件夹`;
		}
		const children = (folder as any).children as TFile[];
		const lines = children.map(f => `  - ${f.name}`).join('\n');
		return `目录 ${dirPath} (${children.length} 个文件):\n${lines}`;
	};
}

// ── Tool: readFileContent ──

function readFileDef(): ToolDef {
	return {
		name: 'readFileContent',
		strict: true,
		description: '读取指定文件的完整内容。支持 .md .canvas .json 等格式。',
		parameters: {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description:
						'文件的完整路径，包含扩展名。' +
						'示例: "_word_notes/apple.md"、' +
						'"架构图/agent架构图.canvas"、' +
						'"prompt/system_prompt/interpreter.system.md"、' +
						'"欢迎.md"。',
				},
			},
			required: ['filePath'],
			additionalProperties: false,
		},
	};
}

function makeReadFile(vault: Vault): (args: Record<string, unknown>) => Promise<string> {
	return async (args) => {
		const filePath = args.filePath as string;
		if (!filePath) return `错误: 缺少必填参数 filePath。请指定文件路径，例如 "_word_notes/apple.md" 或 "架构图/agent架构图.canvas"。`;
		const file = vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			return `failure: 文件 "${filePath}" 不存在`;
		}
		return await vault.read(file);
	};
}

// ── Tool: overwriteFile ──

function overwriteDef(): ToolDef {
	return {
		name: 'overwriteFile',
		description: '覆盖写入文件内容。如果文件不存在则创建，存在则完全覆盖',
		parameters: {
			type: 'object',
			properties: {
				filePath: { type: 'string', description: '目标文件路径' },
				content: { type: 'string', description: '要写入的完整内容' },
			},
			required: ['filePath', 'content'],
		},
	};
}

function makeOverwrite(vault: Vault): (args: Record<string, unknown>) => Promise<string> {
	return async (args) => {
		const filePath = args.filePath as string;
		const content = args.content as string;
		const existing = vault.getAbstractFileByPath(filePath);

		if (existing instanceof TFile) {
			await vault.modify(existing, content);
		} else {
			await vault.create(filePath, content);
		}
		return 'success';
	};
}

// ── Tool: replaceFileContent ──

function replaceDef(): ToolDef {
	return {
		name: 'replaceFileContent',
		description: '替换文件中的部分内容（精确字符串匹配），返回替换后的完整内容',
		parameters: {
			type: 'object',
			properties: {
				filePath: { type: 'string', description: '目标文件路径' },
				target: { type: 'string', description: '要被替换的字符串（必须精确匹配）' },
				replacement: { type: 'string', description: '替换后的字符串' },
			},
			required: ['filePath', 'target', 'replacement'],
		},
	};
}

function makeReplace(vault: Vault): (args: Record<string, unknown>) => Promise<string> {
	return async (args) => {
		const filePath = args.filePath as string;
		const target = args.target as string;
		const replacement = args.replacement as string;

		const file = vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			return `failure: 文件 "${filePath}" 不存在`;
		}

		const raw = await vault.read(file);
		if (!raw.includes(target)) {
			return `failure: 未找到目标字符串 "${target.slice(0, 50)}..."`;
		}

		const updated = raw.replace(target, replacement);
		await vault.modify(file, updated);
		return 'success\n' + updated;
	};
}

// ── Tool: searchFiles ──

function searchDef(): ToolDef {
	return {
		name: 'searchFiles',
		strict: true,
		description:
			'根据关键词搜索仓库中匹配的文件路径。' +
			'用于不确定文件确切路径时查找。' +
			'关键词可以是文件名或路径片段，不区分大小写。',
		parameters: {
			type: 'object',
			properties: {
				keyword: {
					type: 'string',
					description:
						'搜索关键词。匹配文件路径中包含该词的条目。' +
						'例如: "架构图" 会匹配 "架构图/agent架构图.canvas"、' +
						'"word" 会匹配 "_word_notes/apple.md"。',
				},
			},
			required: ['keyword'],
			additionalProperties: false,
		},
	};
}

function makeSearch(vault: Vault): (args: Record<string, unknown>) => Promise<string> {
	return async (args) => {
		const keyword = (args.keyword as string || '').toLowerCase();
		if (!keyword) return '错误: 缺少关键词参数';

		const results: string[] = [];
		const walk = (folder: TFolder, prefix: string) => {
			for (const child of (folder as any).children || []) {
				const path = prefix ? `${prefix}/${child.name}` : child.name;
				if (path.toLowerCase().includes(keyword)) {
					results.push(child instanceof TFolder ? `${path}/` : path);
				}
				if (child instanceof TFolder && results.length < 50) {
					walk(child, path);
				}
			}
		};

		const root = vault.getRoot();
		walk(root, '');

		if (results.length === 0) return `未找到匹配 "${keyword}" 的文件或文件夹`;
		return `搜索 "${keyword}" (${results.length} 条):\n${results.map(r => `  - ${r}`).join('\n')}`;
	};
}

// ── Factory ──

export interface FileTools {
	readDirectoryStructure: Tool;
	readFileContent: Tool;
	overwriteFile: Tool;
	replaceFileContent: Tool;
	searchFiles: Tool;
}

export function createFileTools(vault: Vault): FileTools {
	return {
		readDirectoryStructure: { def: readDirDef(), execute: makeReadDir(vault) },
		readFileContent:       { def: readFileDef(), execute: makeReadFile(vault) },
		overwriteFile:         { def: overwriteDef(), execute: makeOverwrite(vault) },
		replaceFileContent:    { def: replaceDef(), execute: makeReplace(vault) },
		searchFiles:           { def: searchDef(), execute: makeSearch(vault) },
	};
}
