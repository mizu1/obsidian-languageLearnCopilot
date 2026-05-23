/**
 * InterpreterFactory — creates Interpreter instances based on language pair.
 * Thin factory that wires together settings, SkillManager, and ToolsManager.
 */

import { Vault } from 'obsidian';
import { PluginSettings } from '../../types';
import { Interpreter } from './Interpreter';
import { SkillManager } from './SkillManager';
import { ToolsManager } from '../ToolsManager';

export class InterpreterFactory {
	private vault: Vault;
	private toolsManager: ToolsManager;
	skillManager?: SkillManager;

	constructor(vault: Vault, toolsManager: ToolsManager) {
		this.vault = vault;
		this.toolsManager = toolsManager;
	}

	create(settings: PluginSettings): Interpreter {
		this.skillManager = new SkillManager(
			this.vault,
			settings.nativeLanguage,
			settings.targetLanguage
		);
		return new Interpreter(settings, this.skillManager, this.toolsManager);
	}
}
