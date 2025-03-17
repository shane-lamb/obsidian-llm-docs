import { LlmConnectionSettings } from './settings'
import { getAvailableOpenaiModels } from './open-ai'

const modelToConnectionIdCache = new Map<string, string>()

function getConnectionId(connection: LlmConnectionSettings) {
	return connection.type + connection.baseUrl
}

function resolveCachedConnectionForModel(
	connections: LlmConnectionSettings[],
	model: string,
): LlmConnectionSettings | null {
	const cachedConnectionId = modelToConnectionIdCache.get(model)
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

	const promises = connections.map((connection) =>
		getAvailableOpenaiModels(connection)
			.then((models) => {
				if (!models) {
					return
				}
				for (const model of models) {
					modelToConnectionIdCache.set(model, getConnectionId(connection))
				}
			})
			.catch(() => {}),
	)
	await Promise.all(promises)

	return resolveCachedConnectionForModel(connections, model)
}
