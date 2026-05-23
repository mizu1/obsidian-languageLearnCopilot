/**
 * ResultValidator — checks AI output for required structure,
 * generates fix prompts for retry when validation fails.
 *
 * Validation rules:
 *   1. If metadata.kind === 'translation' → no structural check needed
 *   2. If file was created (metadata.path) → check frontmatter + sections
 *   3. Otherwise → just check content is non-empty
 */

import { AIResult } from '../../types';

export interface ValidationResult {
	valid: boolean;
	missing: string[];
	reason: string;
}

export class ResultValidator {
	validate(result: AIResult, expectedFormat: 'word' | 'phrase' | 'translation'): ValidationResult {
		// Translation → always valid
		if (expectedFormat === 'translation') {
			return { valid: true, missing: [], reason: '' };
		}

		// Plain text response (no file) → check non-empty
		if (!result.metadata?.path) {
			if (!result.content || result.content.trim().length < 5) {
				return { valid: false, missing: ['content'], reason: '输出内容过短' };
			}
			return { valid: true, missing: [], reason: '' };
		}

		// File-backed → check structure
		const content = result.content;
		const missing: string[] = [];

		if (!content.includes('---')) {
			missing.push('frontmatter');
		} else {
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (fmMatch) {
				const fm = fmMatch[1];
				if (!fm.match(/词:/)) missing.push('frontmatter.词');
				if (!fm.match(/类型:/)) missing.push('frontmatter.类型');
				if (!fm.match(/创建时间:/)) missing.push('frontmatter.创建时间');
			}
		}

		if (!content.includes('## 含义')) missing.push('含义');

		if (expectedFormat === 'word') {
			// Word-specific checks
		} else if (expectedFormat === 'phrase') {
			if (!content.includes('## 语法与背景') && !content.includes('## 语法')) {
				// Non-blocking: grammar section is optional
			}
		}

		if (missing.length > 0) {
			return {
				valid: false,
				missing,
				reason: `缺少必要字段: ${missing.join(', ')}`,
			};
		}

		return { valid: true, missing: [], reason: '' };
	}

	generateFixPrompt(validationResult: ValidationResult): string {
		return [
			'你上一次的输出格式不正确。',
			`问题: ${validationResult.reason}`,
			'请重新生成，确保包含所有必要字段。',
			'格式要求: frontmatter（词、类型、创建时间）+ ## 含义 + ## 例句与语境分析',
		].join('\n');
	}
}
