const { chromium, devices } = require('playwright');
(async () => {
  const [F, out] = process.argv.slice(2); const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const r = {}, errs = [];
  const ctx = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true }); await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/novo/'); await p.waitForTimeout(1500);
  await p.setInputFiles('#arquivo', F + '/m20.jpg'); await p.waitForTimeout(2500);
  // edita: Gold 200 + grão áspero + vinheta
  await p.locator('.film', { hasText: 'Gold 200' }).first().tap(); await p.waitForTimeout(400);
  await p.$eval('#r_vinheta', (el) => { el.value = 0.4; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  // salvar em Minhas
  await p.locator('#cats button', { hasText: 'Minhas' }).tap(); await p.waitForTimeout(400);
  await p.locator('.film.acao', { hasText: 'Salvar esta' }).tap(); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/nv_salvar.png' });
  await p.locator('#folha input').fill('Casa à tarde'); await p.locator('#folha .pri').tap(); await p.waitForTimeout(600);
  r.salvas = await p.evaluate(() => JSON.parse(localStorage.getItem('revela.minhasReceitas')).map((m) => [m.n, Object.keys(m.s)]));
  await p.screenshot({ path: out + '/nv_minhas.png' });
  // ficha da minha receita (toque longo) e código
  const t = p.locator('.film', { hasText: 'Casa à tarde' }).first(), bb = await t.boundingBox();
  await p.mouse.move(bb.x + 30, bb.y + 30); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(400);
  r.codigo = (await p.locator('#folha textarea').inputValue()).slice(0, 24) + '…';
  const cod = await p.locator('#folha textarea').inputValue();
  await p.screenshot({ path: out + '/nv_codigo.png' });
  await p.locator('#folha .pri').tap(); await p.waitForTimeout(300);
  // abre outra foto (começa limpa) e aplica a receita salva
  await p.setInputFiles('#arquivo', F + '/24.jpg'); await p.waitForTimeout(2500);
  if (await p.locator('#pergunta').isVisible()) await p.locator('#pNao').tap();
  await p.locator('.film', { hasText: 'Casa à tarde' }).first().tap(); await p.waitForTimeout(500);
  r.vinhetaAplicada = await p.$eval('#r_vinheta', (el) => el.value); r.filmeAplicado = await p.evaluate(() => document.querySelector('.abas') && 1);
  // colar código: um válido (vira 2ª receita) e um inválido
  await p.locator('.film.acao', { hasText: 'Colar código' }).tap(); await p.waitForTimeout(300);
  await p.locator('#folha textarea').fill('RV1.lixo!!'); await p.locator('#folha .pri').tap(); await p.waitForTimeout(300);
  r.invalidoFicaAberto = await p.evaluate(() => document.body.classList.contains('com-folha'));
  await p.locator('#folha textarea').fill(cod); await p.locator('#folha .pri').tap(); await p.waitForTimeout(500);
  r.total = await p.evaluate(() => JSON.parse(localStorage.getItem('revela.minhasReceitas')).length);
  // código malicioso: chaves estranhas e valores fora do limite são ignorados
  const mal = 'RV1.' + Buffer.from(JSON.stringify({ n: '<img src=x onerror=alert(1)>', s: { vinheta: 99, xss: 1, filme: 'nao_existe', curvas: { l: [[0, 0], [2, -5]] } } })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await p.locator('.film.acao', { hasText: 'Colar código' }).tap(); await p.waitForTimeout(300);
  await p.locator('#folha textarea').fill(mal); await p.locator('#folha .pri').tap(); await p.waitForTimeout(500);
  r.malicioso = await p.evaluate(() => JSON.parse(localStorage.getItem('revela.minhasReceitas')).slice(-1)[0]);
  r.imgInjetada = await p.locator('.faixa img').count();
  // ficha do filme (toque longo) na aba Filmes
  await p.locator('#cats button', { hasText: 'Filmes' }).tap(); await p.waitForTimeout(300);
  const fv = await p.locator('.film', { hasText: 'Vivid 50' }).first(); await fv.scrollIntoViewIfNeeded(); const fb = await fv.boundingBox();
  await p.mouse.move(fb.x + 30, fb.y + 30); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(400);
  r.ficha = await p.locator('#folha h3').textContent(); await p.screenshot({ path: out + '/nv_ficha.png' });
  await p.locator('#folha .fecha').tap(); await p.waitForTimeout(300);
  r.filmeNaoMudou = !(await p.locator('.film.on', { hasText: 'Vivid 50' }).count());
  // cortina
  await p.locator('#bComparar').tap(); await p.waitForTimeout(500);
  r.cortina = await p.locator('#cortina').isVisible();
  const cb = await p.locator('#cortina').boundingBox(); await p.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height / 2); await p.mouse.down(); await p.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height / 2, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/nv_cortina.png' });
  await p.locator('#bComparar').tap(); await p.waitForTimeout(300); r.cortinaDesliga = !(await p.locator('#cortina').isVisible());
  // exportar para o Instagram
  await p.locator('#bExportar').tap(); await p.waitForTimeout(400); await p.screenshot({ path: out + '/nv_exportar.png' });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), p.locator('#folha .salva').tap()]);
  await dl.saveAs(out + '/nv_insta.jpg'); r.insta = dl.suggestedFilename();
  console.log(JSON.stringify(r, null, 1), errs); await b.close();
})();
