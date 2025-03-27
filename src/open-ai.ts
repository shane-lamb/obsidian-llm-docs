import { EventEmitter } from 'node:events'
import { LlmConnectionSettings } from './settings'
import fetch, { Response } from 'node-fetch'

export type OpenaiRole = 'user' | 'assistant' | 'system'

export interface OpenaiBasicMessage {
	role: OpenaiRole
	content: string
}

export interface OpenaiMessage {
	role: OpenaiRole
	content: string | OpenaiContent[]
}

export interface OpenaiContent {
	type: 'text' | 'image_url'
	text?: string
	image_url?: {
		url: string
	}
}

export async function getAvailableOpenaiModels(settings: LlmConnectionSettings): Promise<string[]> {
	const response = await fetch(`${settings.baseUrl}/v1/models`, {
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${settings.apiKey}`,
		},
	})

	await throwOnBadResponse(response)

	const data: any = await response.json()
	return data.data.map((model: any) => model.id)
}

export class OpenaiChatCompletionStream extends EventEmitter {
	entireContent = ''

	private abortController?: AbortController

	constructor(
		private settings: LlmConnectionSettings,
		private model: string,
		private messages: OpenaiMessage[],
	) {
		super()
	}

	result() {
		return new Promise<string>((resolve, reject) => {
			this.on('error', (error) => reject(error))
			this.on('end', () => resolve(this.entireContent))
			this.start()
		})
	}

	async start() {
		try {
			await this.doRequest()
		} catch (error) {
			if (error.name !== 'AbortError') {
				this.emit('error', error)
			}
		} finally {
			this.emit('end')
			this.removeAllListeners()
		}
	}

	private async doRequest() {
		const data = JSON.stringify({
			model: this.model,
			messages: this.messages,
			stream: true,
		})

		this.abortController = new AbortController()

		const response = await fetch(`${this.settings.baseUrl}/v1/chat/completions`, {
			method: 'POST',
			body: data,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.settings.apiKey}`,
			},
			signal: this.abortController.signal,
		})

		await throwOnBadResponse(response)

		for await (const chunk of response.body!) {
			const content = this.parseChunkForContent(chunk.toString())
			if (content) {
				this.entireContent += content
				this.emit('data', content)
			}
		}
	}

	private parseChunkForContent(chunk: string): string {
		return chunk
			.toString()
			.split('\n')
			.map((line) => {
				if (line.startsWith('data: ')) {
					const json = line.slice(6)
					try {
						const data = JSON.parse(json)
						return data?.choices[0]?.delta?.content
					} catch (ex) {
						return undefined
					}
				}
				return undefined
			})
			.filter((data) => data !== undefined)
			.join('')
	}

	stop() {
		this.abortController?.abort()
	}
}

async function throwOnBadResponse(response: Response) {
	if (response.ok) {
		return
	}
	let json: any
	try {
		json = await response.json()
	} catch (ex) {
		throw new Error(`${response.status} ${response.statusText}`)
	}
	const error = json.error
	if (error.code === 'invalid_api_key') {
		throw new Error('Invalid OpenAI API key')
	}
	if (error.message.startsWith("You didn't provide an API key")) {
		throw new Error('You must provide an OpenAI API key')
	}
	throw new Error(error.message)
}

export class FakeChatCompletionStream extends EventEmitter {
	entireContent = ''

	private stopped = false

	constructor(settings: { apiKey: string; messages: OpenaiBasicMessage[]; model?: string }) {
		super()
	}

	start() {
		const repeatingOutput = 'testing '

		const interval = setInterval(() => {
			if (this.stopped) {
				clearInterval(interval)
				this.emit('end')
				return
			}

			this.entireContent += repeatingOutput
			this.emit('data', repeatingOutput)
		}, 100)

		setTimeout(() => {
			this.stop()
			this.emit('end')
		}, 5000)
	}

	stop() {
		this.stopped = true
	}
}
