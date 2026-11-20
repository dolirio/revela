// desenha os PNG do ícone a partir de icone.svg: node testes/icones_png.js   (na raiz do repositório)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const svg = fs.readFileSync('icone.svg', 'utf8');
  const semFundo = svg.replace(/<rect width="1024" height="1024" fill="[^"]+"\/>/, '');
  for (const [arq, lado, s] of [['icone-512.png', 512, svg], ['icone-192.png', 192, svg], ['icone-180.png', 180, svg], ['icone-desenho-512.png', 512, semFundo]]) {
    const p = await b.newPage({ viewport: { width: lado, height: lado } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${lado}px;height:${lado}px}</style>${s}`);
    await p.screenshot({ path: arq, omitBackground: true }); await p.close();
  }
  await b.close(); console.log('ok');
})();
