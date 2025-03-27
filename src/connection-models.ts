import { LlmConnectionSettings } from './settings'
import { getAvailableOpenaiModels } from './open-ai'
import { modelCacheUpdated } from './registry'

const modelToConnectionCache = new Map<string, string>()

export interface ConnectionModel {
	connection: LlmConnectionSettings
	model: string
}

export function getCachedConnectionModels(connections: LlmConnectionSettings[]): ConnectionModel[] {
	const models: ConnectionModel[] = []
	for (const connection of connections) {
		const connectionId = getConnectionId(connection)
		for (const [model, id] of modelToConnectionCache) {
			if (id === connectionId) {
				models.push({ connection, model })
			}
		}
	}
	return models
}

export function getConnectionId(connection: LlmConnectionSettings) {
	return connection.type + connection.baseUrl
}

export async function getAvailableModelsAndUpdateCache(connection: LlmConnectionSettings) {
	let models = await getAvailableOpenaiModels(connection)
	for (const model of models) {
		modelToConnectionCache.set(model, getConnectionId(connection))
	}
	modelCacheUpdated.emit('change')
}

function resolveCachedConnectionForModel(
	connections: LlmConnectionSettings[],
	model: string,
): LlmConnectionSettings | null {
	const cachedConnectionId = modelToConnectionCache.get(model)
	if (cachedConnectionId) {
		const matching = connections.find((connection) => getConnectionId(connection) === cachedConnectionId)
		if (matching) {
			return matching
		}
	}
	return null
}

export async function resolveConnectionForModel(
	connections: LlmConnectionSettings[],
	model: string,
): Promise<LlmConnectionSettings | null> {
	const cached = resolveCachedConnectionForModel(connections, model)
	if (cached) {
		return cached
	}

	const promises = connections.map((connection) => getAvailableModelsAndUpdateCache(connection).catch(() => {}))
	await Promise.all(promises)

	return resolveCachedConnectionForModel(connections, model)
}
