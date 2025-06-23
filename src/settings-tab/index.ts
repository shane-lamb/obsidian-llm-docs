import { App, PluginSettingTab, Setting } from 'obsidian'
import { DocOpenMethods } from '../settings'
import LlmDocsPlugin from '../main'
import { addConnectionsSettings } from './connections'
import { modelCacheUpdated } from '../registry'
import { ModelPickerModal } from './model-picker'
import { FolderSuggest } from './folder-suggest'

export class SettingsTab extends PluginSettingTab {
	unsubscribe = modelCacheUpdated.on(() => this.display())

	constructor(
		app: App,
		private plugin: LlmDocsPlugin,
	) {
		super(app, plugin)
	}

	hide() {
		super.hide()

		this.unsubscribe()
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		new Setting(containerEl)
			.setName('LLM docs directory')
			.setDesc('The directory where new LLM documents will be created')
			.addText((text) => {
				text.setPlaceholder('path/to/directory')
					.setValue(this.plugin.settings.docsDir)
					.onChange(async (value) => {
						this.plugin.settings.docsDir = value
						await this.plugin.saveSettings()
					})

				new FolderSuggest(this.app, text.inputEl)
			})

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
		const save = async (value: string) => {
			this.plugin.settings.defaults.model = value
			await this.plugin.saveSettings()
		}

		new Setting(containerEl)
			.setName('Default model')
			.setDesc('The default LLM model variant to use for new LLM documents')
			.addButton((button) => {
				button.setButtonText('Select').onClick(async () => {
					const model = await new ModelPickerModal(this.app, this.plugin).openAndGetResult()
					if (model) {
						await save(model)
						// force refresh of textbox in a way that is resilient to
						// the page being refreshed while the modal is still open
						// (can happen due to the subscription to "modelCacheUpdated")
						this.display()
					}
				})
			})
			.addText((text) => {
				text.setValue(this.plugin.settings.defaults.model).onChange(async (value) => save(value))
			})
	}
}
