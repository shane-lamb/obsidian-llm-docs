import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from '@codemirror/view'
import { RangeSetBuilder, Text } from '@codemirror/state'

import { Editor, editorInfoField, getIcon, TFile } from 'obsidian'
import { fileEvents, getLlmDocsPlugin, isFileBeingProcessed } from './registry'

type PosRange = { from: number; to: number }

class LlmDocsCodemirrorPlugin implements PluginValue {
	decorations: DecorationSet
	cursorCanBeObscured: boolean

	constructor(private readonly view: EditorView) {
		this.rebuild()
	}

	update(update: ViewUpdate) {
		// calculate whether the cursor would be hidden by displaying the footer
		let cursorCanBeObscured = this.cursorCanBeObscured
		if (update.selectionSet) {
			const outOfInsertMode = (this.view as any).cm?.state?.vim?.insertMode === false
			if (outOfInsertMode) {
				const { doc, selection } = this.view.state
				const distToEnd = doc.length - selection.main.to
				cursorCanBeObscured = distToEnd === 0
			} else {
				cursorCanBeObscured = false
			}
		}

		if (update.docChanged || update.viewportChanged || cursorCanBeObscured !== this.cursorCanBeObscured) {
			this.cursorCanBeObscured = cursorCanBeObscured
			this.rebuild()
		}
	}

	rebuild() {
		this.decorations = this.buildDecorations()
	}

	private buildDecorations(): DecorationSet {
		if (!this.enabled()) {
			return Decoration.none
		}

		const { state, viewport } = this.view
		const { doc } = state

		const { file, editor } = state.field(editorInfoField)
		if (!file || !editor) {
			// todo: unsure if this code would ever be reached
			console.error('Could not decorate: missing file or editor', { file, editor })
			return Decoration.none
		}

		const builder = new RangeSetBuilder<Decoration>()

		const startLine = doc.lineAt(viewport.from)
		const endLine = doc.lineAt(viewport.to)
		let offset = startLine.from
		let promptStart: number | null = null
		for (const line of doc.iterLines(startLine.number, endLine.number + 1)) {
			if (line.startsWith('# ')) {
				if (line === '# system') {
					promptStart = null
					builder.add(
						offset,
						offset + line.length,
						Decoration.mark({
							class: 'llmdocs-heading-system',
						}),
					)
				} else if (line === '# user') {
					promptStart = offset + line.length
					builder.add(
						offset,
						promptStart,
						Decoration.mark({
							class: 'llmdocs-heading-user',
						}),
					)
				} else if (line === '# assistant') {
					promptStart = offset + line.length
					builder.add(
						offset,
						promptStart,
						Decoration.mark({
							class: 'llmdocs-heading-assistant',
						}),
					)
				}
			}
			offset += line.length + 1
		}

		if (this.shouldAddFooter(doc, viewport, file, promptStart)) {
			const lastLine = doc.line(doc.lines)
			builder.add(
				lastLine.to,
				lastLine.to,
				Decoration.widget({
					widget: new FooterWidget(editor, file, this),
					side: 1,
				}),
			)
		}

		return builder.finish()
	}

	shouldAddFooter(doc: Text, viewport: PosRange, file: TFile, promptStart: number | null) {
		// the bottom of the document isn't in view - don't add footer
		if (doc.length > viewport.to) {
			return false
		}

		// if a file is being processed we need to show the loading indicator
		if (isFileBeingProcessed(file)) {
			return true
		}

		// if a file isn't being processed then we should add footer if the button should be displayed...

		// if there's no prompt start in view, let's just act as if there's one somewhere above (outside the current viewable window)
		if (!promptStart) {
			return true
		}

		// if the prompt text has nothing but whitespace, don't show
		const promptText = doc.sliceString(promptStart)
		if (!promptText.trim()) {
			return false
		}

		// don't show the footer if doing so will hide the cursor
		if (this.cursorCanBeObscured) {
			return false
		}

		return true
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

	destroy() {}
}

export class FooterWidget extends WidgetType {
	private button: HTMLButtonElement
	private loadingIndicator: HTMLSpanElement

	constructor(
		private editor: Editor,
		private file: TFile,
		private plugin: LlmDocsCodemirrorPlugin,
	) {
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

		this.onEvent(true)
		fileEvents.on('change', this.onEvent)

		container.append(button, loadingIndicator)
		return container
	}

	onEvent(calledOnInit: boolean) {
		if (isFileBeingProcessed(this.file)) {
			this.button.hide()
			this.loadingIndicator.show()
		} else {
			this.loadingIndicator.hide()
			if (!calledOnInit) {
				// Trigger deletion of widget by forcing update of plugin.
				// The plugin doesn't update by itself since the processing status change comes AFTER the file is finished updating.
				this.plugin.rebuild()
			}
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

export const llmDocsCodemirrorPlugin = ViewPlugin.fromClass(LlmDocsCodemirrorPlugin, pluginSpec)
