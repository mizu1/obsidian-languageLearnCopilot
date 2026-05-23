import { Vault, TFile } from 'obsidian';
import { Interpreter } from '../agent/interpreter/Interpreter';
import { VocabularyTerm } from '../highlight/VocabularyScanner';

export type RelationType = 'synonym' | 'antonym' | 'cognate';

interface RelationFlags {
	synonym: -1 | 0 | 1;
	antonym: -1 | 0 | 1;
	cognate: -1 | 0 | 1;
}

export class RelationManager {
	private vault: Vault;
	private interpreter: Interpreter;
	private flags: Record<string, RelationFlags> = {};
	private onProgress?: (type: RelationType, done: number, total: number) => void;
	private onComplete?: () => void;
	isRunning = false;

	constructor(vault: Vault, interpreter: Interpreter) {
		this.vault = vault;
		this.interpreter = interpreter;
	}

	setProgressHandler(fn: (type: RelationType, done: number, total: number) => void): void {
		this.onProgress = fn;
	}

	setCompleteHandler(fn: () => void): void {
		this.onComplete = fn;
	}

	loadFlags(data: Record<string, RelationFlags>): void { this.flags = data || {}; }
	getFlags(): Record<string, RelationFlags> { return this.flags; }

	clearAllFlags(terms: VocabularyTerm[]): void {
		for (const t of terms) this.flags[t.text] = { synonym: 0, antonym: 0, cognate: 0 };
	}

	/** Remove synonym/antonym/cognate sections from all word notes */
	async clearAllLinks(terms: VocabularyTerm[], wordFolder: string): Promise<void> {
		for (const t of terms) {
			const fileName = t.text.toLowerCase().replace(/[#?\[\]\/\\:*"<>|]/g, '_');
			const path = `${wordFolder}/${fileName}.md`;
			const file = this.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) continue;
			const raw = await this.vault.read(file);
			// Remove sections: ## 同义词, ## 反义词, ## 同源词 and their content
			let cleaned = raw;
			for (const section of ['同义词', '反义词', '同源词']) {
				cleaned = cleaned.replace(new RegExp(`\\n## ${section}\\n[\\s\\S]*?(?=\\n##|$)`), '');
			}
			if (cleaned !== raw) await this.vault.modify(file, cleaned.trimEnd() + '\n');
		}
	}

	ensureFlags(terms: VocabularyTerm[]): void {
		for (const t of terms) {
			if (!this.flags[t.text]) this.flags[t.text] = { synonym: 0, antonym: 0, cognate: 0 };
		}
	}

	async generateAll(terms: VocabularyTerm[], wordFolder: string): Promise<void> {
		if (this.isRunning) return;
		this.isRunning = true;
		this.ensureFlags(terms);
		try {
			await Promise.all(['synonym','antonym','cognate'].map(t =>
				this.processQueue(t as RelationType, terms, wordFolder)));
		} finally {
			this.isRunning = false;
			this.onComplete?.();
		}
	}

	private async processQueue(type: RelationType, allTerms: VocabularyTerm[], wordFolder: string): Promise<void> {
		const queue = allTerms.filter(t => this.flags[t.text]?.[type] === 0);
		const total = queue.length;
		const allWords = allTerms.map(t => t.text);

		for (let i = 0; i < queue.length; i++) {
			const focus = queue[i].text;
			const candidates = allWords.filter(w => w.toLowerCase() !== focus.toLowerCase());
			try {
				const { words, matches } = await this.askAI(type, focus, candidates);
				if (words.length > 0) {
					this.flags[focus][type] = 1;
					for (const m of matches) {
						if (this.flags[m.word]) {
							this.flags[m.word][type] = 1;
							await this.writeLink(type, focus, m.word, wordFolder, m.reason);
							await this.writeLink(type, m.word, focus, wordFolder, m.reason);
						}
					}
				} else { this.flags[focus][type] = -1; }
				this.onProgress?.(type, i + 1, total);
			} catch { this.flags[focus][type] = -1; }
		}
	}

	private async askAI(type: RelationType, focus: string, candidates: string[]): Promise<{ words: string[]; matches: { word: string; reason?: string }[] }> {
		// Use reloadTemplate to bypass cache and get latest prompt
		const skill = await this.interpreter.skillManager?.reloadTemplate(`relation_${type}`);
		const systemMsg = skill?.replace('目标词', focus) ?? `分析哪些词与"${focus}"有${this.typeLabel(type)}关系。`;
		const userMsg = `候选词列表：\n${candidates.join('\n')}`;
		const callId = `${type[0]}${Date.now() % 10000}`;
		console.log(`[Relation:${callId}] ${type} focus="${focus}", candidates=${candidates.length}`);

		const result = await this.interpreter.invoke(systemMsg, userMsg, []);
		console.log(`[Relation:${callId}] raw(300):`, result.content?.slice(0, 300));

		const parsed = this.extractJSON(result.content);
		const matches: { word: string; reason?: string; pos?: string; pos2?: string }[] = [];
		if (Array.isArray(parsed)) {
			for (const p of parsed) {
				if (typeof p === 'string') matches.push({ word: p });
				else if (p?.word) {
					if (p.check === false) continue;
					matches.push({ word: p.word, reason: p.reason, pos: p.pos, pos2: p.pos2 });
				}
			}
		}
		console.log(`[Relation:${callId}] result:`, matches.map(m => m.word));

		if (matches.length > 0) {
			const checked = await this.runChecker(matches, type, focus);
			if (checked.length !== matches.length) {
				console.log(`[Relation:${callId}] checker rejected ${matches.length - checked.length} entries`);
			}
			return { words: checked.map(m => m.word), matches: checked };
		}
		return { words: [], matches: [] };
	}

	private async runChecker(matches: { word: string; reason?: string; pos?: string }[], type: RelationType, focus: string): Promise<{ word: string; reason?: string }[]> {
		const skill = await this.interpreter.skillManager?.reloadTemplate('relation_checker');
		if (!skill) return matches;

		const label = this.typeLabel(type);
		const input = JSON.stringify({ focus, type: label, candidates: matches }, null, 2);
		const result = await this.interpreter.invoke(skill, input, []);
		const raw = result.content || '';

		// Save checker reasoning to debug file
		await this.appendDebugLog(focus, type, raw, matches);

		const parsed = this.extractJSON(raw);
		if (!Array.isArray(parsed)) return matches;
		const checked: { word: string; reason?: string }[] = [];
		for (const p of parsed) {
			if (p?.word && p?.check !== false) checked.push({ word: p.word, reason: p.reason });
		}
		return checked;
	}

	private async appendDebugLog(focus: string, type: RelationType, raw: string, input: any): Promise<void> {
		try {
			const dir = '_relations';
			if (!this.vault.getAbstractFileByPath(dir)) await this.vault.createFolder(dir);
			const path = `${dir}/checker_debug.md`;
			const file = this.vault.getAbstractFileByPath(path);
			const entry = `\n## ${focus} — ${this.typeLabel(type)}\n\n**输入**:\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n\n**Checker 输出**:\n\n${raw}\n\n---\n`;
			if (file) {
				await this.vault.modify(file as TFile, (await this.vault.read(file as TFile)) + entry);
			} else {
				await this.vault.create(path, `# 关系图谱 Checker 调试日志\n${entry}`);
			}
		} catch {}
	}

	private extractJSON(text: string): any {
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return [];
		try { return JSON.parse(match[0]); } catch { return []; }
	}

	private async writeLink(type: RelationType, from: string, to: string, wordFolder: string, reason?: string): Promise<void> {
		const fileName = from.toLowerCase().replace(/[#?\[\]\/\\:*"<>|]/g, '_');
		const path = `${wordFolder}/${fileName}.md`;
		const file = this.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		const raw = await this.vault.read(file);
		const linkText = `[[${to}]]`;
		if (raw.includes(linkText)) return;
		const entry = reason ? `- ${linkText} — ${reason}\n` : `- ${linkText}\n`;
		const sectionName = this.typeSection(type);
		if (raw.includes(`## ${sectionName}`)) {
			await this.vault.modify(file, raw + entry);
		} else {
			await this.vault.modify(file, raw + `\n## ${sectionName}\n${entry}`);
		}
	}

	private typeLabel(type: RelationType): string { return { synonym:'同义', antonym:'反义', cognate:'同源' }[type]; }
	private typeSection(type: RelationType): string { return { synonym:'同义词', antonym:'反义词', cognate:'同源词' }[type]; }
}
