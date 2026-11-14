# Revela

Editor de fotos com aparência de filme fotográfico analógico. Você fotografa com qualquer câmera e o Revela faz o resto: escolhe o filme, revela, faz a cópia em papel e mostra o efeito do tempo.

É um **PWA** (site que pode ser instalado na tela do celular e funciona sem internet). Também roda como app Android (APK, empacotado com Capacitor). Tudo é processado no próprio aparelho, e nenhuma foto sai dele.

## Como o app se organiza

As abas seguem a ordem de um laboratório fotográfico:

| Aba | O que faz |
|---|---|
| **Filme** | Escolhe o filme (negativo, retrato, cinema, slide, P&B, vencido) ou um *Clima* (receita pronta). Tocar no filme de novo abre intensidade, Tom e Cor. |
| **Revelar** | Luz, tons, curvas, temperatura e cor por faixa (HSL). |
| **Cópia** | A foto impressa: papel, nitidez, grão, difusão, halação, lente, moldura. |
| **Tempo** | O que os anos fazem: álbum, sol, caixa, P&B antiga, instantânea, poeira, riscos, light leak. |
| **Corte** | Recorte, proporção, rotação, perspectiva e lente. |

Saídas: JPEG em tamanho real, Instagram, cópia pronta para imprimir (300 ppp), folha de contato e backup das receitas.

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Tela do app (estrutura e estilos) |
| `app.js` | Interface: abas, painéis, histórico, exportação, backup |
| `renderer.js` | Processamento da imagem na placa de vídeo (WebGL2) |
| `core.js` | Parâmetros, abertura de arquivos (JPEG, HEIC, RAW pela prévia embutida), molduras |
| `films.js`, `film-looks.js` | Os filmes e o caráter de cada um (grão, halação…) |
| `looks.js`, `looks-data.js` | Geração das LUTs 3D (tabelas de cor) dos filmes |
| `climas.js` | Climas: receitas prontas a partir dos filmes |
| `recipes.js` | Conversão de receitas salvas |
| `icons.js` | Ícones da interface |
| `lab.html`, `lab.js` | Laboratório: ferramenta interna para criar e calibrar filmes |
| `sw.js` | Service worker (guarda o app para uso offline) |
| `vendor/` | Decodificador HEIC (libheif, LGPL-3.0) |

## Como rodar

Qualquer servidor estático serve. Por exemplo:

```sh
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Regra de atualização

A cada versão nova:

1. Suba o número em `sw.js` (`const CACHE = 'revela-vNN'`). Sem isso, quem já tem o app instalado continua com a versão antiga.
2. Acrescente uma linha no topo do **Histórico** abaixo.
3. Use o mesmo `vNN` no início da mensagem do commit.

## Histórico

| Versão | Data | O que mudou |
|---|---|---|
| v47 | 2026-11-14 | Nome volta a ser **Revela** (era Pellicula). Backups antigos continuam abrindo. README com histórico. |
| v46 | 2026-11-13 | Preparar para imprimir (300 ppp, acabamento, margem) |
| v45 | 2026-11-13 | Tamanho da cópia e folha de contato |
| v44 | 2026-11-13 | Abas Filme, Revelar, Cópia, Tempo, Corte; segunda passada de enxugamento |
| v43 | 2026-11-13 | Ferramentas parecidas juntadas em painéis; Climas guardados |
| v42 | 2026-11-13 | Curvas para o dedo (quadro grande, raio de toque, histograma) |
| v41 | 2026-11-13 | Curadoria (itens guardados), Tempo primeiro em Efeitos, dica de rolagem |
| v40 | 2026-11-13 | Ícones das folhas Tempo/Instagram, pintas da Caixa em grupos |
| v39 | 2026-11-13 | Efeito Tempo (álbum, sol, caixa, P&B antiga, instantânea) |
| v38 | 2026-11-12 | Exportar para Instagram, Climas com temperatura do papel, Instantânea fria |
| v37 | 2026-11-12 | Escada de segurança da placa de vídeo (S23); controles Tom/Cor/Temperatura do papel |
| v36 | 2026-11-12 | Prévia em pontos inteiros (corrige linha clara na borda no iPhone) |
| v35 | 2026-11-12 | Filtro como camada: ajustes à mão continuam ao trocar de filme ou Clima |
| v34 | 2026-11-12 | Foto nova começa do zero; edição anterior fica em Colar ajustes |
| v33 | 2026-11-12 | Abrir outra foto zera poeira, riscos e light leak |
| v32 | 2026-11-12 | Papel Instantânea calibrado em fotos instantâneas reais |
| v31 | 2026-11-12 | Revisão geral (moldura instantânea fora, textos) |
| v30 | 2026-11-12 | Folhas de opções crescem em vez de cortar em telas baixas |
| v29 | 2026-11-12 | Shader em níveis para placas que travam; Luzes/Sombras com faixa, raio e cor; Poeira e riscos juntos; arrastar com o mouse |
| v28 | 2026-11-11 | Papel Jato de tinta calibrado numa cópia real escaneada |
| v27 | 2026-11-11 | Modo seguro automático, recuperação do contexto, layout deitado/tablet/computador |
| v26 | 2026-11-11 | Climas: 12 receitas prontas a partir de filmes clássicos |
| v25 | 2026-11-11 | Afinar o filme: Tom e Cor |
| v24 | 2026-11-11 | 12 filmes clássicos novos (cor, P&B e slide) |
| v23 | 2026-11-11 | Grão por modelo de grãos e formato do quadro; saem os looks do Instagram |
| v22 | 2026-11-11 | Papel como cópia escaneada (brilhante, lustre, fosco) e instantânea |
| v21 | 2026-11-11 | Light leaks, arranhões e aberração com tipos e dado |
| v20 | 2026-11-11 | Pinça de zoom, Brilho, tons recalibrados, nitidez, cor, difusão e diagnóstico |
| v19 | 2026-11-10 | Backup e restauração (receitas, LUTs, filmes do Lab) |
| v18 | 2026-11-10 | Suporte ao app Android (exportar para Imagens) |
| v17 | 2026-11-10 | Cor de destaque passa a ser o verde do ícone |
| v16 | 2026-11-10 | Aba Apps passa a se chamar Filtros |
| v15 | 2026-11-10 | Laboratório edita os filmes; nomes e confirmações dentro do app |
| v14 | 2026-11-10 | Gráfico no menu (meio-tom, meio-tom em cores, duotônico, tritônico) |
| v13 | 2026-11-10 | Tipos de papel com variação; tela Ajustar com régua graduada |
| v12 | 2026-11-10 | Aba de filmes por categoria, Minhas, troca de filme que preserva os ajustes |
| v11 | 2026-11-10 | Nome muda para Pellicula, ícone da meia fatia de limão-rosa |
| v10 | 2026-11-10 | Ajustes calibrados e painéis de efeitos |
| v8 | 2026-11-10 | Primeira versão publicada: Revela, editor de fotos (PWA) |
