import { Editor, TFile } from 'obsidian'
import { EventEmitter } from 'node:events'
import { ValueEmitter } from './utils'

const filesBeingProcessed: Set<TFile> = new Set()
export const fileEvents = new EventEmitter()

export function isFileBeingProcessed(file: TFile) {
	return filesBeingProcessed.has(file)
}

export function fileProcessingStarted(file: TFile) {
	filesBeingProcessed.add(file)
	fileEvents.emit('change')
}

export function fileProcessingStopped(file: TFile) {
	filesBeingProcessed.delete(file)
	fileEvents.emit('change')
}

export interface ILlmDocsPlugin {
	completeDoc: (editor: Editor, file: TFile) => Promise<void>
}

let llmDocsPlugin: ILlmDocsPlugin
export const getLlmDocsPlugin = () => llmDocsPlugin
export const setLlmDocsPlugin = (plugin: ILlmDocsPlugin) => (llmDocsPlugin = plugin)

export const modelCacheUpdated = new ValueEmitter<void>()
