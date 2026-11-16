# Revela · versão de teste 48 (17/11/2026)

**Web:** https://dolirio.github.io/revela/novo/ · **Android:** APK "Revela (teste)" (`novo/android/gerar_apk.sh`), instala ao lado do Revela publicado.

## O que está nesta versão
- **9 filmes, por família:** Portrait 400, Portrait 160, Editorial 100 · Chrome 100, Chrome 64 · Pro 400 · Tungsten 800 · Silver 400, Silver Portrait.
- **Ajustes:**
  - Luz, Calor, Matiz.
  - **Retrato** em qualquer filme: marcar o rosto desenhando em volta dele e escolher a separação.
- **Analógico:**
  - Grão (com dado), Tamanho do grão, Halação.
  - **Luz vazada** (com dado), com 6 tipos pela região onde a luz entra.
  - **Poeira** de dois lados (preta ← 0 → branca), com dado.
- **Zoom:**
  - pinça (até 4×), arrastar com um dedo, toque duplo volta;
  - no computador, roda do mouse.
- **Outra foto:** começa limpa e o app pergunta se quer usar a mesma edição.
- **Aplicar a várias fotos:** a edição atual numa série, entregue de uma vez.
- **Exportar:** tamanho real (Android: Imagens › Revela; celular: compartilhar; computador: download).
- **Instala na tela do celular e funciona sem internet.**
- **Ícone novo** (opção A): a silhueta do ícone antigo (meia-lua com gomos) em versão monocromática e geométrica, um sol nascente ou diafragma. As outras opções estão em `icone-opcoes/`.

## Conferido nesta versão (navegador, tamanho de celular e de computador)
- Fluxo completo sem erros: os 9 filmes, ajustes, rosto desenhado, efeitos e dados, desfazer/refazer, exportação, pergunta da foto nova e lote.
- Sem internet: abre, carrega os filmes e revela.
- APK: monta, leva só os 9 filmes do índice e usa o ícone novo.

## O que ainda não foi testado num aparelho de verdade
- Desempenho e memória com fotos grandes no celular, principalmente no lote.
- Gravação em Imagens › Revela no Android 10 ou mais antigo.
- Pinça e desenho do rosto com o dedo de verdade (testados por emulação).
