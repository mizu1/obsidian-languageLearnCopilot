/**
 * Interpreter — LangChain-based AI executor.
 *
 * Flow:
 *   1. Receive AgentTask
 *   2. SkillManager provides system prompt
 *   3. Only 2 tools exposed to AI: writeWordExplanation, writePhraseExplanation
 *   4. Call AI → handle tool calls → detect write results → return with metadata.path
 *   5. ResultValidator checks output
 *   6. Retry on failure (max 3 times)
 */

import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import {
	AgentTask, AIResult, TaskExecutor,
	PluginSettings, TextType,
} from '../../types';
import { SkillManager } from './SkillManager';
import { ContextManager } from './ContextManager';
import { ResultValidator } from './ResultValidator';
import { ToolsManager } from '../ToolsManager';
import { createChatModel } from '../ModelFactory';
import { buildUserMessage } from '../UserMessageBuilder';

const WRITE_TOOLS = ['writeWordExplanation', 'writePhraseExplanation'];

export class Interpreter implements TaskExecutor {
	public settings: PluginSettings;
	public skillManager: SkillManager;
	private contextManager: ContextManager;
	public toolsManager: ToolsManager;
	private validator: ResultValidator;

	constructor(
		settings: PluginSettings,
		skillManager: SkillManager,
		toolsManager: ToolsManager,
	) {
		this.settings = settings;
		this.skillManager = skillManager;
		this.toolsManager = toolsManager;
		this.contextManager = new ContextManager();
		this.validator = new ResultValidator();
	}

	configure(modelName: string, apiKey: string, apiEndpoint: string): void {
		this.settings.model = modelName;
		this.settings.apiKey = apiKey;
		this.settings.apiEndpoint = apiEndpoint;
	}

	async execute(task: AgentTask): Promise<AIResult> {
		console.log('[Interpreter] task:', task.type, task.selectedText?.slice(0, 40));

		// Reinterpret 使用独立的系统 prompt（强调先分析再决定，不跳步）
		const skillName = task.type === 'reinterpret' ? 'reinterpret' : 'interpreter';
		const skill = await this.skillManager.loadTemplate(skillName);

		const toolsForAI = this.getToolsForAI(task);
		const userMessage = buildUserMessage(task);

		const skipValidation = task.type === 'reinterpret';

		try {
			return await this.invokeWithRetry(skill, toolsForAI, userMessage, task.preliminaryType || 'word', skipValidation);
		} catch (e) {
			console.error('[Interpreter] execute 异常:', e);
			throw e;
		}
	}

	async invoke(
		systemPrompt: string,
		userMessage: string,
		tools: Array<{ type: 'function'; function: any }>,
		fixPrompt?: string,
		history?: Array<{ role: 'user' | 'assistant'; content: string }>
	): Promise<{ content: string; metadata?: Record<string, unknown> }> {
		console.log('[Interpreter] === AI 调用 ===');
		console.log('[Interpreter] 模型:', this.settings.model, 'provider:', this.settings.provider);
		console.log('[Interpreter] 工具:', tools.map(t => t.function.name));
		console.log('[Interpreter] System(前200):', systemPrompt.slice(0, 200));
		console.log('[Interpreter] User(全文):\n' + userMessage);

		const model = createChatModel(this.settings);
		const modelWithTools = tools.length > 0 ? model.bindTools(tools) : model;

		const messages: Array<SystemMessage | HumanMessage | AIMessage | ToolMessage> = [
			new SystemMessage(systemPrompt + (fixPrompt ? `\n\n${fixPrompt}` : '')),
		];

		// Include history for chat context
		if (history) {
			for (const h of history.slice(-10)) {
				if (h.role === 'user') messages.push(new HumanMessage(h.content));
				else messages.push(new AIMessage(h.content));
			}
		}

		messages.push(new HumanMessage(userMessage));

		let response = await modelWithTools.invoke(messages);
		console.log('[Interpreter] tool_calls:', response.tool_calls?.length || 0);

		const maxRounds = 5;
		let round = 0;

		while (response.tool_calls?.length && round < maxRounds) {
			messages.push(new AIMessage({
				content: response.content as string,
				tool_calls: response.tool_calls as any,
			}));

			for (const tc of response.tool_calls) {
				console.log(`[Interpreter] 执行: ${tc.name}`, tc.args);
				const result = await this.toolsManager.execute(tc.name, tc.args);
				console.log(`[Interpreter] 结果: ${result.slice(0, 100)}`);

				if (WRITE_TOOLS.includes(tc.name) && result.startsWith('success:')) {
					const path = result.replace('success:', '').trim();
					console.log('[Interpreter] 写入成功，跳过后续 AI 调用');
					return { content: '', metadata: { path } };
				}

				messages.push(new ToolMessage({
					content: result,
					tool_call_id: tc.id!,
				}));
			}

			response = await modelWithTools.invoke(messages);
			round++;
		}

		const content = typeof response.content === 'string'
			? response.content
			: JSON.stringify(response.content);

		console.log('[Interpreter] 输出(前200):', content.slice(0, 200));
		return { content };
	}

	// ── Streaming (sidebar chat, no tools) ──

	async invokeStreaming(
		systemPrompt: string,
		userMessage: string,
		onChunk: (text: string) => void,
		history?: Array<{ role: 'user' | 'assistant'; content: string }>,
		tools?: Array<{ type: 'function'; function: any }>
	): Promise<string> {
		console.log('[Interpreter] === 流式调用 ===');
		const model = createChatModel(this.settings);
		const modelWithTools = tools?.length ? model.bindTools(tools) : model;

		const messages: Array<SystemMessage | HumanMessage | AIMessage | ToolMessage> = [
			new SystemMessage(systemPrompt),
		];

		// Include recent conversation history
		if (history) {
			const recent = history.slice(-10);
			for (const h of recent) {
				if (h.role === 'user') messages.push(new HumanMessage(h.content));
				else messages.push(new AIMessage(h.content));
			}
		}

		messages.push(new HumanMessage(userMessage));

		// Stream: collect content + detect tool calls
		let fullContent = '';
		let toolRounds = 0;
		const maxRounds = 5;

		while (toolRounds < maxRounds) {
			const stream = await modelWithTools.stream(messages);
			let roundContent = '';
			let toolCalls: any[] = [];

			// Accumulate tool call args manually — ChatDeepSeek streaming doesn't
			// stitch them back from deltas (known LangChain bug)
			const pendingCalls: Record<number, { name: string; args: string; id: string }> = {};

			for await (const chunk of stream) {
				// Accumulate tool call deltas
				if ((chunk as any).tool_call_chunks?.length) {
					for (const tc of (chunk as any).tool_call_chunks) {
						const idx = tc.index ?? 0;
						if (!pendingCalls[idx]) pendingCalls[idx] = { name: '', args: '', id: '' };
						if (tc.name) pendingCalls[idx].name += tc.name;
						if (tc.args) pendingCalls[idx].args += tc.args;
						if (tc.id) pendingCalls[idx].id = tc.id;
					}
				}
				// Final chunk with assembled tool_calls
				if (chunk.tool_calls?.length) {
					toolCalls = chunk.tool_calls;
				}
				const text = this.extractChunkText(chunk);
				if (text) {
					roundContent += text;
					fullContent += text;
					onChunk(text);
				}
			}

			// Patch: parse accumulated args back into toolCalls
			for (const [idx, p] of Object.entries(pendingCalls)) {
				if (!toolCalls[Number(idx)] && p.name) {
					const args = p.args ? (() => { try { return JSON.parse(p.args); } catch { return {}; } })() : {};
					toolCalls[Number(idx)] = { name: p.name, args, id: p.id };
				} else if (toolCalls[Number(idx)] && p.args) {
					// Fill in args that LangChain dropped
					try { toolCalls[Number(idx)].args = JSON.parse(p.args); } catch {}
				}
			}

			// No tool calls → done
			if (!toolCalls.length) break;

			onChunk('\n\n');
			messages.push(new AIMessage({ content: roundContent, tool_calls: toolCalls }));

			for (const tc of toolCalls) {
				console.log('[Interpreter] raw tool_call:', JSON.stringify({ name: tc.name, args: tc.args, id: tc.id }).slice(0, 300));
				const args = { ...(tc.args || {}) };
				// Some models put args as JSON string
				if (typeof args === 'string') {
					try { Object.assign(args, JSON.parse(args)); } catch {}
				}
				const result = await this.toolsManager.execute(tc.name, args);
				messages.push(new ToolMessage({ content: result, tool_call_id: tc.id! }));
				onChunk(`\`\`\`\n${result.slice(0, 2000)}\n\`\`\`\n\n`);
			}

			toolRounds++;
		}

		console.log('[Interpreter] 流式输出(前200):', fullContent.slice(0, 200));
		return fullContent;
	}

	private extractChunkText(chunk: any): string {
		if (typeof chunk.content === 'string') return chunk.content;
		if (Array.isArray(chunk.content)) {
			return chunk.content.map((c: any) => c.text || '').join('');
		}
		return '';
	}

	private async invokeWithRetry(
		skill: string,
		tools: Array<{ type: 'function'; function: any }>,
		userMessage: string,
		expectedFormat: TextType,
		skipValidation = false,
	): Promise<AIResult> {
		const maxRetries = skipValidation ? 1 : 3;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			const fixPrompt = attempt > 1 ? this.lastFixPrompt : undefined;
			const { content, metadata } = await this.invoke(skill, userMessage, tools, fixPrompt);
			const result: AIResult = { content, validationPassed: true, metadata };

			// Write tool succeeded → skip validation, return immediately
			if (metadata?.path) return result;

			// Translation / hint → no structural validation needed
			if (expectedFormat === 'sentence' || expectedFormat === 'paragraph') {
				return result;
			}

			const format = expectedFormat === 'phrase' ? 'phrase' : 'word';
			const validation = this.validator.validate(result, format);

			if (validation.valid) return result;

			this.lastFixPrompt = this.validator.generateFixPrompt(validation);
			if (attempt === maxRetries) {
				result.validationPassed = false;
				result.metadata = { ...result.metadata, validationError: validation.reason, attempts: attempt };
				return result;
			}
		}

		return { content: 'AI 调用失败', validationPassed: false };
	}

	private lastFixPrompt: string | undefined;

	// Only expose write tools to AI — no file-read/list tools (plugin handles that)
	private getToolsForAI(_task: AgentTask): Array<{ type: 'function'; function: any }> {
		const all = this.toolsManager.formatForOpenAI();
		return all.filter(t => WRITE_TOOLS.includes(t.function.name));
	}
}
