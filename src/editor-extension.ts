import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

class LlmDocsCodemirrorPlugin implements PluginValue {
	decorations: DecorationSet

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view)
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view)
		}
	}

	buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>()

		const { from, to } = view.viewport
		const { doc } = view.state
		const startLine = doc.lineAt(from)
		const endLine = doc.lineAt(to)
		let offset = startLine.from
		for (const line of doc.iterLines(startLine.number, endLine.number)) {
			if (line.startsWith('# ')) {
				if (line === '# system') {
					builder.add(
						offset,
						offset + line.length,
						Decoration.mark({
							class: 'llmdocs-heading-system'
						})
					)
				} else if (line === '# user') {
					builder.add(
						offset,
						offset + line.length,
						Decoration.mark({
							class: 'llmdocs-heading-user'
						})
					)
				} else if (line === '# assistant') {
					builder.add(
						offset,
						offset + line.length,
						Decoration.mark({
							class: 'llmdocs-heading-assistant'
						})
					)
				}
			}
			offset += line.length + 1
		}

		return builder.finish()
	}

	destroy() {
	}
}

const pluginSpec: PluginSpec<LlmDocsCodemirrorPlugin> = {
	decorations: (value: LlmDocsCodemirrorPlugin) => value.decorations,
}

export const llmDocsCodemirrorPlugin = ViewPlugin.fromClass(
	LlmDocsCodemirrorPlugin,
	pluginSpec
)
