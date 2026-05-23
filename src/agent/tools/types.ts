/**
 * Tool type definitions for AI function calling.
 * Tools are the only way the AI interacts with the vault.
 */

// ── Function calling definition (OpenAI-compatible) ──

export interface ToolParam {
	type: string;
	description: string;
	enum?: string[];
	items?: { type: string };
}

export interface ToolDef {
	name: string;
	description: string;
	strict?: boolean;
	parameters: {
		type: 'object';
		properties: Record<string, ToolParam>;
		required: string[];
		additionalProperties?: boolean;
	};
}

// ── Executable tool ──

export interface Tool {
	def: ToolDef;
	execute(args: Record<string, unknown>): Promise<string>;
}
