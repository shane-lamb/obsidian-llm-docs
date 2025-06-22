import { App, SuggestModal } from 'obsidian'
import { LlmConnectionSettings } from '../settings'
import {
	ConnectionModel,
	getAllAvailableModelsAndUpdateCache,
	getCachedConnectionModels,
	getConnectionId,
} from '../connection-models'
import { modelCacheUpdated, modelSelected } from '../registry'

export class ModelPickerModal extends SuggestModal<ConnectionModel> {
	private models: ConnectionModel[]

	constructor(
		app: App,
		private connections: LlmConnectionSettings[],
	) {
		super(app)
		this.refreshModels()
		this.emptyStateText = this.getEmptyStateText()
	}

	refreshModels() {
		const collator = new Intl.Collator()
		this.models = getCachedConnectionModels(this.connections).sort((a, b) => collator.compare(sortKey(a), sortKey(b)))
	}

	getEmptyStateText(): string {
		if (!this.connections.length) {
			return `No results. You need to add a connection first!`
		}
		return 'Loading...'
	}

	getSuggestions(query: string): ConnectionModel[] {
		return this.models.filter((model) => model.model.toLowerCase().includes(query.toLowerCase()))
	}

	renderSuggestion({ connection, model }: ConnectionModel, el: HTMLElement) {
		el.createEl('div', { text: model, cls: 'llmdocs-suggest-item-title' })
		el.createEl('small', {
			text: connection.baseUrl,
			cls: 'llmdocs-suggest-item-subtext',
		})
	}

	onChooseSuggestion(model: ConnectionModel, evt: MouseEvent | KeyboardEvent) {
		modelSelected.emit('change', model.model)
	}

	onOpen() {
		super.onOpen()

		modelCacheUpdated.on('change', () => {
			this.refreshModels();
			(this as any).updateSuggestions()
		})

		getAllAvailableModelsAndUpdateCache(this.connections).then()
	}

	onClose() {
		super.onClose()

		modelCacheUpdated.removeAllListeners()
	}
}

function sortKey(model: ConnectionModel): string {
	return getConnectionId(model.connection) + '_' + model.model
}
