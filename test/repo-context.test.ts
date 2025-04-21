import { beforeEach, describe, expect, test } from '@jest/globals'
import { buildRepoContext } from '../src/repo-context'
import * as path from 'node:path'
import * as fs from 'node:fs'

describe('building repo context', () => {
	beforeEach(() => {
		// reset git status
	})

	test('calculator repo', async () => {
		const repoDir = path.join(__dirname, 'fixtures', 'repos', 'calculator')

		// setup
		fs.writeFileSync(
			path.join(repoDir, '.contextinclude'),
			`
# README gives the intent/purpose of the repo/project
README.md
 
# include the whole of the source code as context as it's small enough
src/
`,
		)

		// execute
		const context = await buildRepoContext(repoDir)

		// assert
		expect(context).toEqual(
			`
The repository contains the following list of files:
.gitignore
package.json
README.md
tsconfig.json
src/index.ts
src/utils.ts

README.md contents:
${fs.readFileSync(path.join(repoDir, 'README.md'))}

src/index.ts contents:
${fs.readFileSync(path.join(repoDir, 'src', 'index.ts'))}

src/utils.ts contents:
${fs.readFileSync(path.join(repoDir, 'src', 'utils.ts'))}`.trimStart(),
		)
	})
})
