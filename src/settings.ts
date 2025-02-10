export interface PluginSettings {
	docsDir: string
	openai: OpenaiSettings
	defaults: DefaultsSettings
}

export interface OpenaiSettings {
	apiKey: string
	baseUrl: string
}

export enum DocOpenMethods {
	replace = 'replace',
	tab = 'tab',
	splitVertical = 'splitVertical',
	splitHorizontal = 'splitHorizontal',
	window = 'window',
}

export interface DefaultsSettings {
	model: string
	systemPrompt: string
	docOpenMethod: DocOpenMethods
}

export const openaiModels = {
	'gpt-4o': 'GPT-4o',
	'gpt-4o-mini': 'GPT-4o mini',
}

const defaultModel: keyof typeof openaiModels = 'gpt-4o'

export const defaultPluginSettings: PluginSettings = {
	docsDir: 'LLM',
	openai: {
		apiKey: '',
		baseUrl: 'https://api.openai.com',
	},
	defaults: {
		model: defaultModel,
		systemPrompt: '',
		docOpenMethod: DocOpenMethods.tab,
	},
}
