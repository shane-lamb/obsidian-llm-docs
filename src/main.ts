import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting, Notice, normalizePath } from 'obsidian'
import { OpenaiDefaultModel } from './open-ai'
import { LlmDoc } from './llm-doc'

import {
	ViewUpdate,
	PluginValue,
	EditorView,
	ViewPlugin,
	DecorationSet, Decoration, PluginSpec,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { defaultPluginSettings, PluginSettings } from './settings'

class EmojiListPlugin implements PluginValue {
	decorations: DecorationSet

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view)
		console.log('constructed')
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view)
		}
	}

	buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>()

		let offset = 0
		for (const text of view.state.doc.text) {
			if (text.startsWith('# ')) {
				if (text === '# system') {
					builder.add(
						offset,
						offset + text.length,
						Decoration.mark({
							class: 'llmdocs-heading-system'
						})
					)
				} else if (text === '# user') {
					builder.add(
						offset,
						offset + text.length,
						Decoration.mark({
							class: 'llmdocs-heading-user'
						})
					)
				} else if (text === '# assistant') {
					builder.add(
						offset,
						offset + text.length,
						Decoration.mark({
							class: 'llmdocs-heading-assistant'
						})
					)
				}
			}
			offset += text.length + 1
		}

		return builder.finish()
	}

	destroy() {
	}
}

const pluginSpec: PluginSpec<EmojiListPlugin> = {
	decorations: (value: EmojiListPlugin) => value.decorations,
}

export const emojiListPlugin = ViewPlugin.fromClass(
	EmojiListPlugin,
	pluginSpec
)

export default class LlmDocsPlugin extends Plugin {
	settings: PluginSettings

	async onload() {
		await this.loadSettings()

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
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const doc = await LlmDoc.fromFile(this.app, view.file!)
				// todo handle situation where openai key empty or not valid
				await doc.complete(this.settings.openai)
				editor.setCursor({line: editor.lastLine(), ch: 0})
			}
		})

		this.addSettingTab(new SettingsTab(this.app, this))

		this.registerEditorExtension(emojiListPlugin)
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
			new Notice("You're on fire!")
			return
		}

		// create the doc
		const doc = await LlmDoc.create(
			this.app,
			freePath,
			{model: OpenaiDefaultModel},
			[
				{role: 'system', content: 'system prompt here'},
				{role: 'user', content: ''}
			]
		)

		// navigate to the doc
		const leaf = this.app.workspace.getLeaf(false) // false = open in the current tab
		await leaf.openFile(doc.file)
	}

	onunload() {

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
			.setName('OpenAI Hostname')
			.setDesc('Change this if you want to use an OpenAI proxy or other OpenAI compatible API, rather than the official public API')
			.addText(text => text
				.setPlaceholder('api.openai.com')
				.setValue(this.plugin.settings.openai.host)
				.onChange(async (value) => {
					this.plugin.settings.openai.host = value
					await this.plugin.saveSettings()
				}))
	}
}
