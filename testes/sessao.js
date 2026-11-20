// O app é fechado no meio de uma edição (como o Android faz em segundo plano) e reaberto: a foto, a edição e o desfazer voltam.
const { chromium, devices } = require('playwright');
(async () => {
  const [FOTO, out] = process.argv.slice(2); const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const r = {}, errs = [];
  const ctx = await b.newContext(devices['Pixel 7']); let p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1500); await p.setInputFiles('#arquivo', FOTO); await p.waitForTimeout(2500);
  await p.locator('.film', { hasText: 'Gold 200' }).first().tap(); await p.waitForTimeout(400);
  await p.$eval('#r_vinheta', (el) => { el.value = 0.5; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }); await p.waitForTimeout(900);
  r.antes = { filme: await p.locator('.film.on span').first().textContent(), vinheta: await p.$eval('#r_vinheta', (el) => el.value) };
  await p.close();   // o Android fecha o app
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(4500);
  r.depois = { comFoto: await p.evaluate(() => document.body.classList.contains('com-foto')), filme: await p.locator('.film.on span').first().textContent().catch(() => null), vinheta: await p.$eval('#r_vinheta', (el) => el.value) };
  r.desfazerAtivo = !(await p.locator('#bDesfazer').isDisabled());
  await p.locator('#bDesfazer').tap(); await p.waitForTimeout(400); r.vinhetaAposDesfazer = await p.$eval('#r_vinheta', (el) => el.value);
  if (out) await p.screenshot({ path: out + '/sessao.png' });
  console.log(JSON.stringify(r), errs); await b.close();
})();
