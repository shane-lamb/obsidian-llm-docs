import { App, PluginSettingTab, Setting, TextComponent } from 'obsidian'
import { DocOpenMethods, openaiModels } from '../settings'
import LlmDocsPlugin from '../main'
import { addConnectionsSettings } from './connections'

export class SettingsTab extends PluginSettingTab {
	plugin: LlmDocsPlugin

	constructor(app: App, plugin: LlmDocsPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		new Setting(containerEl)
			.setName('LLM docs directory')
			.setDesc('The directory where new LLM documents will be created')
			.addText((text) =>
				text
					.setPlaceholder('path/to/directory')
					.setValue(this.plugin.settings.docsDir)
					.onChange(async (value) => {
						this.plugin.settings.docsDir = value
						await this.plugin.saveSettings()
					}),
			)

		const documentOpenMethods: Record<DocOpenMethods, string> = {
			tab: 'a new tab',
			splitVertical: 'a new split (vertical)',
			splitHorizontal: 'a new split (horizontal)',
			window: 'a new window',
			replace: 'an existing tab',
		}
		new Setting(containerEl).setName('Create new documents in...').addDropdown((dropdown) =>
			dropdown
				.addOptions(documentOpenMethods)
				.setValue(this.plugin.settings.defaults.docOpenMethod)
				.onChange(async (value) => {
					this.plugin.settings.defaults.docOpenMethod = value as DocOpenMethods
					await this.plugin.saveSettings()
				}),
		)

		addConnectionsSettings(containerEl, this.plugin, () => this.display())

		new Setting(containerEl).setName('Defaults').setHeading()

		this.addDefaultModelSetting(containerEl)

		new Setting(containerEl)
			.setName('Default system prompt')
			.setDesc('The default system prompt for new LLM documents')
			.addText((text) =>
				text
					.setPlaceholder('System prompt')
					.setValue(this.plugin.settings.defaults.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.defaults.systemPrompt = value
						await this.plugin.saveSettings()
					}),
			)
	}

	addDefaultModelSetting(containerEl: HTMLElement) {
		const initialValue = this.plugin.settings.defaults.model
		const initialValueIsOther = !Object.keys(openaiModels).includes(initialValue)
		let textComponent: TextComponent
		new Setting(containerEl)
			.setName('Default model')
			.setDesc('The default LLM model variant to use for new LLM documents')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						...openaiModels,
						other: 'Custom',
					})
					.setValue(initialValueIsOther ? 'other' : initialValue)
					.onChange(async (value) => {
						if (value === 'other') {
							textComponent.setDisabled(false)
							textComponent.inputEl.focus()
						} else {
							textComponent.setDisabled(true)
							textComponent.setValue(value)
							this.plugin.settings.defaults.model = value
							await this.plugin.saveSettings()
						}
					})
			})
			.addText((text) => {
				text.setValue(initialValue)
					.onChange(async (value) => {
						this.plugin.settings.defaults.model = value
						await this.plugin.saveSettings()
					})
					.setDisabled(!initialValueIsOther)
				textComponent = text
			})
	}
}
