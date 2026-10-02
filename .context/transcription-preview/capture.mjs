import { createServer } from 'vite'
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const server = await createServer({ configFile: path.join(directory, 'vite.config.ts') })
let browser
const results = []

async function inspect(page, state, device, errors, externalRequests) {
  const layout = await page.evaluate(() => ({
    viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
    overflowElements: [...document.querySelectorAll('*')].filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (rect.right > innerWidth + 1 || rect.left < -1)
    }).map((element) => `${element.tagName}.${element.className}`).slice(0, 12),
    textarea: (() => { const element = document.querySelector('textarea'); if (!element) return null; const rect = element.getBoundingClientRect(); return { x: rect.x, width: rect.width, height: rect.height, readOnly: element.readOnly } })(),
    audio: (() => { const element = document.querySelector('audio'); return element ? { readyState: element.readyState, duration: element.duration, error: element.error?.message ?? null } : null })(),
  }))
  const result = { state, device, ...layout, errors: [...errors], externalRequests: [...externalRequests] }
  results.push(result)
  await page.screenshot({ path: path.join(directory, `${state}-${device}.png`), fullPage: true, animations: 'disabled' })
  return result
}

try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  for (const state of ['empty', 'processing', 'review', 'reviewed']) {
    for (const [device, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
      const errors = []
      const externalRequests = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (url.hostname !== '127.0.0.1' && url.protocol !== 'data:' && url.protocol !== 'blob:') {
          externalRequests.push(url.origin + url.pathname)
          await route.abort()
          return
        }
        await route.continue()
      })
      await page.goto(`http://127.0.0.1:4180/?state=${state}`)
      await page.getByRole('heading', { name: 'Transcrição da assembleia', exact: true }).waitFor()
      if (state === 'review' || state === 'reviewed') {
        await page.getByRole('heading', { name: state === 'review' ? 'Transcrição para revisão' : 'Transcrição revisada', exact: true }).waitFor()
        await page.waitForFunction(() => document.querySelector('audio')?.readyState >= 1)
      }
      await page.evaluate(() => document.fonts.ready)
      await inspect(page, state, device, errors, externalRequests)
      if (state === 'review' || state === 'reviewed') {
        const toggle = page.getByRole('button', { name: 'Localizar e substituir', exact: true })
        if (await toggle.getAttribute('aria-expanded') !== 'false') throw new Error('Find/replace must start collapsed')
        await toggle.click()
        await page.getByRole('textbox', { name: 'Localizar no texto', exact: true }).fill('síndico')
        if (state === 'review') await page.getByRole('textbox', { name: 'Substituir por', exact: true }).fill('administrador')
        if (state === 'reviewed') {
          const replacement = page.getByRole('textbox', { name: 'Substituir por', exact: true })
          if (!await replacement.isDisabled()) throw new Error('Closed review must prevent replacements')
          if (!await page.getByRole('button', { name: 'Próxima ocorrência', exact: true }).isEnabled()) throw new Error('Closed review must still allow search navigation')
        }
        await page.evaluate(() => window.scrollTo(0, 0))
        await inspect(page, `${state}-expanded`, device, errors, externalRequests)
      }
      await page.close()
    }
  }
  await fs.writeFile(path.join(directory, 'layout-report.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  const failures = results.filter((result) => result.documentWidth > result.viewport || result.bodyWidth > result.viewport || result.errors.length || result.externalRequests.length || result.audio?.error)
  if (failures.length) throw new Error(`${failures.length} visual QA states failed; see layout-report.json`)
} finally {
  await browser?.close()
  await server.close()
}
