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

## Direção do produto (novembro de 2026)

O Revela passa a se concentrar nos **filmes**: reproduzir cada um com a fidelidade de um app como o RNI Films, com interface limpa e poucos toques.

- **Fica e ganha profundidade:** os filmes, os ajustes básicos e o analógico essencial (grão, halação, difusão, poeira e riscos).
- **Guardado para depois** (continua no histórico, a partir da v47): papéis e cópia, Tempo, Climas, Gráfico, molduras, preparar para imprimir, folha de contato e exportar para Instagram.
- **Grão:** a quantidade é sempre do usuário (mais ou menos, conforme a foto e a intenção), mas o **caráter é sempre de filme real**: aglomerados irregulares de vários tamanhos, mais fortes nos tons médios. Aumentar ou diminuir muda a quantidade, nunca transforma o grão em ruído digital. O primeiro modelo está em `referencias/lindbergh/lindbergh.py` (`grao_organico`).
- A pesquisa que sustenta os filmes novos está em [`pesquisa/`](pesquisa/README.md).
- **O Revela novo está sendo construído em [`novo/`](novo/)**, sem mexer no app publicado. Cada filme vem do motor espectral (`pesquisa/motor/exportar.py`) com a física do filme dentro: a exposição e a temperatura agem **antes** do filme, o equilíbrio do laboratório **depois**. Ele substitui o app atual quando o primeiro conjunto de filmes estiver pronto.
- A v47 fica guardada no histórico no commit `d057ed9`.

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
| `pesquisa/` | Pesquisa dos filmes: dossiês, dados das fichas técnicas, figuras e ferramentas (não é carregada pelo app) |

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
| v48.1 (teste) | 2026-11-17 | **Tela inicial limpa**: antes de abrir uma foto aparecem só as boas-vindas (o painel de filmes com quadrados vazios e o Portrait 400 já escolhido confundiam); a foto abre em Digital, sem nada aplicado. |
| v48 (teste fechado) | 2026-11-17 | **Versão de teste fechada** (`novo/TESTE.md`): revisão completa sem erros (celular e computador); **ícone novo** monocromático e geométrico (sol nascente ou diafragma, herdeiro da meia-lua); o app novo **instala na tela e funciona sem internet** (manifesto e cache próprios); rótulo da versão na tela inicial; APK só com os 9 filmes do índice e o ícone novo. |
| v48 (em construção) | 2026-11-17 | **Três filmes novos, por família**: **Portrait 160** (retrato íntimo, a cor de Peter Lindbergh), **Editorial 100** (retrato de revista, Steven Meisel; mais contraste) e **Chrome 64** (rua em cor, Kodachrome; mais quente). Agora são 9: Portrait 400/160, Editorial 100, Chrome 100/64, Pro 400, Tungsten 800, Silver 400/Portrait. |
| v48 (em construção) | 2026-11-17 | **Retrato em todos os filmes** (separação do rosto com a pele no alvo de cada filme). **Marcar o rosto desenhando** em volta dele (o oval segue o arrasto; um toque marca o centro com o tamanho padrão). **Zoom** com pinça (até 4×, nítido), um dedo arrasta, toque duplo volta; no computador, roda do mouse. |
| v48 (em construção) | 2026-11-17 | **Foto nova começa limpa** e o app **pergunta** se quer usar a mesma edição da anterior (nunca aplica sozinho). **Aplicar a várias fotos** (botão ao lado de Exportar): escolhe uma série e o app revela todas com a edição atual, cada uma com grão próprio, e entrega juntas (Android: Imagens › Revela; celular: compartilhar; computador: download). |
| v48 (em construção) | 2026-11-17 | **Cada efeito com o seu dado**: Grão, Luz vazada e Poeira têm intensidade própria e um dado ao lado que sorteia outra variação só daquele efeito. **Luz vazada volta** com os 6 tipos do app publicado, pela região onde a luz entra (tampa, dobradiça, início do rolo, entre fotos, frontal, raios). **Moldura do filme saiu** (o trabalho é sobre a imagem). |
| v48 (em construção) | 2026-11-17 | **Poeira como no RNI**: pontinhos redondos e traços finos, sem manchas nem bloquinhos, na mesma quantidade a cada sorteio. Controle de dois lados (meio = sem; direita = branca; esquerda = preta) com o **dado** ao lado para sortear outra. Luz vazada e riscos longos saíram (pareciam artificiais). |
| v48 (em construção) | 2026-11-17 | **Poeira e riscos sutis** (como no RNI): sem as manchas grandes e macias, partículas menores e mais raras, riscos finos como fio de cabelo; o pó e o risco clareiam o que está embaixo em vez de pintar de branco. |
| v48 (em construção) | 2026-11-17 | **Tempo no app novo** (aba Analógico): **Luz vazada**, **Poeira** e **Riscos**, trazidos do app publicado (mesma física, um controle para cada), mais a **Moldura do filme** 35 mm com os furos e o botão **Sortear de novo**. A exportação inclui a moldura. |
| v48 (em construção) | 2026-11-17 | **Correções no computador**: a faixa de filmes não rolava com o mouse (agora mostra todos os filmes no computador, com roda e arrastar onde não couber); a halação quase não aparecia (agora reage a lâmpadas, janelas e neon, com brilho vermelho-alaranjado em volta). |
| v48 (em construção) | 2026-11-17 | **Seis filmes com identidade** no app novo: Portrait 400, Chrome 100, Pro 400, Tungsten 800, Silver 400, Silver Portrait. Física do motor + identidade própria, testados nas fotos do usuário. Tela enxuta: uma linha de filmes; Ajustes com Luz, Calor e Matiz; laboratório e filtros embutidos em cada filme. Detalhes em `pesquisa/filmes_finais.md`. |
| v48 (em construção) | 2026-11-16 | **Correções do primeiro teste no iPhone**: P&B saía esverdeado com a temperatura do laboratório (agora o P&B ignora e esconde temperatura/matiz do laboratório); o grão na prévia aparecia ~5× maior que no arquivo exportado (o tamanho agora segue a imagem mostrada). |
| v48 (em construção) | 2026-11-16 | **Versão de teste do app novo**: revisão completa no tamanho de celular (abrir, filmes, laboratório, filtro, rosto, exportar; sem erros), seção Retrato no topo de Ajustes, exportação no APK grava em Imagens › Revela. **APK de teste** separado ("Revela (teste)", `app.revela.teste`, não substitui o instalado), gerado por `novo/android/gerar_apk.sh`. Web de teste em `/novo/`. O app publicado (v47) não muda. |
| v48 (em construção) | 2026-11-16 | **Receita Lindbergh no app novo** (P&B): tabela gerada da receita calibrada do usuário e seção **Retrato** com rosto marcado por toque e **Separação do rosto** (0 = v3, 50 = v6 padrão, 100 = v5). Pele e destaque do rosto conferem com os testes. Detalhes em `referencias/lindbergh/README.md`. |
| v48 (em construção) | 2026-11-16 | **Novas categorias no app novo**: P&B com o **Tri-X 400** (ficha F-4017) e escolha de **filtro na lente** (amarelo, laranja, vermelho, verde; fatores conferidos com a ficha); **Cromo** com o **Ektachrome E100** (motor de slide); **Vencido** com três filmes (Gold 10 anos, UltraMax 20 anos, Portra no calor). Detalhes em `pesquisa/pb_cromo.md`. |
| v48 (em construção) | 2026-11-16 | **Sombras mais densas** na curva do laboratório: a 2 paradas abaixo do cinza o Revela caía −26 L\* e as referências (Labbet, RNI, câmeras) −32 a −36; agora −32,5. Cinza médio e luzes altas mantidos (decisão do usuário). Detalhes em `pesquisa/hald_labbet.md`. |
| v48 (em construção) | 2026-11-16 | **Escolha de laboratório no app novo** (Ajustes › No laboratório): Neutro ou Frontier. O Frontier vem de pares do mesmo negativo escaneado no Frontier e no Noritsu: o canal vermelho tem ~25 % mais contraste, o que dá sombras ciano, verde mais ciano (+8° a +11°) e luzes douradas. Cor do scanner e cópia em papel foram testadas e não explicam o visual. Detalhes em `pesquisa/laboratorios.md`. |
| v48 (em construção) | 2026-11-16 | **Motor com espectros de objetos reais**: a cor RGB vira espectro com a forma típica de objetos reais (190 refletâncias medidas) e o laboratório desfaz só a mistura dos corantes, sem apagar o jeito de cada filme enxergar cor. A saturação caiu para a faixa das referências (0,74–1,09, antes 1,02–1,29) e o céu vai para o ciano. A folhagem ainda vai pouco para o ciano (+1° a +5°) e a pele dos Portra voltou a −6°: o resto fica para a opção de Laboratório. Detalhes em `pesquisa/espectros_naturais.md`. |
| v48 (em construção) | 2026-11-16 | **Filmes do app novo conferidos contra as câmeras medidas** (Ricoh e Fuji): cada filme volta a ter o próprio contraste (Ektar 34, Portra 400 32, 800T 29; antes todos iguais) e a pele dos Portra 160/400 deixa de puxar para o rosado (−8° → −1°). Detalhes em `pesquisa/conferencia_assinatura.md`. |
| v48 (em construção) | 2026-11-15 | **Equilíbrio automático do laboratório** no app novo: como o scanner faz foto a foto, o cinza volta a ser neutro em qualquer exposição do negativo (no Gold 200 a +1 parada, de b\* +4,9 para 0), sem tocar na temperatura "na câmera". Pode ser desligado em Ajustes. Ideia confirmada pelo relato da VSCO sobre o Film X. |
| — | 2026-11-14 | Leitor da cartela (`referencias/medir.py`): acha a cartela pelas marcas dos cantos, revela o RAW de forma neutra e mede os 72 quadros; compara cada simulação com o RAW. Testado em foto sintética. |
| v48 (em construção) | 2026-11-14 | **Sete filmes Kodak** no app novo (KE 100, KP 160, KG 200, KP 400, KU 400, KP 800, C 800T), extraídos de 7 fichas técnicas (25 gráficos conferidos), com forma real dos corantes, calibração do laboratório e caráter próprio de cada filme. Correção do layout no celular. |
| v48 (em construção) | 2026-11-14 | Revela novo em `novo/`: interface enxuta (Filmes, Ajustes, Analógico), filmes com a física do filme (tabela em luz da cena), exposição do negativo, temperatura antes e depois do filme, grão, halação e nitidez por camada vindos da ficha técnica. Primeiro filme: Portra 400. Cartela e instruções de referência em `referencias/`. O app publicado não muda. |
| — | 2026-11-14 | Pesquisa: protótipo do motor espectral do Portra 400 (`pesquisa/motor/`), com LUTs `.cube` para testar no app. O app não muda. |
| — | 2026-11-14 | Pesquisa: dossiê do Portra 400, dados das fichas do Portra 400 e do papel Endura Premier, inventário das fichas dos filmes candidatos. O app não muda. |
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
