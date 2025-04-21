#!/usr/bin/env ts-node

import { program } from 'commander'
import * as calcUtils from './utils'

// Configure CLI options using Commander
program
	.requiredOption('-o --operation <type>', 'The type of mathematical operation to perform. Supported: add, sub')
	.option('-x --xOperand <number>', 'The first operand', parseFloat)
	.option('-y --yOperand <number>', 'The second operand', parseFloat)

// Parse the arguments before using them
program.parse(process.argv)
const options = program.opts()

if (options.operation === 'add' && !isNaN(options.xOperand) && !isNaN(options.yOperand)) {
	console.log(calcUtils.add(options.xOperand, options.yOperand))
} else if (options.operation === 'sub' && !isNaN(options.xOperand) && !isNaN(options.yOperand)) {
	console.log(calcUtils.sub(options.xOperand, options.yOperand))
} else {
	throw new Error('Invalid or missing arguments.')
}
