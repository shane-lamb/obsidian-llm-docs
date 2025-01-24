import { describe, expect, it } from '@jest/globals'
import { messagesToText, preprocessMessages, textToMessages } from './llm-doc-util'
import { OpenaiMessage } from './open-ai'

describe('LLM doc util', () => {
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
		it('should use whole text as user message when no explicit messages', () => {
			const originalText = 'message'
			const messages = textToMessages(originalText)
			expect(messages).toEqual([
				{ role: 'user', content: 'message' },
			])
			const text = messagesToText(messages)
			expect(text).toEqual('# user\nmessage')
		})
	})
	describe('messages preprocessing', () => {
		it('should remove system prompt if it contains only whitespace', async () => {
			const messages: OpenaiMessage[] = [
				{ role: 'system', content: ' \n' },
				{ role: 'user', content: 'message' },
			]
			const result = await preprocessMessages(messages, async () => null)
			expect(result).toEqual([
				{ role: 'user', content: 'message' },
			])
		})
		it('should expand links in user/system messages but not in assistant messages', async () => {
			const messages: OpenaiMessage[] = [
				{ role: 'system', content: 'text [[mylink]] text' },
				{ role: 'user', content: 'text [[mylink]] text' },
				{ role: 'assistant', content: 'text [[mylink]] text' },
			]
			const resolver = async () => 'resolved'
			const result = await preprocessMessages(messages, resolver)
			expect(result).toEqual([
				{ role: 'system', content: 'text resolved text' },
				{ role: 'user', content: 'text resolved text' },
				{ role: 'assistant', content: 'text [[mylink]] text' },
			])
		})
		it('should leave links unchanged when they cannot be resolved', async () => {
			const messages: OpenaiMessage[] = [
				{ role: 'user', content: 'text [[mylink]] text' },
			]
			const resolver = async () => null
			const result = await preprocessMessages(messages, resolver)
			expect(result).toEqual([
				{ role: 'user', content: 'text [[mylink]] text' },
			])
		})
	})
})
