import { App } from 'obsidian'

export async function getLinkText(app: App, link: string, sourcePath = ''): Promise<string | null> {
	const file = app.metadataCache.getFirstLinkpathDest(link, sourcePath)
	if (!file) {
		return null
	}
	return app.vault.read(file)
}
