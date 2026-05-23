/**
 * InteractionCoordinator — sole mediator between UI Views and Agent layer.
 * All Views call this coordinator instead of touching Agent directly.
 */

import {
	AgentTask, AIResult, ChatMessage, Context,
	PluginSettings, ProgressLog, TaskExecutor,
	TextType, WordCacheEntry,
} from '../types';
import { WordIndexCache } from '../cache/WordIndexCache';

export class InteractionCoordinator {
	private executor: TaskExecutor;
	private cache: WordIndexCache;
	private settings: PluginSettings;
	private history: ChatMessage[] = [];
	private progressCallback: ((log: ProgressLog) => void) | null = null;
	private skillManager: any = null;

	constructor(executor: TaskExecutor, settings: PluginSettings) {
		this.executor = executor;
		this.settings = settings;
		this.cache = new WordIndexCache(1000);
	}

	// ── Settings ──

	updateSettings(settings: PluginSettings): void {
		this.settings = settings;
	}

	// ── Analyze selected text (calls AI) ──

	async analyzeSelectedText(
		text: string,
		context: Context,
		type: TextType
	): Promise<AIResult> {
		const task: AgentTask = {
			type: 'explain',
			selectedText: text,
			context,
			preliminaryType: type,
		};

		const result = await this.executor.execute(task);
		this.appendHistory('assistant', result.content);
		return result;
	}

	// ── Hover lookup (cache only, no AI) ──

	getWordInfo(word: string): WordCacheEntry | null {
		return this.cache.get(this.cache.normalize(word));
	}

	// ── Reinterpret in context (calls AI) ──

	async reinterpretInContext(
		word: string,
		context: string,
		originalNote: string
	): Promise<AIResult> {
		const task: AgentTask = {
			type: 'reinterpret',
			selectedText: word,
			context: { before: context, selected: word, after: '' },
			originalNote,
			preliminaryType: 'word',
		};

		const result = await this.executor.execute(task);
		this.appendHistory('assistant', result.content);
		return result;
	}

	// ── Confirm append to note ──

	async confirmAppendToNote(word: string, _newContent: string): Promise<void> {
		// TODO: Wire to Agent's writeNote tool when Agent layer is built
		this.cache.invalidate(this.cache.normalize(word));
	}

	// ── Relation graph generation ──

	private relationMgr: any = null;

	setRelationManager(mgr: any): void {
		this.relationMgr = mgr;
	}

	async generateRelationGraph(
		terms: { text: string }[],
		wordFolder: string,
		onComplete?: () => void
	): Promise<void> {
		if (!this.relationMgr) throw new Error('RelationManager not set');
		if (this.relationMgr.isRunning) { onComplete?.(); return; }
		this.relationMgr.setProgressHandler(
			(type: string, done: number, total: number) => {
				this.notifyProgress({
					stage: type as ProgressLog['stage'],
					total, processed: done,
					currentBatch: [],
				});
			}
		);
		this.relationMgr.setCompleteHandler(() => {
			this.notifyProgress({ stage: 'synonym' as any, total: 1, processed: 1, currentBatch: [], message: 'completed' });
			onComplete?.();
		});
		await this.relationMgr.generateAll(terms, wordFolder);
	}

	// ── Manual chat (streaming) ──

	async sendUserMessageStreaming(
		msg: string,
		onChunk: (text: string) => void
	): Promise<void> {
		this.appendHistory('user', msg);
		const interpreter = this.executor as any;
		const skill = await this.skillManager?.loadTemplate('chat') ??
			`你是语言学习助手。用户使用 ${this.settings.nativeLanguage}，正在学习 ${this.settings.targetLanguage}。`;

		if (typeof interpreter.invokeStreaming === 'function') {
			const readTools = (interpreter.toolsManager?.formatForOpenAI?.() || [])
				.filter((t: any) =>
					t.function.name === 'readFileContent' ||
					t.function.name === 'readDirectoryStructure' ||
					t.function.name === 'searchFiles'
				);
			const full = await interpreter.invokeStreaming(
				skill, msg, onChunk,
				this.history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
				readTools
			);
			this.appendHistory('assistant', full);
		} else {
			const result = await this.sendUserMessage(msg);
			onChunk(result.content);
		}
	}

	async sendUserMessage(msg: string): Promise<AIResult> {
		this.appendHistory('user', msg);
		const task: AgentTask = {
			type: 'explain', selectedText: msg,
			context: { before: '', selected: msg, after: '' },
			preliminaryType: 'sentence',
		};
		const result = await this.executor.execute(task);
		this.appendHistory('assistant', result.content);
		return result;
	}

	setSkillManager(sm: any): void { this.skillManager = sm; }

	// ── Cache operations ──

	updateCache(word: string, entry: WordCacheEntry): void {
		this.cache.set(this.cache.normalize(word), entry);
	}

	rebuildCache(entries: Map<string, WordCacheEntry>): void {
		this.cache.rebuild(entries);
	}

	invalidateCache(word: string): void {
		this.cache.invalidate(this.cache.normalize(word));
	}

	// ── Conversation history ──

	getConversationHistory(): ChatMessage[] {
		return [...this.history];
	}

	clearHistory(): void {
		this.history = [];
	}

	// ── Progress callback ──

	onProgress(callback: (log: ProgressLog) => void): void {
		this.progressCallback = callback;
	}

	// ── Private ──

	private appendHistory(role: ChatMessage['role'], content: string): void {
		this.history.push({ role, content, timestamp: Date.now() });
		if (this.history.length > 100) {
			this.history.shift();
		}
	}

	private notifyProgress(log: ProgressLog): void {
		this.progressCallback?.(log);
	}
}
