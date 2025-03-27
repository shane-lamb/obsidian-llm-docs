import { Notice, Setting } from 'obsidian'
import LlmDocsPlugin from '../main'
import { getAvailableModelsAndUpdateCache } from '../connection-models'

export function addConnectionsSettings(containerEl: HTMLElement, plugin: LlmDocsPlugin, redraw: () => void) {
	new Setting(containerEl)
		.setName('Connections')
		.setDesc('Use official OpenAI/Anthropic APIs, or a compatible self-hosted alternative')
		.setHeading()

	const connectionsContainer = containerEl.createDiv()

	plugin.settings.connections.forEach((connection, index) => {
		const connectionSetting = new Setting(connectionsContainer).setName(`#${index + 1}`)

		connectionSetting.addDropdown((dropdown) => {
			dropdown
				.addOptions({
					OpenAI: 'OpenAI',
				})
				.setValue(connection.type)
				.onChange(async (value) => {
					plugin.settings.connections[index].type = value as 'OpenAI'
					await plugin.saveSettings()
				})
		})

		connectionSetting.addText((text) =>
			text
				.setPlaceholder('Base URL')
				.setValue(connection.baseUrl)
				.onChange(async (value) => {
					plugin.settings.connections[index].baseUrl = value
					await plugin.saveSettings()
				}),
		)

		connectionSetting.addText((text) =>
			text
				.setPlaceholder('API key')
				.setValue(connection.apiKey)
				.onChange(async (value) => {
					plugin.settings.connections[index].apiKey = value
					await plugin.saveSettings()
				}),
		)

		connectionSetting.addButton((button) => {
			button.setButtonText('Test').onClick(async () => {
				button.setDisabled(true)
				try {
					await getAvailableModelsAndUpdateCache(connection)
					new Notice('Connection success!')
				} catch (error) {
					new Notice(error)
				}
				button.setDisabled(false)
			})
		})

		connectionSetting.addButton((button) => {
			button.setButtonText('Remove').onClick(async () => {
				plugin.settings.connections.splice(index, 1)
				await plugin.saveSettings()
				redraw()
			})
		})
	})

	new Setting(containerEl).addButton((button) => {
		button.setButtonText('Add connection').onClick(async () => {
			plugin.settings.connections.push({
				baseUrl: 'https://api.openai.com',
				apiKey: '',
				type: 'OpenAI',
			})
			await plugin.saveSettings()
			redraw()
		})
	})
}
