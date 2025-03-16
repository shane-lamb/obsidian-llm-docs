import { App, getFrontMatterInfo, TFile } from 'obsidian'
import { OpenaiChatCompletionStream, OpenaiBasicMessage } from './open-ai'
import { messagesToText, preprocessMessages, textToMessages } from './llm-doc-util'
import { DefaultsSettings, OpenaiSettings } from './settings'
import { getImageLinkResolver, getDocLinkResolver } from './obsidian-utils'

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
	) {
	}

	static async fromFile(app: App, file: TFile, defaults: DefaultsSettings): Promise<LlmDoc> {
		let properties = {} as LlmDocProperties
		await app.fileManager.processFrontMatter(file, (frontmatter) => {
			properties = {
				model: defaults.model,
				...frontmatter
			}
		})
		const text = await app.vault.read(file)
		const {contentStart} = getFrontMatterInfo(text)
		const withoutFrontmatter = text.slice(contentStart)
		const messages = textToMessages(withoutFrontmatter)
		return new LlmDoc(app, file, messages, properties)
	}

	static async create(app: App, path: string, properties: LlmDocProperties, messages: OpenaiBasicMessage[]): Promise<LlmDoc> {
		const text = messagesToText(messages)
		const file = await app.vault.create(path, text)
		await app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.model = properties.model
		})
		return new LlmDoc(app, file, messages, properties)
	}

	async write() {
		await this.app.fileManager.processFrontMatter(this.file, (frontmatter) => {
			frontmatter.model = this.properties.model
		})
		const newMessagesText = messagesToText(this.messages)
		const existingText = await this.app.vault.read(this.file)
		const {contentStart} = getFrontMatterInfo(existingText)
		const newText = existingText.slice(0, contentStart) + newMessagesText
		await this.app.vault.modify(this.file, newText)
	}

	async stop() {
		this.currentStream?.stop()
	}

	async complete(openai: OpenaiSettings) {
		const lastMessage = this.messages[this.messages.length - 1]
		const userIsLast = lastMessage.role !== 'assistant'
		if (userIsLast) {
			lastMessage.content = lastMessage.content.trimEnd()
		}

		await this.write()

		const stream = new completionStream(
			openai,
			this.properties.model,
			await preprocessMessages(
				this.messages,
				getDocLinkResolver(this.app, this.file.path),
				getImageLinkResolver(this.app, this.file.path),
			)
		)

		this.currentStream = stream

		let headingAdded = !userIsLast
		stream.on('data', (data: string) => {
			if (headingAdded) {
				this.app.vault.append(this.file, data)
			} else {
				headingAdded = true
				this.app.vault.append(this.file, '\n# assistant\n' + data)
			}
		})

		await stream.result()

		if (userIsLast) {
			this.messages.push({role: 'assistant', content: stream.entireContent})
		} else {
			lastMessage.content += stream.entireContent
		}
		this.messages.push({role: 'user', content: ''})
		await this.write()
	}
}
