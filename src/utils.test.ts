import { describe, expect, test } from '@jest/globals'
import { splitKeepingSeparators } from './utils'

describe('utils', () => {
	test('splitKeepingSeparators()', () => {
		const separator = /\[(.+?)]/g

		// when only non-separator
		expect(splitKeepingSeparators('a', separator)).toEqual([{ text: 'a' }])

		// when only separator
		expect(splitKeepingSeparators('[a]', separator)).toEqual([{ text: '[a]', isSeparator: true, innerMatch: 'a' }])

		// when separator side-by-side
		expect(splitKeepingSeparators('[a][b]', separator)).toEqual([
			{
				text: '[a]',
				isSeparator: true,
				innerMatch: 'a',
			},
			{
				text: '[b]',
				isSeparator: true,
				innerMatch: 'b',
			},
		])

		// when starts with non-separator and ends with separator
		expect(splitKeepingSeparators('a [b] c [d]', separator)).toEqual([
			{
				text: 'a ',
			},
			{
				text: '[b]',
				isSeparator: true,
				innerMatch: 'b',
			},
			{
				text: ' c ',
			},
			{
				text: '[d]',
				isSeparator: true,
				innerMatch: 'd',
			},
		])

		// when starts with separator and ends with non-separator
		expect(splitKeepingSeparators('[a] b [c] d', separator)).toEqual([
			{
				text: '[a]',
				isSeparator: true,
				innerMatch: 'a',
			},
			{
				text: ' b ',
			},
			{
				text: '[c]',
				isSeparator: true,
				innerMatch: 'c',
			},
			{
				text: ' d',
			},
		])
	})
})
