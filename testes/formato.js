const { chromium, devices } = require('playwright');
(async () => {
  const [F, out] = process.argv.slice(2); const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const r = {}, errs = [];
  for (const [nome, ctx] of [['pc', { viewport: { width: 1280, height: 800 }, acceptDownloads: true }], ['cel', { ...devices['Pixel 7'], acceptDownloads: true }]]) {
    const p = await (await b.newContext(ctx)).newPage(); p.on('pageerror', (e) => errs.push(e.message));
    const clica = (sel) => nome === 'pc' ? p.locator(sel).first().click() : p.locator(sel).first().tap();
    await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1500); await p.setInputFiles('#arquivo', F + '/p31.jpg'); await p.waitForTimeout(2500);
    await clica('.film >> nth=3'); await p.waitForTimeout(300);
    await clica('#bExportar'); await p.waitForTimeout(400);
    r[nome] = { compartilharVisivel: await p.locator('#folha .comp').count(), padrao: await p.locator('#folha .formatos .on b').textContent() };
    await p.screenshot({ path: `${out}/fmt_${nome}.png` });
    await clica('#folha .formatos button[data-f="png"]');
    const [d1] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), clica('#folha .salva')]); r[nome].png = d1.suggestedFilename(); await d1.saveAs(`${out}/fmt_${nome}.png.out`);
    await p.waitForTimeout(800); await clica('#bExportar'); await p.waitForTimeout(400);
    r[nome].lembrou = await p.locator('#folha .formatos .on b').textContent();
    await clica('#folha .formatos button[data-f="jpeg"]');
    const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), clica('#folha .salva')]); r[nome].jpg = d2.suggestedFilename(); await d2.saveAs(`${out}/fmt_${nome}.jpg.out`);
    await p.close();
  }
  console.log(JSON.stringify(r), errs); await b.close();
})();
