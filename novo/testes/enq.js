const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const out = {};
  for (const [nome, ctx] of [['pixel', { ...devices['Pixel 7'], acceptDownloads: true }], ['pc', { viewport: { width: 1366, height: 860 }, acceptDownloads: true }]]) {
    const p = await (await b.newContext(ctx)).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/novo/'); await p.waitForTimeout(1500);
    await p.setInputFiles('#arquivo', process.argv[2]); await p.waitForTimeout(2500);
    const clica = (sel) => nome === 'pixel' ? p.locator(sel).first().tap() : p.locator(sel).first().click();
    const st = () => p.evaluate(() => 0);
    const r = {};
    await clica('.film >> nth=1'); await p.waitForTimeout(400);
    await clica('.abas button[data-p="ajustes"]'); await p.waitForTimeout(300);
    if (nome === 'pixel') { const ch = p.locator('#p-ajustes .ferramentas button[data-g="corte"]'); await ch.scrollIntoViewIfNeeded(); await ch.tap(); }
    else { await p.locator('#bEnquadrar').scrollIntoViewIfNeeded(); await p.locator('#bEnquadrar').click(); }
    await p.waitForTimeout(500);
    r.aberto = await p.locator('#enq').isVisible(); r.painel = Math.round((await p.locator('#painel').boundingBox()).height);
    const tela0 = await p.locator('#tela').boundingBox();
    await clica('.enq-props button[data-v="4:5"]'); await p.waitForTimeout(300);
    const arrasta = async (dx) => { const tb = await p.locator('.regua .trilho').boundingBox(); const y = tb.y + tb.height / 2, x = tb.x + tb.width / 2; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + dx, y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300); return p.locator('.regua output').textContent(); };
    await clica('.enq-ferr button[data-f="endireitar"]'); r.endireitar = await arrasta(-60);
    await p.screenshot({ path: `${process.argv[3]}/enq_${nome}_endireitar.png` });
    await clica('.enq-ferr button[data-f="perspV"]'); r.vertical = await arrasta(-80);
    await clica('.enq-ferr button[data-f="lente"]'); r.lente = await arrasta(120);
    await p.screenshot({ path: `${process.argv[3]}/enq_${nome}_lente.png` });
    // cancelar: tudo volta
    await clica('.enq-fim .cancela'); await p.waitForTimeout(500);
    const tela1 = await p.locator('#tela').boundingBox(); r.cancelouIgual = Math.abs(tela1.width - tela0.width) < 2 && Math.abs(tela1.height - tela0.height) < 2; r.fechou = !(await p.locator('#enq').isVisible());
    // de novo, aplicar
    if (nome === 'pixel') { const ch = p.locator('#p-ajustes .ferramentas button[data-g="corte"]'); await ch.scrollIntoViewIfNeeded(); await ch.tap(); } else await p.locator('#bEnquadrar').click();
    await p.waitForTimeout(400);
    await clica('.enq-props button[data-v="4:5"]'); await clica('.enq-ferr button[data-f="lente"]'); await arrasta(100); await clica('.enq-ferr button[data-f="girar"]'); await p.waitForTimeout(300);
    await clica('.enq-fim .aplica'); await p.waitForTimeout(600);
    await p.screenshot({ path: `${process.argv[3]}/enq_${nome}_aplicado.png` });
    const t2 = await p.locator('#tela').boundingBox(); r.proporcaoTela = +(t2.width / t2.height).toFixed(3);
    await clica('#bExportar'); await p.waitForTimeout(400); const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), clica('#folha .salva')]);
    await dl.saveAs(`${process.argv[3]}/enq_${nome}.jpg`);
    // desfazer volta a antes do enquadramento
    await clica('#bDesfazer'); await p.waitForTimeout(500); const t3 = await p.locator('#tela').boundingBox(); r.desfazer = +(t3.width / t3.height).toFixed(3);
    out[nome] = { ...r, errs }; await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
