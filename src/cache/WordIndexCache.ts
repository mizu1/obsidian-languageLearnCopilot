/**
 * LRU-based word index cache for O(1) hover lookups.
 * All known words are kept in memory (< 10,000 entries).
 */

import { WordCacheEntry } from '../types';

export class WordIndexCache {
	private index: Map<string, WordCacheEntry> = new Map();
	private lru: string[] = [];
	private readonly maxSize: number;

	constructor(maxSize: number = 1000) {
		this.maxSize = maxSize;
	}

	get(normalized: string): WordCacheEntry | null {
		const entry = this.index.get(normalized);
		if (entry) {
			this.touch(normalized);
		}
		return entry ?? null;
	}

	set(normalized: string, entry: WordCacheEntry): void {
		if (this.index.has(normalized)) {
			this.index.set(normalized, entry);
			this.touch(normalized);
			return;
		}

		if (this.lru.length >= this.maxSize) {
			const evict = this.lru.pop();
			if (evict) {
				this.index.delete(evict);
			}
		}

		this.index.set(normalized, entry);
		this.lru.unshift(normalized);
	}

	rebuild(entries: Map<string, WordCacheEntry>): void {
		this.index.clear();
		this.lru = [];

		for (const [key, entry] of entries) {
			this.index.set(key, entry);
		}
		this.lru = Array.from(entries.keys());
	}

	invalidate(normalized: string): void {
		this.index.delete(normalized);
		this.lru = this.lru.filter(k => k !== normalized);
	}

	has(normalized: string): boolean {
		return this.index.has(normalized);
	}

	get size(): number {
		return this.index.size;
	}

	normalize(word: string): string {
		return word.toLowerCase().trim();
	}

	private touch(key: string): void {
		this.lru = this.lru.filter(k => k !== key);
		this.lru.unshift(key);
	}
}
