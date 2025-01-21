import { OpenaiMessage } from './open-ai'

export function textToMessages(text: string): OpenaiMessage[] {
	const lines = text.split('\n')
	let currentRole: 'system' | 'user' | 'assistant' | null = null
	let currentLines: string[] = []
	const messages: OpenaiMessage[] = []
	for (const line of lines) {
		let newRole: 'system' | 'user' | 'assistant' | null = null
		if (line === '# system') {
			newRole = 'system'
		}
		if (line === '# user') {
			newRole = 'user'
		}
		if (line === '# assistant') {
			newRole = 'assistant'
		}
		if (newRole) {
			if (currentRole) {
				messages.push({ role: currentRole, content: currentLines.join('\n') })
			}
			currentLines = []
			currentRole = newRole
		} else {
			currentLines.push(line)
		}
	}
	if (currentRole) {
		messages.push({ role: currentRole, content: currentLines.join('\n') })
	}

	return messages
}

export function messagesToText(messages: OpenaiMessage[]): string {
	const segments = messages.map((message) => `# ${message.role}\n${message.content}`)
	return segments.join('\n')
}
