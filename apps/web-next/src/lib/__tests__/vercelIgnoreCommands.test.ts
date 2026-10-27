import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const sourceRoot = resolve(process.cwd(), '../..')
const webCommand = JSON.parse(readFileSync(join(sourceRoot, 'vercel.json'), 'utf8')).ignoreCommand as string
const mcpCommand = JSON.parse(readFileSync(join(sourceRoot, 'apps/mcp-server/vercel.json'), 'utf8')).ignoreCommand as string
const directories: string[] = []
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function repository() {
  const dir = mkdtempSync(join(tmpdir(), 'omnia-ignore-test-'))
  directories.push(dir)
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
  git('init', '-q'); git('config', 'user.email', 'test@omnia.invalid'); git('config', 'user.name', 'Omnia test')
  for (const app of ['web-next', 'mcp-server', 'ata-transcription-worker']) {
    mkdirSync(join(dir, 'apps', app), { recursive: true })
    writeFileSync(join(dir, 'apps', app, 'index.ts'), 'initial')
  }
  git('add', '.'); git('commit', '-qm', 'initial')
  const base = git('rev-parse', 'HEAD')
  return { dir, base, change(app: string) { writeFileSync(join(dir, 'apps', app, 'index.ts'), 'changed'); git('add', '.'); git('commit', '-qm', 'change') } }
}
function run(command: string, dir: string, base?: string, branch = 'main') {
  const env: NodeJS.ProcessEnv = { ...process.env, VERCEL_GIT_COMMIT_REF: branch }
  delete env.VERCEL_GIT_PREVIOUS_SHA
  if (base) env.VERCEL_GIT_PREVIOUS_SHA = base
  return spawnSync('/bin/sh', ['-c', command], { cwd: dir, env, encoding: 'utf8' })
}

describe('Vercel ignored build commands', () => {
  for (const [name, command] of [['web',webCommand],['MCP',mcpCommand]]) {
    it(`${name} builds when the previous commit is absent from the clone`, () => {
      const repo = repository()
      const result = run(command, repo.dir, '4ae2a2fef3b1d69e38f8bfdd7892212e44337a99')
      expect(result.status).toBe(1)
      expect(result.stderr).not.toMatch(/fatal|bad object/i)
    })
    it(`${name} builds on the first commit without a previous SHA`, () => {
      const repo = repository()
      expect(run(command, repo.dir).status).toBe(1)
    })
    it(`${name} skips unchanged code`, () => {
      const repo = repository()
      expect(run(command, repo.dir, repo.base).status).toBe(0)
    })
  }
  it('builds MCP only for MCP changes and skips the web build', () => {
    const repo = repository(); repo.change('mcp-server')
    expect(run(mcpCommand, repo.dir, repo.base).status).toBe(1)
    expect(run(webCommand, repo.dir, repo.base).status).toBe(0)
  })
  it('builds the web app for web changes and skips MCP', () => {
    const repo = repository(); repo.change('web-next')
    expect(run(webCommand, repo.dir, repo.base).status).toBe(1)
    expect(run(mcpCommand, repo.dir, repo.base).status).toBe(0)
  })
  it('skips both projects for transcription worker changes', () => {
    const repo = repository(); repo.change('ata-transcription-worker')
    expect(run(webCommand, repo.dir, repo.base).status).toBe(0)
    expect(run(mcpCommand, repo.dir, repo.base).status).toBe(0)
  })
  it('keeps MCP previews disabled', () => {
    const repo = repository(); repo.change('mcp-server')
    expect(run(mcpCommand, repo.dir, repo.base, 'feature/test').status).toBe(0)
  })
})
