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

export async function preprocessMessages(
	messages: OpenaiMessage[],
	linkResolver: (linkText: string) => Promise<string | null>
): Promise<OpenaiMessage[]> {
	const cleaned = messages.filter(msg => !(msg.role === 'system' && /^\s*$/.test(msg.content)))
	const expanded = cleaned.map(async (msg) => {
		if (msg.role === 'assistant') {
			return msg
		}
		return {
			...msg,
			content: await expandLinks(msg.content, linkResolver)
		}
	})
	return Promise.all(expanded)
}

// LLM generated
async function expandLinks(content: string, linkResolver: (linkText: string) => Promise<string | null>): Promise<string> {
	// Regular expression to match links in the content
	const linkPattern = /\[\[(.*?)\]\]/g
	let match
	let resultContent = content

	// Array to keep track of promises for resolving all links in the content
	const promises = []

	// Array to track original matches and their index positions
	const matches = []

	// Find all matches and prepare promises for link resolution
	while ((match = linkPattern.exec(content)) !== null) {
		const linkText = match[1]
		matches.push({index: match.index, linkText})
		promises.push(linkResolver(linkText))
	}

	// Await promises to resolve
	const resolvedLinks = await Promise.all(promises)

	// Replace links with resolved content or keep them unchanged if resolution failed
	for (let i = matches.length - 1; i >= 0; i--) {
		const {index, linkText} = matches[i]
		const resolvedLink = resolvedLinks[i]

		// If link is resolved, replace it with the resolved content
		if (resolvedLink !== null) {
			resultContent = resultContent.substring(0, index) + resolvedLink + resultContent.substring(index + linkText.length + 4)
		}
	}

	return resultContent
}
