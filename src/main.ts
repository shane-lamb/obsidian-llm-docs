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

		this.addCommand({
			id: 'create',
			name: 'Create new LLM document',
			callback: async () => {
				// todo: handle directory not existing (not yet created)
				// todo: handle directory being empty
				const dir = normalizePath(this.settings.docsDir)
				const doc = await LlmDoc.create(
					this.app,
					`${dir}/new.md`,
					{model: OpenaiDefaultModel},
					[
						{role: 'system', content: 'system prompt here'},
						{role: 'user', content: ''}
					]
				)
				const leaf = this.app.workspace.getLeaf(false) // false = open in the current tab
				await leaf.openFile(doc.file)
			}
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
