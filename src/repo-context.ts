import * as ignore from 'ignore'
import * as fs from 'node:fs'
import * as path from 'node:path'

export async function buildRepoContext(pathToRepo: string): Promise<string> {
	const ignored = ignore().add(getIfExists(path.join(pathToRepo, '.gitignore')))
	const included = ignore().add(getIfExists(path.join(pathToRepo, '.contextinclude')))

	let prompt = 'The repository contains the following list of files:\n'
	const files = getFilesRecursive(pathToRepo)
	const filteredFiles = ignored.filter(files)

	prompt += filteredFiles.join('\n')

	const includedFiles = filteredFiles.filter(file => included.ignores(file))

	prompt += '\n\n'
	prompt += includedFiles.map(file => getFileContent(pathToRepo, file)).join('\n\n')

	return prompt
}

function getFileContent(rootDir:string, filePath: string): string {
	const content = fs.readFileSync(path.join(rootDir, filePath)).toString()
	return filePath + ' contents:\n' + content
}

function getFilesRecursive(rootDir: string, subDir = ''): string[] {
	const objs = fs.readdirSync(path.join(rootDir, subDir), { withFileTypes: true })
	let files = []
	let dirs = []
	for (const obj of objs) {
		if (obj.isFile()) {
			files.push(path.join(subDir, obj.name))
		} else {
			dirs.push(path.join(subDir, obj.name))
		}
	}
	// sort files and dirs alphabetically
	files = files.sort((a, b) => a.localeCompare(b))
	dirs = dirs.sort((a, b) => a.localeCompare(b))
	for (const dir of dirs) {
		files.push(...getFilesRecursive(rootDir, dir))
	}
	return files
}

function getIfExists(filePath: string) {
	if (fs.existsSync(filePath)) {
		return fs.readFileSync(filePath).toString()
	}
	return ''
}
