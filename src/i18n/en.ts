import { UIStrings } from './types';

export const en: UIStrings = {
	selection: { analyze: 'Analyze', translate: 'Translate', loading: '...', error: 'Error', processing: 'Analyzing, please wait...' },
	note: { word: 'Word', phrase: 'Phrase', meaning: 'Meaning', pronunciation: 'Pronunciation', etymology: 'Etymology', example: 'Examples', fullNote: 'Open Full Note', reinterpret: 'Reinterpret in Context', confirmAppend: 'Append to Note', cancel: 'Cancel', appended: 'Appended ✓', appendFailed: 'Append failed' },
	panel: { title: 'Language Learn AI', welcome: '👋 Language Learning Assistant', welcomeSub: 'AI explanations will appear here. You can also ask questions.', placeholder: 'Ask anything...', send: 'Send', newChat: '+ New', graph: 'Graph', reset: 'Reset', completed: '✓ Relation graph complete', processing: 'Processing:' },
	settings: { ai: 'AI Configuration', provider: 'Provider', endpoint: 'API Endpoint', apiKey: 'API Key', model: 'Model', language: 'Language', nativeLang: 'Your Language', nativeLangDesc: 'Your native language', targetLang: 'Learning', targetLangDesc: 'The language you are learning', storage: 'Storage', wordFolder: 'Word Notes Folder', phraseFolder: 'Phrase Notes Folder', hover: 'Hover Popup', hoverEnabled: 'Enable hover popup' },
	commands: { analyze: 'Analyze selected text', forceStore: 'Force store selected text', reanalyze: 'Reanalyze current word/phrase', generateRelations: 'Generate relation graph', refreshIndex: 'Refresh index' },
	notice: { generated: 'Generating note for "{text}"...', generating: 'Analyzing...', failed: 'Failed: {msg}\n\nPlease check your AI configuration.', cleared: '✓ Cleared all relation marks and links', checkConfig: 'Please check your AI configuration.', langChanged: 'Language changed. Reopen settings to see full effect.' },
	vocab: { noHistory: '(No history)' },
};
