import { request } from 'node:https'
import { EventEmitter } from 'node:events'
import { OpenaiModel, OpenaiSettings } from './settings'

export interface OpenaiMessage {
	role: 'user' | 'assistant' | 'system'
	content: string
}

export class OpenaiChatCompletionStream extends EventEmitter {
	entireContent = ''

	private currentRequest: ReturnType<typeof request>
	private stopped = false

	constructor(private settings: OpenaiSettings, private model: OpenaiModel, private messages: OpenaiMessage[]) {
		super()
	}

	start() {
		const data = JSON.stringify({
			model: this.model,
			messages: this.messages,
			stream: true,
		})

		const options = {
			hostname: this.settings.host,
			port: 443,
			path: '/v1/chat/completions',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.apiKey}`,
			},
		}

		const req = this.currentRequest = request(options, (res) => {
			res.on('data', (chunk) => {
				if (this.stopped) return
				try {
					const text = chunk.toString()
					try {
						const { error } = JSON.parse(text)
						if (error) {
							switch (error.code) {
								case 'invalid_api_key':
									this.emit('error', new Error('Invalid OpenAI API key'))
									break
								default:
									if (error.message.startsWith("You didn't provide an API key")) {
										this.emit('error', new Error('You must provide an OpenAI API key'))
									} else {
										this.emit('error', new Error(error.message))
									}
							}
							this.stop()
						}
					} catch (error) {
						// ignore
					}
					const lines = text.split('\n')
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
										this.entireContent += content
										this.emit('data', content)
									}
								} catch (error) {
									// todo: clean this up
									console.log({error, jsonData, line})
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
				this.removeAllListeners()
			})
		})

		req.on('error', (error) => {
			console.log('error', error) // todo: remove
			this.emit('error', error)
		})

		req.write(data)
		req.end()
	}

	result() {
		return new Promise<string>((resolve, reject) => {
			this.on('error', (error) => reject(error))
			this.on('end', () => resolve(this.entireContent))
			this.start()
		})
	}

	stop() {
		if (this.currentRequest && !this.stopped) {
			this.stopped = true
			this.currentRequest.destroy()

			// todo: necessary?
			this.emit('end')
			this.removeAllListeners()
		}
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
