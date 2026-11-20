const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] }); const r = {};
  for (const [nome, dev] of [['iPhone 15', devices['iPhone 15']], ['Pixel 7', devices['Pixel 7']]]) {
    const p = await (await b.newContext({ ...dev })).newPage();
    await p.goto('http://127.0.0.1:8765/novo/'); await p.waitForTimeout(2000);
    await p.setInputFiles('#arquivo', process.argv[2]); await p.waitForTimeout(3000);
    const m = {};
    for (const aba of ['filmes', 'ajustes', 'analogico']) {
      await p.locator(`.abas button[data-p="${aba}"]`).tap(); await p.waitForTimeout(400);
      const pal = await p.locator('#palco').boundingBox(), pan = await p.locator('#painel').boundingBox();
      m[aba] = { foto: Math.round(pal.height), painel: Math.round(pan.height) };
      if (nome === 'Pixel 7') await p.screenshot({ path: `${process.argv[3]}/area_${process.argv[4]}_${aba}.png` });
    }
    r[nome] = m; await p.close();
  }
  console.log(JSON.stringify(r)); await b.close();
})();
