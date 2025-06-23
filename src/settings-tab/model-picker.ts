import { App, SuggestModal } from 'obsidian'
import { LlmConnectionSettings } from '../settings'
import {
	ConnectionModel,
	getAllAvailableModelsAndUpdateCache,
	getCachedConnectionModels,
	getConnectionId,
} from '../connection-models'
import { modelCacheUpdated } from '../registry'
import { ValueEmitter } from '../utils'

export class ModelPickerModal extends SuggestModal<ConnectionModel> {
	private models: ConnectionModel[]
	private onResult = new ValueEmitter<string | null>()
	private unsubscribe = modelCacheUpdated.on(() => {
		this.refreshModels()
		// a bit dangerous as we are invoking internals, but there's no other way to refresh the list once opened
		;(this as any).updateSuggestions()
	})

	constructor(
		app: App,
		private connections: LlmConnectionSettings[],
	) {
		super(app)
		this.refreshModels()
		this.emptyStateText = this.getEmptyStateText()
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
		this.models = getCachedConnectionModels(this.connections).sort((a, b) =>
			collator.compare(sortKey(a), sortKey(b)),
		)
	}

	private getEmptyStateText(): string {
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
		this.onResult.emit(model.model)
	}

	onOpen() {
		super.onOpen()

		getAllAvailableModelsAndUpdateCache(this.connections).then()
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

function sortKey(model: ConnectionModel): string {
	return getConnectionId(model.connection) + '_' + model.model
}
