export interface PluginSettings {
	docsDir: string
	openai: OpenaiSettings
	defaults: DefaultsSettings
}

export interface OpenaiSettings {
	apiKey: string
	host: string
}

export interface DefaultsSettings {
	model: OpenaiModel
	systemPrompt: string // todo: implement
}

export enum OpenaiModel {
	gpt4o = 'gpt-4o',
	gpt4oMini = 'gpt-4o-mini',
}

export const defaultPluginSettings: PluginSettings = {
	docsDir: 'LLM',
	openai: {
		apiKey: '',
		host: 'api.openai.com',
	},
	defaults: {
		model: OpenaiModel.gpt4oMini,
		systemPrompt: ''
	}
}
