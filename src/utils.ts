export interface SplitPart {
	text: string
	isSeparator?: true
	innerMatch?: string
}

export function splitKeepingSeparators(input: string, separator: RegExp): SplitPart[] {
	const regex = new RegExp(separator)
	const parts: SplitPart[] = []
	let match: RegExpMatchArray | null
	let lastPos = 0
	while ((match = regex.exec(input)) !== null) {
		const { index } = match
		if (index === undefined) {
			throw new Error('Index was undefined in splitKeepingSeparators()')
		}
		const before = input.substring(lastPos, match.index)
		if (before) {
			parts.push({ text: before })
		}
		const text = match[0]
		parts.push({ text, isSeparator: true, innerMatch: match[1] })
		lastPos = regex.lastIndex
	}
	const after = input.substring(lastPos)
	if (after) {
		parts.push({ text: after })
	}
	return parts
}

export class ValueEmitter<T> {
	listeners = new Set<(arg: T) => void>()

	on(listener: (arg: T) => void) {
		this.listeners.add(listener)
		// Return an unsubscribe function
		return () => this.off(listener)
	}

	off(listener: (arg: T) => void) {
		this.listeners.delete(listener)
	}

	once(listener: (arg: T) => void) {
		const wrappedListener = (arg: T) => {
			this.off(wrappedListener)
			listener(arg)
		}
		return this.on(wrappedListener)
	}

	emit(data: T) {
		for (const listener of this.listeners) {
			listener(data)
		}
	}
}
