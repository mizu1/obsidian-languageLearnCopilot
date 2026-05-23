import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { PluginSettings, LANGUAGE_OPTIONS, PROVIDER_OPTIONS, PROVIDER_DEFAULTS, LanguageCode, ModelProvider } from '../types';
import { i18n } from '../i18n';

export class LanguageLearnSettingsTab extends PluginSettingTab {
	private settings: PluginSettings;
	private onSave: (settings: PluginSettings) => Promise<void>;

	constructor(app: App, settings: PluginSettings, onSave: (settings: PluginSettings) => Promise<void>) {
		super(app, (app as any).plugins?.plugins?.['language-learn']);
		this.settings = { ...settings };
		this.onSave = onSave;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = i18n();
		const defs = PROVIDER_DEFAULTS[this.settings.provider];

		containerEl.createEl('h2', { text: s.settings.ai });

		// Provider
		new Setting(containerEl).setName(s.settings.provider).setDesc(s.settings.provider)
			.addDropdown(d => {
				for (const [k, v] of Object.entries(PROVIDER_OPTIONS)) d.addOption(k, v);
				d.setValue(this.settings.provider).onChange(v => {
					this.settings.provider = v as ModelProvider;
					const nd = PROVIDER_DEFAULTS[v as ModelProvider];
					if (nd) { this.settings.apiEndpoint = nd.endpoint; this.settings.model = nd.models[0]; }
					this.display();
				});
			});

		// Endpoint
		const epCustom = defs.endpoint !== this.settings.apiEndpoint;
		const epSetting = new Setting(containerEl).setName(s.settings.endpoint).setDesc(s.settings.endpoint);
		epSetting.addDropdown(d => {
			d.addOption(defs.endpoint, defs.endpoint); d.addOption('custom', 'Custom...');
			d.setValue(epCustom ? 'custom' : defs.endpoint);
			d.onChange(v => { if (v !== 'custom') { this.settings.apiEndpoint = v; } else { this.settings.apiEndpoint = ''; } this.display(); });
		});
		if (epCustom) epSetting.addText(t => t.setPlaceholder('https://...').setValue(this.settings.apiEndpoint)
			.onChange(v => { this.settings.apiEndpoint = v; }));

		// API Key
		new Setting(containerEl).setName(s.settings.apiKey).setDesc(s.settings.apiKey)
			.addText(t => { t.setPlaceholder('sk-...').setValue(this.settings.apiKey).onChange(v => { this.settings.apiKey = v; }); t.inputEl.type = 'password'; });

		// Model
		const mdCustom = !defs.models.includes(this.settings.model);
		const mdSetting = new Setting(containerEl).setName(s.settings.model).setDesc(s.settings.model);
		mdSetting.addDropdown(d => {
			for (const m of defs.models) d.addOption(m, m); d.addOption('custom', 'Custom...');
			d.setValue(mdCustom ? 'custom' : this.settings.model);
			d.onChange(v => { if (v !== 'custom') { this.settings.model = v; } else { this.settings.model = ''; } this.display(); });
		});
		if (mdCustom) mdSetting.addText(t => t.setPlaceholder('model-name').setValue(this.settings.model).onChange(v => { this.settings.model = v; }));

		// Language
		containerEl.createEl('h2', { text: s.settings.language });
		new Setting(containerEl).setName(s.settings.nativeLang).setDesc(s.settings.nativeLangDesc).addDropdown(d => { for (const [k, v] of Object.entries(LANGUAGE_OPTIONS)) d.addOption(k, v); d.setValue(this.settings.nativeLanguage).onChange(v => { this.settings.nativeLanguage = v as LanguageCode; }); });
		new Setting(containerEl).setName(s.settings.targetLang).setDesc(s.settings.targetLangDesc).addDropdown(d => { for (const [k, v] of Object.entries(LANGUAGE_OPTIONS)) d.addOption(k, v); d.setValue(this.settings.targetLanguage).onChange(v => { this.settings.targetLanguage = v as LanguageCode; }); });

		// Storage
		containerEl.createEl('h2', { text: s.settings.storage });
		new Setting(containerEl).setName(s.settings.wordFolder).setDesc(s.settings.wordFolder).addText(t => t.setPlaceholder('_word_notes').setValue(this.settings.wordNotesFolder).onChange(v => { this.settings.wordNotesFolder = v; }));
		new Setting(containerEl).setName(s.settings.phraseFolder).setDesc(s.settings.phraseFolder).addText(t => t.setPlaceholder('_phrase_notes').setValue(this.settings.phraseNotesFolder).onChange(v => { this.settings.phraseNotesFolder = v; }));

		// Hover
		containerEl.createEl('h2', { text: s.settings.hover });
		new Setting(containerEl).setName(s.settings.hoverEnabled).setDesc(s.settings.hoverEnabled).addToggle(t => t.setValue(this.settings.hoverEnabled).onChange(v => { this.settings.hoverEnabled = v; }));

		// Save button — applies all changes at once
		const btnDiv = containerEl.createDiv('lang-learn-save-bar');
		const saveBtn = btnDiv.createEl('button', { text: '💾 Save & Apply', cls: 'lang-learn-btn lang-learn-btn-primary' });
		saveBtn.style.marginTop = '16px'; saveBtn.style.width = '100%';
		saveBtn.addEventListener('click', async () => { saveBtn.textContent = '...'; saveBtn.disabled = true; await this.onSave(this.settings); this.display(); new Notice('✓ Settings saved & applied'); });
	}
}
