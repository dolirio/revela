const { chromium, devices } = require('playwright');
(async () => {
  const [F, out] = process.argv.slice(2); const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const r = {}, errs = [];
  const p = await (await b.newContext(devices['Pixel 7'])).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1500); await p.setInputFiles('#arquivo', F + '/24.jpg'); await p.waitForTimeout(2500);
  await p.locator('.film', { hasText: 'Portrait 400' }).first().tap(); await p.waitForTimeout(300);
  await p.locator('.abas button[data-p="ajustes"]').tap(); const ch = p.locator('#p-ajustes .ferramentas button[data-g="seletivo"]'); await ch.scrollIntoViewIfNeeded(); await ch.tap(); await p.waitForTimeout(400);
  r.painel = Math.round((await p.locator('#painel').boundingBox()).height);
  const o = await p.locator('#pontos').boundingBox();
  await p.mouse.click(o.x + o.width * 0.42, o.y + o.height * 0.42); await p.waitForTimeout(400);   // ponto 1: cachorro claro
  const set = async (k, v) => { await p.locator(`.selParams button[data-k="${k}"]`).tap(); await p.$eval('#r_selVal', (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, v); await p.waitForTimeout(200); };
  await set('luz', 0.6); await set('entorno', 0.6); await set('sat', 0.4);
  await p.mouse.click(o.x + o.width * 0.5, o.y + o.height * 0.2); await p.waitForTimeout(400);    // ponto 2: rosto
  await set('luz', 0.4); await set('estrutura', 0.5);
  r.pontos = await p.evaluate(() => document.querySelectorAll('#pontos .pt').length);
  await p.screenshot({ path: out + '/sel_pontos.png' });
  // arrastar a borda do ponto escolhido: a máscara aparece em vermelho
  const aro = await p.locator('#pontos .aro').boundingBox(); const cx = aro.x + aro.width / 2, cy = aro.y + aro.height / 2;
  await p.mouse.move(aro.x + aro.width, cy); await p.mouse.down(); await p.mouse.move(aro.x + aro.width * 1.2, cy, { steps: 4 }); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/sel_mascara.png' }); await p.mouse.up(); await p.waitForTimeout(300);
  // apagar o ponto 2
  await p.locator('.selAcoes .apaga').tap(); await p.waitForTimeout(300);
  r.depoisApagar = await p.evaluate(() => document.querySelectorAll('#pontos .pt').length);
  await p.locator('#bDesfazer').tap(); await p.waitForTimeout(400); r.desfazVolta = await p.evaluate(() => document.querySelectorAll('#pontos .pt').length);
  // a próxima foto começa sem pontos
  await p.setInputFiles('#arquivo', F + '/m20.jpg'); await p.waitForTimeout(2500); if (await p.locator('#pergunta').isVisible()) await p.locator('#pSim').tap(); await p.waitForTimeout(400);
  r.novaFotoPontos = await p.evaluate(() => document.querySelectorAll('#pontos .pt').length);
  console.log(JSON.stringify(r), errs); await b.close();
})();
