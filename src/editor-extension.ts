import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType
} from '@codemirror/view'
import { RangeSetBuilder, Text } from '@codemirror/state'
import { editorInfoField, TFile } from 'obsidian'
import { filesBeingProcessed } from './registry'

class LlmDocsCodemirrorPlugin implements PluginValue {
	decorations: DecorationSet
	file: TFile | null = null

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view)
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			// don't apply styling if no "model" property on frontmatter
			const info = update.view.state.field(editorInfoField)
			this.file = info.file
			if (!this.file) {
				this.decorations = Decoration.none
				return
			}
			const frontmatter = info.app.metadataCache.getFileCache(this.file)?.frontmatter
			if (!frontmatter || !frontmatter.model) {
				this.decorations = Decoration.none
				return
			}

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
		let promptStart: number | null = null
		for (const line of doc.iterLines(startLine.number, endLine.number)) {
			if (line.startsWith('# ')) {
				if (line === '# system') {
					promptStart = null
					builder.add(
						offset,
						offset + line.length,
						Decoration.mark({
							class: 'llmdocs-heading-system'
						})
					)
				} else if (line === '# user') {
					promptStart = offset + line.length
					builder.add(
						offset,
						promptStart,
						Decoration.mark({
							class: 'llmdocs-heading-user'
						})
					)
				} else if (line === '# assistant') {
					promptStart = offset + line.length
					builder.add(
						offset,
						promptStart,
						Decoration.mark({
							class: 'llmdocs-heading-assistant'
						})
					)
				}
			}
			offset += line.length + 1
		}

		this.addCompleteButton(to, promptStart, doc, builder)

		return builder.finish()
	}

	addCompleteButton(viewportEnd: number, promptStart: number | null, doc: Text, builder: RangeSetBuilder<Decoration>) {
		if (!promptStart) {
			return
		}
		const promptText = doc.sliceString(promptStart).trim()
		if (!promptText) {
			return
		}
		const lastLine = doc.line(doc.lines)
		if (doc.length > viewportEnd) {
			return
		}
		if (filesBeingProcessed.has(this.file!)) {
			return
		}
		const pos = lastLine.to
		builder.add(
			pos,
			pos,
			Decoration.widget({widget: new CompleteWidget(), side: 1})
		)
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

export class CompleteWidget extends WidgetType {
	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement('span')
		container.style.position = 'relative'
		container.style.display = 'block'

		const button = document.createElement('button')
		button.innerText = 'Complete'
		button.style.position = 'absolute'
		button.style.top = '100%'
		button.style.marginTop = '1em'

		container.appendChild(button)
		return container
	}
}
