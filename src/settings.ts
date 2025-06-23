export interface PluginSettings {
	docsDir: string
	connections: LlmConnectionSettings[]
	defaults: DefaultsSettings
	pinnedModels: Record<string, boolean>
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

export interface LlmConnectionSettings {
	type: 'OpenAI' // 'Anthropic' and other types in future
	baseUrl: string
	apiKey: string
}

export const defaultPluginSettings: PluginSettings = {
	docsDir: 'LLM',
	connections: [],
	pinnedModels: {},
	defaults: {
		model: 'gpt-4o',
		systemPrompt: '',
		docOpenMethod: DocOpenMethods.tab,
	},
}
