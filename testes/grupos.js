const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [nome, ctx] of [['Pixel 7', devices['Pixel 7']], ['360', { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true }]]) {
    const p = await (await b.newContext(ctx)).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1500);
    await p.setInputFiles('#arquivo', process.argv[2]); await p.waitForTimeout(2500);
    await p.locator('.film').nth(1).tap(); await p.waitForTimeout(800);   // escolhe um filme
    const r = {};
    for (const aba of ['ajustes', 'analogico']) {
      await p.locator(`.abas button[data-p="${aba}"]`).tap(); await p.waitForTimeout(300);
      for (const g of await p.locator(`#p-${aba} .ferramentas button:not([hidden]):not([data-g="corte"])`).all()) {
        await g.tap(); await p.waitForTimeout(250);
        r[await g.textContent()] = Math.round((await p.locator('#painel').boundingBox()).height);
        if (nome === 'Pixel 7' && ['Grão', 'Luz vazada', 'Retrato'].includes(await g.textContent())) await p.screenshot({ path: `${process.argv[3]}/grupo_${(await g.textContent()).replace(' ', '_')}.png` });
      }
    }
    // muda a halação e confere o ponto
    await p.locator('#p-analogico .ferramentas button[data-g="halacao"]').tap();
    await p.locator('#r_halacao').fill('0.9'); await p.waitForTimeout(200);
    r.ponto = await p.locator('#p-analogico .ferramentas button[data-g="halacao"]').evaluate((e) => e.classList.contains('mudou'));
    r.filme = await p.evaluate(() => document.querySelector('.film.on')?.textContent);
    console.log(nome, JSON.stringify(r), errs);
  }
  await b.close();
})();
