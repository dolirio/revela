# Testes automáticos do app novo

Rodam no navegador Chromium do Playwright (com placa de vídeo simulada, `--use-gl=swiftshader`), contra o app servido localmente.

```bash
python3 -m http.server 8765 --bind 127.0.0.1    # na raiz do repositório
node novo/testes/revisao.js  PASTA              # revisão completa (celular e computador): filmes, rosto, efeitos, desfazer, exportar, pergunta da foto nova, lote
node novo/testes/grupos.js   FOTO PASTA         # altura do painel igual em todas as ferramentas (a foto não pula)
node novo/testes/medir_area.js FOTO PASTA nome  # quanto da tela a foto ocupa em cada aba (iPhone 15, Pixel 7)
node novo/testes/novas.js    PASTA_FOTOS PASTA  # Minhas receitas (inclusive código malicioso), ficha do filme, cortina, exportar
node novo/testes/sel.js      PASTA_FOTOS PASTA  # Seletivo: criar, ajustar, máscara, apagar, desfazer, foto nova sem pontos
node novo/testes/enq.js      FOTO PASTA         # Enquadrar: cortar, endireitar, perspectiva, lente, cancelar, aplicar, exportar
node novo/testes/formato.js  PASTA_FOTOS PASTA  # Exportar em JPEG e PNG, formato lembrado
node novo/testes/revgeral.js PASTA_FOTOS PASTA  # nada cortado ou transbordando em 320 px, iPhone e computador
```

As fotos de teste **não ficam no repositório** (são do usuário e podem ter localização). Use uma pasta local com:
`teste_rosto.jpg`, `teste_parede.jpg`, `teste_b.jpg`, `teste_c.jpg` (revisao.js) e, em PASTA_FOTOS, `p31.jpg` (paisagem com céu e pessoa),
`m20.jpg` (animal), `24.jpg` (pessoa com animal). Os resultados (capturas e arquivos exportados) vão para PASTA.
