import { App, SuggestModal } from 'obsidian'
import { LlmConnectionSettings } from '../settings'
import { ConnectionModel, getCachedConnectionModels, getConnectionId } from '../connection-models'
import { modelSelected } from '../registry'

export class ModelPickerModal extends SuggestModal<ConnectionModel> {
	private models: ConnectionModel[]

	constructor(app: App, connections: LlmConnectionSettings[]) {
		super(app)
		const collator = new Intl.Collator()
		this.models = getCachedConnectionModels(connections).sort((a, b) => collator.compare(sortKey(a), sortKey(b)))
		this.emptyStateText = 'No results. Click "Test" on each connection to populate the list of models.'
	}

	getSuggestions(query: string): ConnectionModel[] {
		return this.models.filter((model) => model.model.toLowerCase().includes(query.toLowerCase()))
	}

	renderSuggestion({ connection, model }: ConnectionModel, el: HTMLElement) {
		el.createEl('div', { text: model, cls: 'llmdocs-suggest-item-title' })
		el.createEl('small', {
			text: `${connection.type} @ ${connection.baseUrl}`,
			cls: 'llmdocs-suggest-item-subtext',
		})
	}

	onChooseSuggestion(model: ConnectionModel, evt: MouseEvent | KeyboardEvent) {
		modelSelected.emit('change', model.model)
	}
}

function sortKey(model: ConnectionModel): string {
	return getConnectionId(model.connection) + '_' + model.model
}
