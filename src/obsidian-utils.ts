import { App, Workspace } from 'obsidian'
import { DocOpenMethods } from './settings'

const imageExtensions = ['png', 'jpg', 'jpeg', 'gif']
const textExtensions = ['txt', 'md', 'markdown', 'html']

export function getDocLinkResolver(app: App, sourcePath = ''): (link: string) => Promise<string | null> {
	return async function linkResolver(link: string) {
		const file = app.metadataCache.getFirstLinkpathDest(link, sourcePath)
		if (!file || !textExtensions.includes(file.extension)) {
			return null
		}
		return app.vault.cachedRead(file)
	}
}

export function getImageLinkResolver(app: App, sourcePath = ''): (link: string) => Promise<string | null> {
	return async function linkResolver(link: string) {
		const file = app.metadataCache.getFirstLinkpathDest(link, sourcePath)
		if (!file || !imageExtensions.includes(file.extension)) {
			return null
		}
		const arrayBuffer = await app.vault.readBinary(file)
		const str = Buffer.from(arrayBuffer).toString('base64')
		const type = file.extension === 'jpg' ? 'jpeg' : file.extension
		return `data:image/${type};base64,${str}`
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
