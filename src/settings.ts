export interface PluginSettings {
	docsDir: string
	connections: LlmConnectionSettings[]
	defaults: DefaultsSettings
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

export interface LlmConnectionSettings {
	type: 'OpenAI' // 'Anthropic' and other types in future
	baseUrl: string
	apiKey: string
}

const defaultModel: keyof typeof openaiModels = 'gpt-4o'

export const defaultPluginSettings: PluginSettings = {
	docsDir: 'LLM',
	connections: [],
	defaults: {
		model: defaultModel,
		systemPrompt: '',
		docOpenMethod: DocOpenMethods.tab,
	},
}
