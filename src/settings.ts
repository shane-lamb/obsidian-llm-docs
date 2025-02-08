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
	model: OpenaiModel
	systemPrompt: string
	docOpenMethod: DocOpenMethods
}

export enum OpenaiModel {
	gpt4o = 'gpt-4o',
	gpt4oMini = 'gpt-4o-mini',
}

export const defaultPluginSettings: PluginSettings = {
	docsDir: 'LLM',
	openai: {
		apiKey: '',
		baseUrl: 'https://api.openai.com',
	},
	defaults: {
		model: OpenaiModel.gpt4oMini,
		systemPrompt: '',
		docOpenMethod: DocOpenMethods.tab,
	},
}
