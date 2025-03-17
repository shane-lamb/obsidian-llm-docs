import { describe, expect, it } from '@jest/globals'
import { messagesToText, preprocessMessages, textToMessages } from './llm-doc-util'
import { OpenaiBasicMessage } from './open-ai'

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
			expect(messages).toEqual([{ role: 'user', content: 'message' }])
			const text = messagesToText(messages)
			expect(text).toEqual('# user\nmessage')
		})
	})
	describe('messages preprocessing', () => {
		it('should remove system prompt if it contains only whitespace', async () => {
			const messages: OpenaiBasicMessage[] = [
				{ role: 'system', content: ' \n' },
				{ role: 'user', content: 'message' },
			]
			const result = await preprocessMessages(messages, nullResolver, nullResolver)
			expect(result).toEqual([{ role: 'user', content: 'message' }])
		})
		it('should expand links in user/system messages but not in assistant messages', async () => {
			const messages: OpenaiBasicMessage[] = [
				{ role: 'system', content: 'text [[mylink]] text [[mylink]]' },
				{ role: 'user', content: 'text [[mylink]] text' },
				{ role: 'assistant', content: 'text [[mylink]] text' },
			]
			const resolver = async () => 'resolved'
			const result = await preprocessMessages(messages, resolver, nullResolver)
			expect(result).toEqual([
				{ role: 'system', content: 'text resolved text resolved' },
				{ role: 'user', content: 'text resolved text' },
				{ role: 'assistant', content: 'text [[mylink]] text' },
			])
		})
		it('should leave links unchanged when they cannot be resolved', async () => {
			const messages: OpenaiBasicMessage[] = [{ role: 'user', content: 'text [[mylink]] text' }]
			const resolver = async () => null
			const result = await preprocessMessages(messages, resolver, nullResolver)
			expect(result).toEqual([{ role: 'user', content: 'text [[mylink]] text' }])
		})
		it('should handle images', async () => {
			const messages: OpenaiBasicMessage[] = [
				{ role: 'user', content: 'Hello\n![[CleanShot 2025-03-12 at 13.11.51@2x.png]]\nworld.' },
			]
			const resolver = async () => 'data:image/jpeg;base64,{base64_image}'
			const result = await preprocessMessages(messages, nullResolver, resolver)
			expect(result).toEqual([
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: 'Hello\n',
						},
						{
							type: 'image_url',
							image_url: {
								url: 'data:image/jpeg;base64,{base64_image}',
							},
						},
						{
							type: 'text',
							text: '\nworld.',
						},
					],
				},
			])
		})
	})
})

const nullResolver = async () => null
