/**
 * ChatHistoryManager — persists chat conversations as markdown files.
 * Each session stored as _chat_histories/YYYY-MM-DD-session-N.md
 * with frontmatter + timestamped messages.
 */

import { Vault, TFile } from 'obsidian';
import { ChatMessage } from '../types';

const SESSIONS_DIR = '_chat_histories';

export class ChatHistoryManager {
	private vault: Vault;
	private currentSession: string | null = null;

	constructor(vault: Vault) {
		this.vault = vault;
	}

	/** Get or create a session for today. Returns the file path. */
	async getOrCreateSession(): Promise<string> {
		if (this.currentSession) return this.currentSession;

		const today = new Date().toISOString().split('T')[0];

		// Ensure folder exists
		if (!this.vault.getAbstractFileByPath(SESSIONS_DIR)) {
			await this.vault.createFolder(SESSIONS_DIR);
		}

		// Find next session number for today
		const folder = this.vault.getAbstractFileByPath(SESSIONS_DIR);
		const children = (folder as any)?.children as TFile[] || [];
		const todaySessions = children
			.filter((f: TFile) => f.basename.startsWith(today))
			.length;

		const fileName = `${today}-session-${todaySessions + 1}`;
		const filePath = `${SESSIONS_DIR}/${fileName}.md`;

		const now = new Date().toISOString();
		const content = `---
created: ${now}
updated: ${now}
---

`;

		await this.vault.create(filePath, content);
		this.currentSession = filePath;
		return filePath;
	}

	/** Append a single message to the current session. */
	async appendMessage(
		role: ChatMessage['role'],
		content: string
	): Promise<void> {
		const path = await this.getOrCreateSession();
		const file = this.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;

		const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
		const entry = `## ${role} (${timestamp})\n${content}\n\n`;

		// Append to file
		const raw = await this.vault.read(file);
		let updated = raw + entry;

		// Update frontmatter timestamp
		updated = updated.replace(
			/updated: .*/,
			`updated: ${new Date().toISOString()}`
		);

		await this.vault.modify(file, updated);
	}

	/** Load messages from a session file. */
	async loadSession(path: string): Promise<ChatMessage[]> {
		const file = this.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return [];

		const raw = await this.vault.read(file);
		const messages: ChatMessage[] = [];

		// Parse messages: ## role (timestamp)\ncontent\n\n
		const regex = /## (user|assistant|system) \(([^)]+)\)\n([\s\S]*?)(?=\n## |\n*$)/g;
		let m: RegExpExecArray | null;
		while ((m = regex.exec(raw)) !== null) {
			messages.push({
				role: m[1] as ChatMessage['role'],
				content: m[3].trim(),
				timestamp: new Date(m[2]).getTime(),
			});
		}

		return messages;
	}

	/** List all session files, newest first. */
	listSessions(): TFile[] {
		const folder = this.vault.getAbstractFileByPath(SESSIONS_DIR);
		if (!folder || !(folder as any).children) return [];
		const children = (folder as any).children as TFile[];
		return children
			.filter((f: TFile) => f.extension === 'md')
			.sort((a, b) => b.stat.mtime - a.stat.mtime);
	}

	/** Start a new session (close current). */
	resetSession(): void {
		this.currentSession = null;
	}

	getCurrentSessionPath(): string | null {
		return this.currentSession;
	}

	setCurrentSession(path: string): void {
		this.currentSession = path;
	}
}
