import { createServer } from 'vite'
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const server = await createServer({ configFile: path.join(directory, 'vite.config.ts') })
let browser
const results = []
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  for (const state of ['preparation', 'ready']) {
    for (const [device, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.route('**/*', async (route) => {
        if (new URL(route.request().url()).hostname !== '127.0.0.1') throw new Error('External requests are disallowed in the visual QA harness')
        await route.continue()
      })
      await page.goto(`http://127.0.0.1:4179/?state=${state}`)
      await page.getByRole('heading', { name: state === 'preparation' ? 'Prepare a primeira minuta' : 'Minuta da assembleia' }).waitFor()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: path.join(directory, `${state}-${device}.png`), fullPage: true })
      const layout = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, overflowElements: [...document.querySelectorAll('*')].filter((element) => { const rect = element.getBoundingClientRect(); return rect.right > innerWidth + 1 || rect.left < -1 }).map((element) => `${element.tagName}.${element.className}`).slice(0, 12) }))
      results.push({ state, device, ...layout, errors })
      if (state === 'ready') {
        await page.getByText('Documentos de apoio', { exact: false }).first().click()
        await page.getByText('Histórico de versões', { exact: false }).first().click()
        await page.screenshot({ path: path.join(directory, `${state}-${device}-expanded.png`), fullPage: true })
        const expanded = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth }))
        results.push({ state: 'ready-expanded', device, ...expanded })
      }
      await page.close()
    }
  }
  await fs.writeFile(path.join(directory, 'layout-report.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser?.close()
  await server.close()
}
