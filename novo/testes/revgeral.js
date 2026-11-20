const { chromium, devices } = require('playwright');
(async () => {
  const [F, out] = process.argv.slice(2); const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const res = {};
  for (const [nome, ctx] of [['320', { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }], ['iphone', devices['iPhone 15']], ['pc', { viewport: { width: 1280, height: 760 } }]]) {
    const p = await (await b.newContext(ctx)).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto('http://127.0.0.1:8765/novo/'); await p.waitForTimeout(1500);
    const r = { vazio: await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) };
    await p.setInputFiles('#arquivo', F + '/p31.jpg'); await p.waitForTimeout(2500);
    const clica = (sel) => nome === 'pc' ? p.locator(sel).first().click() : p.locator(sel).first().tap();
    await clica('.film >> nth=2'); await p.waitForTimeout(400);
    const transbordo = () => p.evaluate(() => {
      const w = innerWidth, ruins = [];
      for (const el of document.querySelectorAll('header *, #painel *, #folha *')) {
        const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
        if (el.closest('.faixa, .ferramentas, .enq-props, .canais, .props div, #e_luzTipo div, .cats')) continue;   // essas rolam de lado de propósito
        if (r.right > w + 1 || r.left < -1) ruins.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right));
      }
      return { pagina: document.documentElement.scrollWidth <= w + 1, ruins: [...new Set(ruins)].slice(0, 6) };
    });
    r.filmes = await transbordo();
    await clica('.abas button[data-p="ajustes"]'); await p.waitForTimeout(300); r.ajustes = await transbordo();
    await clica('.abas button[data-p="analogico"]'); await p.waitForTimeout(300); r.analogico = await transbordo();
    await p.screenshot({ path: `${out}/rg_${nome}_analog.png` });
    await clica('#bExportar'); await p.waitForTimeout(500); r.folha = await transbordo(); await p.screenshot({ path: `${out}/rg_${nome}_folha.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    // tempo de desenho (aproximado; sem placa de vídeo real, só para comparar)
    r.ms = await p.evaluate(async () => { const t0 = performance.now(); for (let i = 0; i < 5; i++) await new Promise((ok) => requestAnimationFrame(ok)); return Math.round((performance.now() - t0) / 5); });
    r.erros = errs; res[nome] = r; await p.close();
  }
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
