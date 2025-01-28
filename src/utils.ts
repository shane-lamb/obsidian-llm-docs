import { App, Workspace } from 'obsidian'
import { DocOpenMethods } from './settings'

export function getLinkResolver(app: App, sourcePath = ''): (link: string) => Promise<string | null> {
	return async function linkResolver(link: string) {
		const file = app.metadataCache.getFirstLinkpathDest(link, sourcePath)
		if (!file) {
			return null
		}
		return app.vault.cachedRead(file)
	}
}

export function getLeaf(workspace: Workspace, method: DocOpenMethods) {
	switch (method) {
		case DocOpenMethods.replace:
			return workspace.getLeaf()
		case DocOpenMethods.tab:
			return workspace.getLeaf('tab')
		case DocOpenMethods.splitVertical:
			return workspace.getLeaf('split', 'vertical')
		case DocOpenMethods.splitHorizontal:
			return workspace.getLeaf('split', 'horizontal')
		case DocOpenMethods.window:
			return workspace.getLeaf('window')
		default:
			return workspace.getLeaf('tab')
	}
}
