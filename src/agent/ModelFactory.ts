import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PluginSettings } from '../types';

export function createChatModel(settings: PluginSettings): ChatOpenAI | ChatDeepSeek | ChatGoogleGenerativeAI {
	const baseConfig: any = {
		model: settings.model,
		apiKey: settings.apiKey,
		temperature: 0.3,
	};

	// Always disable thinking for DeepSeek compatibility
	baseConfig.modelKwargs = { thinking: { type: 'disabled' } };

	switch (settings.provider) {
		case 'deepseek':
			baseConfig.model = settings.model || 'deepseek-chat';
			return new ChatDeepSeek(baseConfig);
		case 'gemini':
			return new ChatGoogleGenerativeAI({ model: settings.model, apiKey: settings.apiKey, temperature: 0.3 });
		case 'openai':
		default:
			if (settings.provider !== 'openai' || settings.apiEndpoint !== 'https://api.openai.com/v1') {
				baseConfig.configuration = { baseURL: settings.apiEndpoint };
			}
			return new ChatOpenAI(baseConfig);
	}
}
