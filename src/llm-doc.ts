import { App, Editor, getFrontMatterInfo, parseYaml, TFile } from 'obsidian'
import { OpenaiChatCompletionStream, OpenaiBasicMessage } from './open-ai'
import { messagesToText, preprocessMessages, textToMessages } from './llm-doc-util'
import { DefaultsSettings, LlmConnectionSettings } from './settings'
import { getImageLinkResolver, getDocLinkResolver, appendToEditor } from './obsidian-utils'
import { resolveConnectionForModel } from './connection-models'

export interface LlmDocProperties {
	model: string
}

type CompletionStream = OpenaiChatCompletionStream
const completionStream = OpenaiChatCompletionStream

export class LlmDoc {
	private currentStream: CompletionStream | null = null

	private constructor(
		private app: App,
		public file: TFile,
		private messages: OpenaiBasicMessage[],
		private properties: LlmDocProperties,
	) {}

	static async fromFile(app: App, file: TFile, defaults: DefaultsSettings): Promise<LlmDoc> {
		const text = await app.vault.read(file)
		const fmInfo = getFrontMatterInfo(text)
		const frontmatter = fmInfo.exists ? parseYaml(fmInfo.frontmatter) : {}
		const properties: LlmDocProperties = {
			model: defaults.model,
			...frontmatter,
		}
		const withoutFrontmatter = text.slice(fmInfo.contentStart)
		const messages = textToMessages(withoutFrontmatter)
		return new LlmDoc(app, file, messages, properties)
	}

	static async create(
		app: App,
		path: string,
		properties: LlmDocProperties,
		messages: OpenaiBasicMessage[],
	): Promise<LlmDoc> {
		const text = messagesToText(messages)
		const file = await app.vault.create(path, text)
		await app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.model = properties.model
		})
		return new LlmDoc(app, file, messages, properties)
	}

	async stop() {
		this.currentStream?.stop()
	}

	async complete(connections: LlmConnectionSettings[], editor: Editor) {
		const connectionSettings = await resolveConnectionForModel(connections, this.properties.model)
		if (!connectionSettings) {
			throw new Error(`No connection found for model "${this.properties.model}"`)
		}

		// update model in frontmatter if not set and default was used
		await this.app.fileManager.processFrontMatter(this.file, (frontmatter) => {
			frontmatter.model = this.properties.model
		})

		const stream = new completionStream(
			connectionSettings,
			this.properties.model,
			await preprocessMessages(
				this.messages,
				getDocLinkResolver(this.app, this.file.path),
				getImageLinkResolver(this.app, this.file.path),
			),
		)

		this.currentStream = stream

		let headingAdded = false
		stream.on('data', (data: string) => {
			if (!headingAdded) {
				this.app.vault.append(this.file, '\n# assistant\n')
				headingAdded = true
			}
			// tried appending to the file using the editor, but that causes janky scrolling during completion, so I've reverted to using vault.append
			this.app.vault.append(this.file, data)
			// appendToEditor(editor, data)
		})

		await stream.result()

		await this.app.vault.append(this.file, '\n# user\n')

		// hack to ensure editor has the latest file changes before setting cursor position
		await sleep(10)

		editor.setCursor({ line: editor.lastLine(), ch: 0 })
	}
}
