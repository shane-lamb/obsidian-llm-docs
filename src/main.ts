import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	Notice,
	normalizePath,
	TFile,
} from 'obsidian'

import { LlmDoc } from './llm-doc'
import { defaultPluginSettings, OpenaiModel, DocOpenMethods, PluginSettings } from './settings'
import { llmDocsCodemirrorPlugin } from './editor-extension'
import { OpenaiMessage } from './open-ai'
import { filesBeingProcessed, ILlmDocsPlugin, setLlmDocsPlugin } from './registry'
import { getLeaf } from './utils'

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

class SettingsTab extends PluginSettingTab {
	plugin: LlmDocsPlugin

	constructor(app: App, plugin: LlmDocsPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const {containerEl} = this

		containerEl.empty()

		new Setting(containerEl)
			.setName('LLM docs directory')
			.setDesc('The directory where new LLM documents will be created')
			.addText(text => text
				.setPlaceholder('path/to/directory')
				.setValue(this.plugin.settings.docsDir)
				.onChange(async (value) => {
					this.plugin.settings.docsDir = value
					await this.plugin.saveSettings()
				}))

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Your OpenAI API key for generating LLM responses')
			.addText(text => text
				.setPlaceholder('API key')
				.setValue(this.plugin.settings.openai.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.openai.apiKey = value
					await this.plugin.saveSettings()
				}))

		new Setting(containerEl)
			.setName('OpenAI base URL')
			.setDesc('Change this if you want to use an OpenAI proxy or other OpenAI compatible API, rather than the official public API')
			.addText(text => text
				.setPlaceholder('https://api.openai.com')
				.setValue(this.plugin.settings.openai.baseUrl)
				.onChange(async (value) => {
					this.plugin.settings.openai.baseUrl = value
					await this.plugin.saveSettings()
				}))

		const models: Record<OpenaiModel, string> = {
			'gpt-4o': 'GPT-4o',
			'gpt-4o-mini': 'GPT-4o mini',
		}
		new Setting(containerEl)
			.setName('Default model')
			.setDesc('The default LLM model variant to use for new LLM documents')
			.addDropdown(dropdown => dropdown
				.addOptions(models)
				.setValue(this.plugin.settings.defaults.model)
				.onChange(async (value) => {
					this.plugin.settings.defaults.model = value as OpenaiModel
					await this.plugin.saveSettings()
				}))

		new Setting(containerEl)
			.setName('Default system prompt')
			.setDesc('The default system prompt for new LLM documents')
			.addText(text => text
				.setPlaceholder('System prompt')
				.setValue(this.plugin.settings.defaults.systemPrompt)
				.onChange(async (value) => {
					this.plugin.settings.defaults.systemPrompt = value
					await this.plugin.saveSettings()
				}))

		const documentOpenMethods: Record<DocOpenMethods, string> = {
			'tab': 'a new tab',
			'splitVertical': 'a new split (vertical)',
			'splitHorizontal': 'a new split (horizontal)',
			'window': 'a new window',
			'replace': 'an existing tab',
		}
		new Setting(containerEl)
			.setName('Create new documents in...')
			.addDropdown(dropdown => dropdown
				.addOptions(documentOpenMethods)
				.setValue(this.plugin.settings.defaults.docOpenMethod)
				.onChange(async (value) => {
					this.plugin.settings.defaults.docOpenMethod = value as DocOpenMethods
					await this.plugin.saveSettings()
				}))
	}
}
