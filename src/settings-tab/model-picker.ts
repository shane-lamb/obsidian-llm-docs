import { App, getIcon, SuggestModal } from 'obsidian'
import { PluginSettings } from '../settings'
import { getAllAvailableModelsAndUpdateCache, getConnectionId, modelToConnectionCache } from '../connection-models'
import { modelCacheUpdated } from '../registry'
import { ValueEmitter } from '../utils'
import LlmDocsPlugin from '../main'

export class ModelPickerModal extends SuggestModal<Model> {
	private models: Model[]
	private onResult = new ValueEmitter<string | null>()
	private unsubscribe = modelCacheUpdated.on(() => {
		this.refreshModels()
	})

	constructor(
		app: App,
		private plugin: LlmDocsPlugin,
	) {
		super(app)
		this.refreshModels()
		this.emptyStateText = this.getEmptyStateText()
		this.setPlaceholder('Select a model...')
	}

	async openAndGetResult(): Promise<string | null> {
		return new Promise((resolve) => {
			this.open()
			this.onResult.once((result) => {
				resolve(result)
			})
		})
	}

	private refreshModels() {
		const collator = new Intl.Collator()
		this.models = getCachedModels(this.plugin.settings).sort((a, b) => collator.compare(sortKey(a), sortKey(b)))
		// a bit dangerous as we are invoking internals, but there's no other way to refresh the list once opened
		;(this as any).updateSuggestions()
	}

	private getEmptyStateText(): string {
		if (!this.plugin.settings.connections.length) {
			return `No results. You need to add a connection first!`
		}
		return 'Loading...'
	}

	getSuggestions(query: string): Model[] {
		return this.models.filter((model) => model.name.toLowerCase().includes(query.toLowerCase()))
	}

	renderSuggestion(model: Model, el: HTMLElement) {
		const pin = el.createEl('div', { cls: 'llmdocs-suggest-item-pin' })
		pin.onclick = async (evt: MouseEvent) => {
			evt.stopPropagation()
			await this.togglePinned(model)
		}
		if (model.isPinned) {
			pin.addClass('pinned')
		}
		pin.append(getIcon('pin') as Node)
		el.createEl('div', { text: model.name, cls: 'llmdocs-suggest-item-title' })
		el.createEl('small', {
			text: model.connectionUrl,
			cls: 'llmdocs-suggest-item-subtext',
		})
	}

	async togglePinned(model: Model) {
		if (model.isPinned) {
			delete this.plugin.settings.pinnedModels[model.name]
		} else {
			this.plugin.settings.pinnedModels[model.name] = true
		}
		await this.plugin.saveSettings()
		this.refreshModels()
	}

	onChooseSuggestion(model: Model, evt: MouseEvent | KeyboardEvent) {
		this.onResult.emit(model.name)
	}

	onOpen() {
		super.onOpen()

		getAllAvailableModelsAndUpdateCache(this.plugin.settings.connections).then()
	}

	onClose() {
		super.onClose()

		this.unsubscribe()

		// for some bizarre reason, onClose() is called before onChooseSuggestion()!
		// which unfortunately makes this hack necessary
		sleep(0).then(() => {
			this.onResult.emit(null)
		})
	}
}

function sortKey(model: Model): string {
	return (model.isPinned ? '0' : '1') + (model.isDefault ? '0' : '1') + model.connectionIndex + '_' + model.name
}

interface Model {
	name: string
	connectionUrl: string
	connectionIndex: number
	isDefault: boolean
	isPinned: boolean
}

const modelExclusionList = [/^dall-e/, /embedding/, /(^|-)tts(-|$)/, /^whisper-/]

function getCachedModels(settings: PluginSettings): Model[] {
	const defaultModel = settings.defaults.model
	const pinnedModels = settings.pinnedModels

	const connectionUrls = new Map<string, string>()
	const connectionIndices = new Map<string, number>()
	settings.connections.forEach((connection, index) => {
		const connectionId = getConnectionId(connection)
		connectionUrls.set(connectionId, connection.baseUrl)
		connectionIndices.set(connectionId, index)
	})

	const models: Model[] = []
	for (const [modelName, connectionId] of modelToConnectionCache) {
		if (modelExclusionList.some((regex) => regex.test(modelName))) {
			continue
		}

		const connectionUrl = connectionUrls.get(connectionId)
		const connectionIndex = connectionIndices.get(connectionId)
		if (connectionUrl === undefined || connectionIndex === undefined) {
			continue
		}

		models.push({
			connectionUrl,
			connectionIndex,
			name: modelName,
			isDefault: modelName === defaultModel,
			isPinned: pinnedModels[modelName] ?? false,
		})
	}
	return models
}
