// Verificação das configurações (servidor em BASE_URL): node scripts/e2e-config.cjs <pasta-screenshots>
const { chromium } = require('playwright')
const fs = require('fs')
const out = process.argv[2]
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const [, email, password] = fs.readFileSync(process.env.ACCESS_FILE ?? 'ACESSOS-DEMO.local.md', 'utf8').match(/owner: (\S+) \/ senha: (\S+)/)
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await page.goto(`${BASE}/painel/login`)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/painel$/)
  await page.goto(`${BASE}/painel/configuracoes`)

  const corte = page.getByRole('form', { name: 'Serviço Corte', exact: true })
  await corte.getByLabel('Preço (R$)').fill('52,50')
  await corte.getByRole('button', { name: 'Salvar' }).click()
  await corte.getByText('Salvo.').waitFor()
  const home = await ctx.newPage()
  await home.goto(BASE + '/')
  console.log('HOME price', await home.getByText('R$ 52,50').count() > 0 ? 'ok' : 'NÃO ATUALIZOU')

  // preço inválido
  await corte.getByLabel('Preço (R$)').fill('abc')
  await corte.getByRole('button', { name: 'Salvar' }).click()
  await corte.getByText('Informe o preço').waitFor()
  console.log('INVALID', await corte.getByRole('status').textContent())

  // fechar quinta do Diego
  const diego = page.getByRole('form', { name: 'Horário de Diego' })
  await diego.getByLabel('Quinta aberto').uncheck()
  await diego.getByRole('button', { name: /Salvar horário/ }).click()
  await diego.getByText('Salvo.').waitFor()
  console.log('HOURS', await diego.getByRole('status').textContent())
  await page.screenshot({ path: `${out}/c1-config.png`, fullPage: true })

  const pub = await ctx.newPage()
  await pub.goto(`${BASE}/agendar?s=00000000-0000-0000-0000-00000000c001&b=00000000-0000-0000-0000-0000000000b2`)
  const thu = pub.getByRole('option', { name: /qui/ })
  const states = await thu.evaluateAll((els) => els.map((e) => e.disabled))
  console.log('THURSDAY disabled', states.every(Boolean) ? 'ok' : states)

  // restaura
  await corte.getByLabel('Preço (R$)').fill('45,00')
  await corte.getByRole('button', { name: 'Salvar' }).click()
  await corte.getByText('Salvo.').waitFor()
  await diego.getByLabel('Quinta aberto').check()
  await diego.getByRole('button', { name: /Salvar horário/ }).click()
  await diego.getByText('Salvo.').waitFor()
  console.log('RESTORED')
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
