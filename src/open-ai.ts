import { EventEmitter } from 'node:events'
import { OpenaiModel, OpenaiSettings } from './settings'
import fetch from 'node-fetch'

export interface OpenaiMessage {
	role: 'user' | 'assistant' | 'system'
	content: string
}

export class OpenaiChatCompletionStream extends EventEmitter {
	entireContent = ''

	private abortController?: AbortController

	constructor(private settings: OpenaiSettings, private model: OpenaiModel, private messages: OpenaiMessage[]) {
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
			const mappedError = this.mapError(error)
			if (mappedError) {
				this.emit('error', mappedError)
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
				'Authorization': `Bearer ${this.settings.apiKey}`,
			},
			signal: this.abortController.signal
		})

		if (!response.ok) {
			let json: any
			try {
				json = await response.json()
			}
			catch (ex) {
				throw new Error(`${response.status} ${response.statusText}`)
			}
			throw json.error
		}

		for await (const chunk of response.body!) {
			const content = this.parseChunkForContent(chunk.toString())
			if (content) {
				this.entireContent += content
				this.emit('data', content)
			}
		}
	}

	private parseChunkForContent(chunk: string): string {
		return chunk.toString()
			.split('\n')
			.map(line => {
				if(line.startsWith('data: ')) {
					const json = line.slice(6)
					try {
						const data = JSON.parse(json)
						return data?.choices[0]?.delta?.content
					}
					catch (ex) {
						return undefined
					}
				}
				return undefined
			})
			.filter(data => data !== undefined)
			.join('')
	}

	private mapError(error: any): Error | null {
		if (error.name === 'AbortError') {
			return null // ignore
		}
		if (error.code === 'invalid_api_key') {
			return new Error('Invalid OpenAI API key')
		}
		if (error.message.startsWith('You didn\'t provide an API key')) {
			return new Error('You must provide an OpenAI API key')
		}
		return new Error(error.message)
	}

	stop() {
		this.abortController?.abort()
	}
}

export class FakeChatCompletionStream extends EventEmitter {
	entireContent = ''

	private stopped = false

	constructor(settings: { apiKey: string, messages: OpenaiMessage[], model?: string }) {
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
