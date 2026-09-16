#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { createReferenceUrl, type RenderMode } from './core.ts'

const [command, ...args] = process.argv.slice(2)

if (command === 'encode') {
  await encode(args)
} else {
  console.error('Usage: cita encode <content> [--base URL] [--render md]')
  process.exitCode = 1
}

async function encode(args: string[]) {
  const values = [...args]
  const base = takeOption(values, '--base') || process.env.CITA_BASE_URL || 'https://martesi.github.io/cita/'
  const render = takeOption(values, '--render')
  if (render && render !== 'md') throw new Error('render must be md')

  const content = values.join(' ') || readFileSync(0, 'utf8').trimEnd()
  if (!content) throw new Error('content is required')

  console.log(await createReferenceUrl(base, content, render as RenderMode | undefined))
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value) throw new Error(`${name} requires a value`)
  args.splice(index, 2)
  return value
}
