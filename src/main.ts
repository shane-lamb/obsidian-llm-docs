import { Editor, MarkdownView, normalizePath, Notice, Plugin, TFile } from 'obsidian'

import { LlmDoc } from './llm-doc'
import { defaultPluginSettings, DocOpenMethods, PluginSettings } from './settings'
import { llmDocsCodemirrorPlugin } from './editor-extension'
import { OpenaiBasicMessage } from './open-ai'
import {
	fileProcessingStarted,
	fileProcessingStopped,
	ILlmDocsPlugin,
	isFileBeingProcessed,
	setLlmDocsPlugin,
} from './registry'
import { getLeaf } from './obsidian-utils'
import { SettingsTab } from './settings-tab'
import { ModelPickerModal } from './settings-tab/model-picker'

export default class LlmDocsPlugin extends Plugin implements ILlmDocsPlugin {
	settings: PluginSettings

	async onload() {
		await this.loadSettings()

		setLlmDocsPlugin(this)

		this.addRibbonIcon('bot', 'Create new LLM doc', () => {
			this.createNewDoc()
		})

		this.addCommand({
			id: 'create',
			name: 'Create new LLM document',
			callback: () => this.createNewDoc(),
		})

		this.addCommand({
			id: 'complete',
			name: 'Complete LLM document',
			editorCallback: async (editor, view) => {
				if (view.file) {
					await this.completeDoc(editor, view.file)
				}
			},
		})

		this.addCommand({
			id: 'chat_with_current_document',
			name: 'Chat with current document',
			editorCallback: async (editor, view) => {
				if (view.file) {
					await this.chatWithDoc(view.file)
				}
			},
		})

		this.addCommand({
			id: 'change_model',
			name: 'Change model used in current document',
			editorCallback: async (editor, view) => {
				if (!view.file) return

				const model = await new ModelPickerModal(this.app, this).openAndGetResult()
				if (model) {
					await this.app.fileManager.processFrontMatter(view.file, (frontmatter) => {
						const existingModel = frontmatter.model
						if (model !== existingModel) {
							frontmatter.model = model
							new Notice('Changed to ' + model)
						}
					})
				}
			},
		})

		this.addSettingTab(new SettingsTab(this.app, this))

		this.registerEditorExtension(llmDocsCodemirrorPlugin)
	}

	async completeDoc(editor: Editor, file: TFile) {
		if (isFileBeingProcessed(file)) {
			return
		}
		fileProcessingStarted(file)

		let doc: LlmDoc

		const onkeydown = (evt: KeyboardEvent) => {
			if (evt.key === 'Escape') {
				doc.stop()
				new Notice('Cancelling...')
			}
		}

		try {
			const view = this.app.workspace
				.getLeavesOfType('markdown')
				.map((leaf) => {
					const view = leaf.view as MarkdownView
					return view.file === file ? view : undefined
				})
				.filter(Boolean)[0]
			if (view) {
				// make sure current editor changes are readable from disk so as not to lose them
				await view.save()
			}

			doc = await LlmDoc.fromFile(this.app, file, this.settings.defaults)
			document.addEventListener('keydown', onkeydown)
			await doc.complete(this.settings.connections, editor)
		} catch (error) {
			new Notice(error)
		} finally {
			document.removeEventListener('keydown', onkeydown)
		}

		fileProcessingStopped(file)
	}

	async createNewDoc(docOpenMethod?: DocOpenMethods, systemPrompt?: string) {
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
			new Notice("Couldn't create - maximum of 100 files per day reached")
			return
		}

		const { defaults } = this.settings
		docOpenMethod = docOpenMethod ?? defaults.docOpenMethod
		systemPrompt = systemPrompt ?? defaults.systemPrompt
		// create the doc
		const doc = await LlmDoc.create(this.app, freePath, { model: defaults.model }, [
			...(systemPrompt.length ? [{ role: 'system', content: systemPrompt } as OpenaiBasicMessage] : []),
			{ role: 'user', content: '' },
		])

		// navigate to the doc
		const leaf = getLeaf(this.app.workspace, docOpenMethod)
		await leaf.openFile(doc.file)
		const active = this.app.workspace.activeEditor
		const editor = active?.editor
		if (editor) {
			editor.focus()
			editor.setCursor({ line: editor.lastLine(), ch: 0 })
		}
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, defaultPluginSettings, await this.loadData())
		// todo: delete all keys (recursively) that are not in defaultPluginSettings
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	private async chatWithDoc(file: TFile) {
		const newDocDir = normalizePath(this.settings.docsDir)
		const linkText = this.app.metadataCache.fileToLinktext(file, newDocDir)
		await this.createNewDoc(
			DocOpenMethods.splitVertical,
			`The user is referencing a document named "${file.name}" with the following content: [[${linkText}]]`,
		)
	}
}
