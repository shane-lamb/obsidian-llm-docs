import { App } from 'obsidian'

export function getLinkResolver(app: App, sourcePath = ''): (link: string) => Promise<string | null> {
	return async function linkResolver(link: string) {
		const file = app.metadataCache.getFirstLinkpathDest(link, sourcePath)
		if (!file) {
			return null
		}
		return app.vault.cachedRead(file)
	}
}
