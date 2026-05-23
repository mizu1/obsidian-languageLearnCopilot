/**
 * Shared type definitions for Language Learn Plugin.
 * UI layer uses these types to communicate with Agent layer.
 */

// ── Language ──

export const LANGUAGE_OPTIONS = {
	'zh-CN': '中文',
	'en': 'English',
	'ja': '日本語',
} as const;

export type LanguageCode = keyof typeof LANGUAGE_OPTIONS;

// ── Model Provider ──

export const PROVIDER_OPTIONS = {
	openai: 'OpenAI',
	deepseek: 'DeepSeek',
	gemini: 'Gemini',
} as const;

export type ModelProvider = keyof typeof PROVIDER_OPTIONS;

export const PROVIDER_DEFAULTS: Record<ModelProvider, { endpoint: string; models: string[] }> = {
	openai:   { endpoint: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] },
	deepseek: { endpoint: 'https://api.deepseek.com',   models: ['deepseek-chat', 'deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-reasoner'] },
	gemini:   { endpoint: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'] },
};

// ── Plugin Settings ──

export interface PluginSettings {
	// AI
	provider: ModelProvider;
	apiEndpoint: string;
	apiKey: string;
	model: string;

	// Language
	nativeLanguage: LanguageCode;
	targetLanguage: LanguageCode;

	// Storage
	wordNotesFolder: string;
	phraseNotesFolder: string;

	// Hover
	hoverEnabled: boolean;
	hoverFields: ('meaning' | 'etymology' | 'example')[];
	hoverMaxWidth: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	provider: 'openai',
	apiEndpoint: 'https://api.openai.com/v1',
	apiKey: '',
	model: 'gpt-3.5-turbo',
	nativeLanguage: 'en',
	targetLanguage: 'en',
	wordNotesFolder: '_word_notes',
	phraseNotesFolder: '_phrase_notes',
	hoverEnabled: true,
	hoverFields: ['meaning', 'etymology', 'example'],
	hoverMaxWidth: 400,
};

// ── Task types ──

export type TaskType = 'explain' | 'reinterpret' | 'relation';

export type TextType = 'word' | 'phrase' | 'sentence' | 'paragraph' | 'invalid';

// ── Context ──

export interface Context {
	before: string;
	selected: string;
	after: string;
}

// ── AgentTask (pure data carrier, matches Agent architecture) ──

export interface AgentTask {
	type: TaskType;
	selectedText: string;
	context: Context;
	originalNote?: string;
	wordList?: string[];
	preliminaryType?: TextType;
}

// ── AIResult ──

export interface AIResult {
	content: string;
	validationPassed: boolean;
	metadata?: Record<string, unknown>;
}

// ── TaskExecutor (minimal interface for UI → Agent) ──

export interface TaskExecutor {
	execute(task: AgentTask): Promise<AIResult>;
}

// ── Word Cache ──

export interface WordCacheEntry {
	path: string;
	type: 'word' | 'phrase';
	meaning: string;
	etymology?: string;
	collocations: string[];
	relatedWords: { word: string; relation: string }[];
	sentenceExamples: { sentence: string; analysis: string }[];
	lastModified: number;
	relationFlags: {
		synonym: -1 | 0 | 1;
		antonym: -1 | 0 | 1;
		cognate: -1 | 0 | 1;
	};
}

// ── Progress ──

export interface ProgressLog {
	stage: 'synonym' | 'antonym' | 'cognate';
	total: number;
	processed: number;
	currentBatch: string[];
	message?: string;
}

// ── Chat ──

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: number;
}
