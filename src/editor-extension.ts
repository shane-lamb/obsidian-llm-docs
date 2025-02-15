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

type PosRange = { from: number, to: number }

class LlmDocsCodemirrorPlugin implements PluginValue {
	decorations: DecorationSet

	constructor(private readonly view: EditorView) {
		this.decorations = this.buildDecorations()
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations()
		}
	}

	buildDecorations(): DecorationSet {
		if (!this.enabled()) {
			return Decoration.none
		}

		const {state, viewport} = this.view
		const {doc} = state

		const {file, editor} = state.field(editorInfoField)
		if (!file || !editor) {
			// todo: unsure if this code would ever be reached
			console.error('Could not decorate: missing file or editor', {file, editor})
			return Decoration.none
		}

		const builder = new RangeSetBuilder<Decoration>()

		const startLine = doc.lineAt(viewport.from)
		const endLine = doc.lineAt(viewport.to)
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

		this.addFooter(viewport, promptStart, doc, builder, file, editor)

		return builder.finish()
	}

	addFooter(
		viewport: PosRange,
		promptStart: number | null,
		doc: Text,
		builder: RangeSetBuilder<Decoration>,
		file: TFile,
		editor: Editor
	) {
		if (!promptStart) {
			return
		}
		const promptText = doc.sliceString(promptStart).trim()
		if (!promptText) {
			return
		}
		const lastLine = doc.line(doc.lines)
		if (doc.length > viewport.to) {
			return
		}
		const pos = lastLine.to
		builder.add(
			pos,
			pos,
			Decoration.widget({
				widget: new FooterWidget(editor, file),
				side: 1
			})
		)
	}

	enabled() {
		// don't apply decorations if no "model" property on frontmatter
		const lines = this.view.state.doc.iterLines()
		if (lines.next().value !== '---') {
			return false // no frontmatter
		}
		for (const line of lines) {
			if (line.startsWith('model:')) {
				return true
			}
			if (line === '---') {
				return false
			}
		}
		return false
	}

	destroy() {
	}
}

export class FooterWidget extends WidgetType {
	private button: HTMLButtonElement
	private loadingIndicator: HTMLSpanElement

	constructor(private editor: Editor, private file: TFile) {
		super()
		this.onEvent = this.onEvent.bind(this)
		this.button = document.createElement('button')
		this.loadingIndicator = document.createElement('span')
	}

	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement('span')
		container.className = 'llmdocs-footer'

		const button = this.button
		button.innerText = 'Complete'
		button.className = 'llmdocs-complete-button'
		button.onclick = async () => {
			this.editor.focus()
			await getLlmDocsPlugin().completeDoc(this.editor, this.file)
		}

		const loadingIndicator = this.loadingIndicator
		loadingIndicator.append(getIcon('bot')!)
		loadingIndicator.className = 'llmdocs-loading-indicator'

		this.onEvent()
		fileEvents.on('change', this.onEvent)

		container.append(button, loadingIndicator)
		return container
	}

	onEvent() {
		if (isFileBeingProcessed(this.file)) {
			this.button.hide()
			this.loadingIndicator.show()
		} else {
			this.loadingIndicator.hide()
			this.button.show()
		}
	}

	destroy(dom: HTMLElement) {
		fileEvents.off('change', this.onEvent)
		super.destroy(dom)
	}
}

const pluginSpec: PluginSpec<LlmDocsCodemirrorPlugin> = {
	decorations: (value: LlmDocsCodemirrorPlugin) => value.decorations,
}

export const llmDocsCodemirrorPlugin = ViewPlugin.fromClass(
	LlmDocsCodemirrorPlugin,
	pluginSpec
)
