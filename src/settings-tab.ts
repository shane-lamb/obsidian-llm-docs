import { App, PluginSettingTab, Setting, TextComponent } from 'obsidian'
import { DocOpenMethods, OpenaiModel } from './settings'
import LlmDocsPlugin from './main'

export class SettingsTab extends PluginSettingTab {
	plugin: LlmDocsPlugin

	constructor(app: App, plugin: LlmDocsPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const {containerEl} = this

		containerEl.empty()

		new Setting(containerEl)
			.setName('LLM docs directory')
			.setDesc('The directory where new LLM documents will be created')
			.addText(text => text
				.setPlaceholder('path/to/directory')
				.setValue(this.plugin.settings.docsDir)
				.onChange(async (value) => {
					this.plugin.settings.docsDir = value
					await this.plugin.saveSettings()
				}))

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Your OpenAI API key for generating LLM responses')
			.addText(text => text
				.setPlaceholder('API key')
				.setValue(this.plugin.settings.openai.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.openai.apiKey = value
					await this.plugin.saveSettings()
				}))

		this.addBaseURLSetting(containerEl)

		const models: Record<OpenaiModel, string> = {
			'gpt-4o': 'GPT-4o',
			'gpt-4o-mini': 'GPT-4o mini',
		}
		new Setting(containerEl)
			.setName('Default model')
			.setDesc('The default LLM model variant to use for new LLM documents')
			.addDropdown(dropdown => dropdown
				.addOptions(models)
				.setValue(this.plugin.settings.defaults.model)
				.onChange(async (value) => {
					this.plugin.settings.defaults.model = value as OpenaiModel
					await this.plugin.saveSettings()
				}))

		new Setting(containerEl)
			.setName('Default system prompt')
			.setDesc('The default system prompt for new LLM documents')
			.addText(text => text
				.setPlaceholder('System prompt')
				.setValue(this.plugin.settings.defaults.systemPrompt)
				.onChange(async (value) => {
					this.plugin.settings.defaults.systemPrompt = value
					await this.plugin.saveSettings()
				}))

		const documentOpenMethods: Record<DocOpenMethods, string> = {
			'tab': 'a new tab',
			'splitVertical': 'a new split (vertical)',
			'splitHorizontal': 'a new split (horizontal)',
			'window': 'a new window',
			'replace': 'an existing tab',
		}
		new Setting(containerEl)
			.setName('Create new documents in...')
			.addDropdown(dropdown => dropdown
				.addOptions(documentOpenMethods)
				.setValue(this.plugin.settings.defaults.docOpenMethod)
				.onChange(async (value) => {
					this.plugin.settings.defaults.docOpenMethod = value as DocOpenMethods
					await this.plugin.saveSettings()
				}))
	}

	addBaseURLSetting(containerEl: HTMLElement) {
		const desc = new DocumentFragment()

		desc.appendText('This is the base URL used to connect to an OpenAI-compatible API:')

		const list = document.createElement('ul')
		desc.append(list)

		const item1 = document.createElement('li')
		item1.appendText('To connect with the official OpenAI API use ')
		const item1Link = document.createElement('a')
		item1.append(item1Link)
		item1Link.textContent = 'https://api.openai.com'
		list.append(item1)

		const item2 = document.createElement('li')
		item2.appendText('You can also use alternative/self-hosted LLMs, like local Ollama at ')
		const item2Link = document.createElement('a')
		item2.append(item2Link)
		item2Link.textContent = 'http://localhost:11434'
		list.append(item2)

		let textComponent: TextComponent
		new Setting(containerEl)
			.setName('OpenAI base URL')
			.setDesc(desc)
			.addText(text => {
				text
					.setPlaceholder('https://api.openai.com')
					.setValue(this.plugin.settings.openai.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.openai.baseUrl = value
						await this.plugin.saveSettings()
					})
				textComponent = text
			})

		const setBaseURL = (url: string) => {
			textComponent.setValue(url)
			this.plugin.settings.openai.baseUrl = url
			this.plugin.saveSettings()
		}
		item1Link.onclick = async () => {
			setBaseURL('https://api.openai.com')
		}
		item2Link.onclick = async () => {
			setBaseURL('http://localhost:11434')
		}
	}
}
