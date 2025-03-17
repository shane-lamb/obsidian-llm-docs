import { OpenaiBasicMessage, OpenaiContent, OpenaiMessage } from './open-ai'
import { splitKeepingSeparators } from './utils'

export function textToMessages(text: string): OpenaiBasicMessage[] {
	const lines = text.split('\n')
	let currentRole: 'system' | 'user' | 'assistant' | null = null
	let currentLines: string[] = []
	const messages: OpenaiBasicMessage[] = []
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

	if (!messages.length) {
		messages.push({ role: 'user', content: text })
	}

	return messages
}

export function messagesToText(messages: OpenaiBasicMessage[]): string {
	const segments = messages.map((message) => `# ${message.role}\n${message.content}`)
	return segments.join('\n')
}

export async function preprocessMessages(
	messages: OpenaiBasicMessage[],
	textLinkResolver: (link: string) => Promise<string | null>,
	imageLinkResolver: (link: string) => Promise<string | null>,
): Promise<OpenaiMessage[]> {
	const cleaned = messages.filter((msg) => !(msg.role === 'system' && /^\s*$/.test(msg.content)))
	const expandedPromises = cleaned.map(async (msg) => {
		if (msg.role === 'assistant') {
			return msg
		}
		const text = await expandLinks(msg.content, textLinkResolver)
		const withImages = await resolveImages(text, imageLinkResolver)
		return {
			...msg,
			content: withImages,
		}
	})
	return Promise.all(expandedPromises)
}

async function resolveImages(
	content: string,
	linkResolver: (linkText: string) => Promise<string | null>,
): Promise<OpenaiContent[] | string> {
	const promises = splitLinks(content).map(async (part) => {
		const textContent: OpenaiContent = {
			type: 'text',
			text: part.text,
		}
		if (part.isSeparator) {
			const resolved = await linkResolver(part.innerMatch!)
			if (!resolved) {
				return textContent
			}
			const imageContent: OpenaiContent = {
				type: 'image_url',
				image_url: { url: resolved },
			}
			return imageContent
		}
		return textContent
	})

	const parts = await Promise.all(promises)
	if (parts.some((part) => part.type === 'image_url')) {
		return parts
	}
	return content
}

async function expandLinks(
	content: string,
	linkResolver: (linkText: string) => Promise<string | null>,
): Promise<string> {
	const promises = splitLinks(content).map(async (part) => {
		if (part.isSeparator) {
			const resolved = await linkResolver(part.innerMatch!)
			return resolved ?? part.text
		}
		return part.text
	})
	return (await Promise.all(promises)).join('')
}

const splitLinks = (content: string) => splitKeepingSeparators(content, /!?\[\[(.+?)]]/g)
