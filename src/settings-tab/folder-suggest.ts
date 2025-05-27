import { AbstractInputSuggest, App } from 'obsidian'

// copied from https://forum.obsidian.md/t/how-to-make-file-location-selector-for-plugins-settings-page/95325
export class FolderSuggest extends AbstractInputSuggest<string> {
	private folders: string[]

	constructor(app: App, private inputEl: HTMLInputElement) {
		super(app, inputEl)
		// Get all folders and include root folder
		this.folders = ['/'].concat(this.app.vault.getAllFolders().map(folder => folder.path))
	}

	getSuggestions(inputStr: string): string[] {
		const inputLower = inputStr.toLowerCase()
		return this.folders.filter(folder =>
			folder.toLowerCase().includes(inputLower)
		)
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.createEl('div', {text: folder})
	}

	selectSuggestion(folder: string): void {
		this.setValue(folder)
		const event = new Event('input')
		this.inputEl.dispatchEvent(event)
		this.close()
	}
}
