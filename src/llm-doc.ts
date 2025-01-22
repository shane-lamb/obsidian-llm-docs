import { App, getFrontMatterInfo, TFile } from 'obsidian'
import { FakeChatCompletionStream, OpenaiChatCompletionStream, OpenaiDefaultModel, OpenaiMessage } from './open-ai'
import { messagesToText, textToMessages } from './llm-doc-util'
import { OpenaiSettings } from './settings'

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
		private messages: OpenaiMessage[],
		private properties: LlmDocProperties,
	) {
	}

	static async fromFile(app: App, file: TFile): Promise<LlmDoc> {
		let properties = {} as LlmDocProperties
		await app.fileManager.processFrontMatter(file, (frontmatter) => {
			const defaults: LlmDocProperties = {
				model: OpenaiDefaultModel,
			}
			properties = { ...defaults, ...frontmatter }
		})
		const text = await app.vault.read(file)
		const {contentStart} = getFrontMatterInfo(text)
		const withoutFrontmatter = text.slice(contentStart)
		const messages = textToMessages(withoutFrontmatter)
		return new LlmDoc(app, file, messages, properties)
	}

	static async create(app: App, path: string, properties: LlmDocProperties, messages: OpenaiMessage[]): Promise<LlmDoc> {
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
		if (this.messages.length === 0) {
			return // todo
		}

		let lastMessage = this.messages[this.messages.length - 1]
		lastMessage.content = lastMessage.content.trimEnd()
		if (lastMessage.role !== 'assistant') {
			this.messages.push({role: 'assistant', content: ''})
		}

		await this.write()

		const stream = new completionStream({
			apiKey: openai.apiKey,
			messages: this.messages,
		})

		this.currentStream = stream

		await new Promise<void>((resolve, reject) => {
			const onData = (data: string) => {
				this.app.vault.append(this.file, data)
			}
			stream.on('data', onData)

			const onError = (error: any) => {
			}
			stream.on('error', (error) => {
				reject(error)
			})

			stream.on('end', (data) => {
				stream.off('data', onData)
				stream.off('end', onData)
				stream.off('error', onError)
				resolve()
			})

			stream.start()
		})

		lastMessage = this.messages[this.messages.length - 1]
		lastMessage.content += stream.entireContent
		this.messages.push({role: 'user', content: ''})
		await this.write()
	}
}
