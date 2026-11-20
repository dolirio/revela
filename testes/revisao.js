const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const o = process.argv[2]; const out = {};
  for (const [nome, opt] of [['celular', { ...devices['Pixel 7'], acceptDownloads: true }], ['computador', { viewport: { width: 1280, height: 800 }, acceptDownloads: true }]]) {
    const p = await (await b.newContext(opt)).newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    const clica = (sel) => nome === 'celular' ? p.locator(sel).first().tap() : p.locator(sel).first().click();
    const set = (k, v) => p.$eval('#r_' + k, (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, v);
    const ferr = async (pag, g) => { if (await p.locator('#' + pag + ' .ferramentas').isVisible()) await clica('#' + pag + ' .ferramentas button[data-g="' + g + '"]'); };
    const r = {}; const t0 = Date.now();
    await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(2500);
    r.vazio = await p.isVisible('#vazio');
    await p.setInputFiles('#arquivo', o + '/teste_rosto.jpg'); await p.waitForTimeout(3500);
    r.filmes = (await p.locator('.film span').allTextContents()).length;
    for (const n of ['Portrait 400', 'Portrait 160', 'Editorial 100', 'Chrome 100', 'Chrome 64', 'Pro 400', 'Tungsten 800', 'Silver 400', 'Silver Portrait']) { await p.locator('.film', { hasText: n }).first().click(); await p.waitForTimeout(250); }
    await p.locator('.film', { hasText: 'Portrait 160' }).first().click(); await p.waitForTimeout(500);
    await clica('.abas button[data-p="ajustes"]');
    for (const [k, v] of [['exposicao', 0.5], ['cenaTemp', 0.2], ['cenaMatiz', -0.1], ['separacao', 0.7]]) await set(k, v);
    r.retratoNaTela = await p.locator('.ferramentas button[data-g="retrato"]').count();
    if (r.retratoNaTela) { await ferr('p-ajustes', 'retrato'); await clica('#bRosto'); const bb = await p.locator('#tela').boundingBox();
    await p.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height * 0.15); await p.mouse.down(); await p.mouse.move(bb.x + bb.width * 0.7, bb.y + bb.height * 0.6, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
    r.rosto = await p.textContent('#nRosto'); }
    await clica('.abas button[data-p="analogico"]');
    await set('grao', 0.5); await set('halacao', 0.3); await set('luzVazada', 0.4); await set('poeira', -0.6);
    await clica('#d_grao'); await ferr('p-analogico', 'luzvazada'); await clica('#d_luzVazada'); await clica('#e_luzTipo button:has-text("Dobradiça")'); await ferr('p-analogico', 'poeira'); await clica('#d_poeira');
    await clica('#bDesfazer'); await clica('#bRefazer');
    await clica('#bExportar'); await p.waitForTimeout(400); const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), clica('#folha .salva')]); r.export = dl.suggestedFilename();
    await p.waitForTimeout(800);
    await p.setInputFiles('#arquivo', o + '/teste_parede.jpg'); await p.waitForTimeout(3000);
    r.pergunta = await p.isVisible('#pergunta'); await clica('#pSim'); await p.waitForTimeout(600); r.filmeRepetido = await p.textContent('.film.on span');
    const dls = []; p.on('download', (d) => dls.push(d)); await p.setInputFiles('#lote', [o + '/teste_b.jpg', o + '/teste_c.jpg']);
    for (let i = 0; i < 40 && dls.length < 2; i++) await p.waitForTimeout(1000); r.lote = dls.length;
    r.segundos = Math.round((Date.now() - t0) / 1000); r.erros = erros; out[nome] = r; await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
