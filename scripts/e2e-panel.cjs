// Verificação ponta a ponta do painel (servidor em :3000): node scripts/e2e-panel.cjs <pasta-screenshots>
const { chromium } = require('playwright')
const fs = require('fs')
const out = process.argv[2]
const line = fs.readFileSync(process.env.ACCESS_FILE ?? 'ACESSOS-DEMO.local.md', 'utf8').split('\n').find((l) => l.startsWith('- owner'))
const [, email, password] = line.match(/owner: (\S+) \/ senha: (\S+)/)
const DATE = process.argv[3]
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await page.goto(BASE + '/painel')
  console.log('REDIRECT', new URL(page.url()).pathname)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/painel')
  await page.goto(`${BASE}/painel?d=${DATE}`)
  console.log('COUNT', await page.locator('h1 + p').textContent())
  await page.screenshot({ path: `${out}/p1-agenda.png`, fullPage: true })

  // novo agendamento manual
  await page.getByRole('button', { name: 'Novo agendamento' }).click()
  await page.locator('dialog').getByRole('button', { name: /^\d\d:\d\d$/ }).first().click()
  await page.getByLabel('Nome do cliente').fill('Manual Teste')
  await page.getByLabel('WhatsApp com DDD').fill('11955554444')
  await page.screenshot({ path: `${out}/p2-novo.png` })
  await page.getByRole('button', { name: 'Marcar horário' }).click()
  await page.locator('dialog').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /Manual Teste/ }).waitFor()
  console.log('MANUAL ok')

  // cancelar
  await page.getByRole('button', { name: /Manual Teste/ }).click()
  await page.getByRole('button', { name: 'Cancelar horário' }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await page.locator('dialog').waitFor({ state: 'detached' })
  await page.waitForTimeout(800)
  console.log('CANCEL', (await page.getByRole('button', { name: /Manual Teste/ }).count()) === 0 ? 'ok' : 'ainda aparece')

  // bloqueio geral 13:00–19:00
  await page.getByRole('button', { name: 'Bloquear horário' }).click()
  await page.getByLabel('Das').fill('13:00')
  await page.getByLabel('Até').fill('19:00')
  await page.getByLabel('Motivo (opcional)').fill('Teste bloqueio')
  await page.locator('dialog').getByRole('button', { name: 'Bloquear' }).click()
  await page.locator('dialog').waitFor({ state: 'detached' })
  await page.screenshot({ path: `${out}/p3-bloqueio.png`, fullPage: true })

  const pub = await ctx.newPage()
  await pub.goto(`${BASE}/agendar?s=00000000-0000-0000-0000-00000000c001&b=any&d=${DATE}`)
  await pub.getByText(/Buscando/).waitFor({ state: 'detached' }).catch(() => {})
  const labels = await pub.getByRole('button', { name: /^\d\d:\d\d$/ }).allTextContents()
  console.log('PUBLIC afternoon slots', labels.filter((l) => l >= '13:00').length, 'total', labels.length)

  // remover bloqueio
  await page.getByRole('button', { name: 'Teste bloqueio' }).first().click()
  await page.getByRole('button', { name: 'Remover bloqueio' }).click()
  await page.locator('dialog').waitFor({ state: 'detached' })
  await page.goto(BASE + '/painel/semana')
  await page.screenshot({ path: `${out}/p4-semana.png`, fullPage: true })
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
