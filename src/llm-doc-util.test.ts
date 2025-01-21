import { describe, expect, it } from '@jest/globals'
import { messagesToText, textToMessages } from './llm-doc-util'

describe('text to messages (and back to text)', () => {
	it('should work with all message types', () => {
		const originalText = `# system\nmessage 1\n# user\nmessage 2\n# assistant\nmessage 3`
		const messages = textToMessages(originalText)
		expect(messages).toEqual([
			{ role: 'system', content: 'message 1' },
			{ role: 'user', content: 'message 2' },
			{ role: 'assistant', content: 'message 3' },
		])
		const text = messagesToText(messages)
		expect(text).toEqual(originalText)
	})
})
