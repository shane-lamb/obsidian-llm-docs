import { Editor, TFile } from 'obsidian'

export const filesBeingProcessed: Set<TFile> = new Set()

export interface ILlmDocsPlugin {
    completeDoc: (editor: Editor, file: TFile) => Promise<void>
}

let llmDocsPlugin: ILlmDocsPlugin
export const getLlmDocsPlugin = () => llmDocsPlugin
export const setLlmDocsPlugin = (plugin: ILlmDocsPlugin) => llmDocsPlugin = plugin
