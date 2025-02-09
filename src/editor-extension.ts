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

import { Editor, editorInfoField, getIcon, TFile } from 'obsidian'
import { fileEvents, getLlmDocsPlugin, isFileBeingProcessed } from './registry'

class LlmDocsCodemirrorPlugin implements PluginValue {
	decorations: DecorationSet
	file: TFile | null = null
	editor?: Editor

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view)
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			// don't apply styling if no "model" property on frontmatter
			const info = update.view.state.field(editorInfoField)
			this.file = info.file
			this.editor = info.editor
			if (!this.file || !this.editor) {
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
		const pos = lastLine.to
		builder.add(
			pos,
			pos,
			Decoration.widget({
				widget: new CompleteWidget(this.editor!, this.file!),
				side: 1
			})
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
	private button: HTMLButtonElement
	private loadingIcon: HTMLSpanElement

	constructor(private editor: Editor, private file: TFile) {
		super()
		this.onEvent = this.onEvent.bind(this)
		this.button = document.createElement('button')
		this.loadingIcon = document.createElement('span')
	}

	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement('span')
		container.style.position = 'relative'
		container.style.display = 'block'

		const button = this.button
		button.innerText = 'Complete'
		button.onclick = async () => {
			if (this.editor && this.file) {
				this.editor.focus()
				await getLlmDocsPlugin().completeDoc(this.editor, this.file)
			}
		}
		button.style.position = 'absolute'
		button.style.top = '100%'
		button.style.marginTop = '1em'

		const loadingIcon = this.loadingIcon
		loadingIcon.append(getIcon('bot')!)
		loadingIcon.style.opacity = '0.5'
		loadingIcon.style.position = 'absolute'
		loadingIcon.style.top = '100%'
		loadingIcon.style.marginTop = '1em'

		this.onEvent()
		fileEvents.on('change', this.onEvent)

		container.append(button, loadingIcon)
		return container
	}

	onEvent() {
		if (isFileBeingProcessed(this.file)) {
			this.button.hide()
			this.loadingIcon.show()
		} else {
			this.loadingIcon.hide()
			this.button.show()
		}
	}

	destroy(dom: HTMLElement) {
		super.destroy(dom)
		fileEvents.off('change', this.onEvent)
	}
}
