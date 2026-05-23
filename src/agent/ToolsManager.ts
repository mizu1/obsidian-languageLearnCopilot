/**
 * ToolsManager — registers tools, formats them for AI providers,
 * and dispatches tool calls from AI responses.
 */

import { Tool, ToolDef } from './tools/types';
import { FileTools, createFileTools } from './tools/fileTools';
import { NoteTools, createNoteTools } from './tools/noteTools';
import { Vault } from 'obsidian';

export type ModelType = 'openai' | 'anthropic' | 'google';

export class ToolsManager {
	private tools: Map<string, Tool> = new Map();
	public readonly file: FileTools;
	public readonly note: NoteTools;

	constructor(vault: Vault) {
		this.file = createFileTools(vault);
		this.note = createNoteTools(vault);

		this.register(this.file.readDirectoryStructure);
		this.register(this.file.readFileContent);
		this.register(this.file.searchFiles);
		this.register(this.file.overwriteFile);
		this.register(this.file.replaceFileContent);
		this.register(this.note.writeWordExplanation);
		this.register(this.note.writePhraseExplanation);
	}

	register(tool: Tool): void {
		this.tools.set(tool.def.name, tool);
	}

	get(name: string): Tool | undefined {
		return this.tools.get(name);
	}

	/**
	 * Execute a tool by name with given arguments.
	 * Returns the tool's result string.
	 */
	async execute(name: string, args: Record<string, unknown>): Promise<string> {
		const tool = this.tools.get(name);
		if (!tool) return `failure: 未知工具 "${name}"`;
		return tool.execute(args);
	}

	/**
	 * Format all tools for OpenAI function calling.
	 * Returns array of { type: 'function', function: ToolDef }
	 */
	formatForOpenAI(): Array<{ type: 'function'; function: ToolDef }> {
		const result: Array<{ type: 'function'; function: ToolDef }> = [];
		for (const tool of this.tools.values()) {
			result.push({ type: 'function', function: tool.def });
		}
		return result;
	}

	/**
	 * Format all tools for the specified model provider.
	 */
	formatTools(modelType: ModelType): unknown {
		switch (modelType) {
			case 'openai':
				return this.formatForOpenAI();
			case 'anthropic':
			case 'google':
				// Future: adapt format for other providers
				return this.formatForOpenAI();
			default:
				return this.formatForOpenAI();
		}
	}

	getToolNames(): string[] {
		return Array.from(this.tools.keys());
	}

	get count(): number {
		return this.tools.size;
	}
}
