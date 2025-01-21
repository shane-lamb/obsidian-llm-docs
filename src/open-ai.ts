import { request } from 'node:https'
import { EventEmitter } from 'node:events'

export const OpenaiDefaultModel = 'gpt-4o-mini'

export interface OpenaiMessage {
	role: 'user' | 'assistant' | 'system'
	content: string
}

export class OpenaiChatCompletionStream extends EventEmitter {
	entireContent = ''

	private currentRequest: ReturnType<typeof request>
	private stopped = false

	private readonly apiKey: string
	private readonly messages: OpenaiMessage[]
	private readonly model: string

	constructor(settings: { apiKey: string, messages: OpenaiMessage[], model?: string }) {
		super()

		this.apiKey = settings.apiKey
		this.messages = settings.messages
		this.model = settings.model ?? OpenaiDefaultModel
	}

	start() {
		const data = JSON.stringify({
			model: this.model,
			messages: this.messages,
			stream: true,
		})

		const options = {
			hostname: 'api.openai.com',
			port: 443,
			path: '/v1/chat/completions',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.apiKey}`,
			},
		}

		const req = this.currentRequest = request(options, (res) => {
			res.on('data', (chunk) => {
				if (this.stopped) return
				try {
					const lines = chunk.toString().split('\n')
					for (const line of lines) {
						if (line.startsWith('data: ')) {
							const jsonData = line.slice(6)
							if (jsonData === '[DONE]') {
								this.emit('done')
							} else {
								try {
									const parsed = JSON.parse(jsonData)
									const content = parsed.choices[0]?.delta?.content
									if (content) {
										console.log(content)
										this.entireContent += content
										this.emit('data', content)
									}
								} catch (error) {
									console.log(jsonData)
								}
							}
						}
					}
				}
				catch (error) {
					this.emit('error', error)
					this.stop()
				}
			})

			res.on('end', () => {
				console.log('end') // todo: remove
				this.emit('end')
			})
		})

		req.on('error', (error) => {
			console.log('error', error) // todo: remove
			this.emit('error', error)
		})

		req.write(data)
		req.end()
	}

	stop() {
		if (this.currentRequest && !this.stopped) {
			this.stopped = true
			this.currentRequest.destroy()
		}
	}
}
