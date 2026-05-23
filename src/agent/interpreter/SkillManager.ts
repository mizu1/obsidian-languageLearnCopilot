import { Vault } from 'obsidian';

const PROMPT_DIR = '.obsidian/plugins/language-learn/src/agent/prompts';

export class SkillManager {
	private vault: Vault;
	private cache: Map<string, string> = new Map();
	private sourceLanguage: string;
	private targetLanguage: string;

	constructor(vault: Vault, sourceLanguage: string, targetLanguage: string) {
		this.vault = vault;
		this.sourceLanguage = sourceLanguage;
		this.targetLanguage = targetLanguage;
	}

	updateLanguages(source: string, target: string): void {
		this.sourceLanguage = source;
		this.targetLanguage = target;
		this.cache.clear();
	}

	async loadTemplate(taskType: string): Promise<string> {
		const cached = this.cache.get(taskType);
		if (cached) return cached;

		const filePath = `${PROMPT_DIR}/${taskType}.system.md`;
		try {
			const raw = await this.vault.adapter.read(filePath);
			const filled = this.fill(raw);
			this.cache.set(taskType, filled);
			return filled;
		} catch {
			// Fallback: try interpreter prompt
			try {
				const raw = await this.vault.adapter.read(`${PROMPT_DIR}/interpreter.system.md`);
				const filled = this.fill(raw);
				this.cache.set(taskType, filled);
				return filled;
			} catch {
				return `你是语言学习助手。用 ${this.sourceLanguage} 解释 ${this.targetLanguage} 的文本。`;
			}
		}
	}

	getSkill(taskType: string): string { return this.cache.get(taskType) || ''; }

	async reloadTemplate(taskType: string): Promise<string> {
		this.cache.delete(taskType);
		return this.loadTemplate(taskType);
	}

	private fill(template: string): string {
		return template.replace(/\{sourceLanguage\}/g, this.sourceLanguage)
			.replace(/\{targetLanguage\}/g, this.targetLanguage);
	}
}
