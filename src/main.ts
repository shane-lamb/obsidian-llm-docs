import { Editor, MarkdownView, Plugin, Notice, normalizePath, TFile } from 'obsidian'

import { LlmDoc } from './llm-doc'
import { defaultPluginSettings, PluginSettings } from './settings'
import { llmDocsCodemirrorPlugin } from './editor-extension'
import { OpenaiMessage } from './open-ai'
import { filesBeingProcessed, ILlmDocsPlugin, setLlmDocsPlugin } from './registry'
import { getLeaf } from './utils'
import { SettingsTab } from './settings-tab'

export default class LlmDocsPlugin extends Plugin implements ILlmDocsPlugin {
	settings: PluginSettings
	onkeydownListeners: ((evt: KeyboardEvent) => void)[] = []

	async onload() {
		await this.loadSettings()

		setLlmDocsPlugin(this)

		this.addRibbonIcon('bot', 'Create new LLM doc', () => {
			this.createNewDoc()
		})

		this.addCommand({
			id: 'create',
			name: 'Create new LLM document',
			callback: () => this.createNewDoc()
		})

		this.addCommand({
			id: 'complete',
			name: 'Complete LLM document',
			editorCallback: async (editor, view) => {
				const file: TFile = view.file!
				await this.completeDoc(editor, file)
			}
		})

		this.addSettingTab(new SettingsTab(this.app, this))

		this.registerEditorExtension(llmDocsCodemirrorPlugin)
	}

	async completeDoc(editor: Editor, file: TFile) {
		if (filesBeingProcessed.has(file)) {
			return
		}
		filesBeingProcessed.add(file)

		let doc: LlmDoc

		const onkeydown = (evt: KeyboardEvent) => {
			if (evt.key === 'Escape') {
				doc.stop()
				new Notice('Cancelling...')
			}
		}
		this.onkeydownListeners.push(onkeydown)

		try {
			const view = this.app.workspace.getLeavesOfType('markdown').map(leaf => {
				const view = leaf.view as MarkdownView
				return view.file === file ? view : undefined
			}).filter(Boolean)[0]
			if (view) {
				// make sure current editor changes are readable from disk so as not to lose them
				await view.save()
			}

			doc = await LlmDoc.fromFile(this.app, file, this.settings.defaults)
			document.addEventListener('keydown', onkeydown)
			await doc.complete(this.settings.openai)
			editor.setCursor({line: editor.lastLine(), ch: 0})
		} catch (error) {
			new Notice(error)
		}

		document.removeEventListener('keydown', onkeydown)
		this.onkeydownListeners.remove(onkeydown)
		filesBeingProcessed.delete(file)
	}

	async createNewDoc() {
		// create directory if it doesn't exist
		const dir = normalizePath(this.settings.docsDir)
		if (!this.app.vault.getAbstractFileByPath(dir)) {
			await this.app.vault.createFolder(dir)
		}

		// find the next free path
		const dateString = new Date().toISOString().split('T')[0]
		let freePath: string | null = null
		for (let i = 1; i < 100; i++) {
			const formattedNumber = i.toString().padStart(2, '0')
			const checkPath = `${dir}/${dateString}_${formattedNumber}_LLM.md`
			if (!this.app.vault.getAbstractFileByPath(checkPath)) {
				freePath = checkPath
				break
			}
		}
		if (!freePath) {
			new Notice('You\'re on fire!')
			return
		}

		const { model, systemPrompt, docOpenMethod } = this.settings.defaults
		// create the doc
		const doc = await LlmDoc.create(
			this.app,
			freePath,
			{model},
			[
				...(systemPrompt.length ? [{role: 'system', content: systemPrompt } as OpenaiMessage] : []),
				{role: 'user', content: ''}
			]
		)

		// navigate to the doc
		const leaf = getLeaf(this.app.workspace, docOpenMethod)
		await leaf.openFile(doc.file)
		const active = this.app.workspace.activeEditor
		const editor = active?.editor
		if (editor) {
			editor.setCursor({line: editor.lastLine(), ch: 0})
		}
	}

	onunload() {
		for (const listener of this.onkeydownListeners) {
			document.removeEventListener('keydown', listener)
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, defaultPluginSettings, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}
