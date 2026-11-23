# Revela

Editor de fotos com aparência de filme fotográfico analógico. Você fotografa com qualquer câmera e o Revela faz o resto: escolhe o filme, revela, faz a cópia em papel e mostra o efeito do tempo.

É um **PWA** (site que pode ser instalado na tela do celular e funciona sem internet). Também roda como app Android (APK, empacotado com Capacitor). Tudo é processado no próprio aparelho, e nenhuma foto sai dele.

## Como o app se organiza

| Aba | O que faz |
|---|---|
| **Filmes** | 12 filmes (cada um nasce do motor espectral, com uma identidade por cima), **Receitas** por família (preto e branco, cor, noite e flash) e **Minhas** receitas. Embaixo: Intensidade · Puxar · Vencido. Toque e segure um filme para ver a ficha. |
| **Ajustes** | Luz (exposição, brilho, contraste, realces, sombras, brancos, pretos, esmaecer, curvas), Cor (calor, matiz, saturação, vibração, tom de pele, cores HSL), Detalhe (clareza, nitidez com cópia em papel, vinheta), **Seletivo** (pontos com a máscara que abraça o assunto) e **Enquadrar** (corte, girar, endireitar, perspectiva, lente). |
| **Analógico** | Textura (grão por tipo, poeira), Luz (halação, difusão, luz vazada, flash com estilos) e Laboratório (céu queimado a partir do horizonte). |

Exportar: JPEG ou PNG em tamanho real (sem localização), salvar no aparelho ou compartilhar com outro app. Várias fotos de uma vez com a mesma edição. Comparar: segurar mostra a original; um toque abre a cortina.

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Tela do app (estrutura e estilos) |
| `app.js` | Interface: abas, ferramentas, gestos sobre a foto, receitas, histórico, exportação |
| `render.js` | Processamento na placa de vídeo (WebGL2): filme (tabela 3D), ajustes, seletivo, céu, flash, grão, poeira, luz vazada, geometria |
| `core.js` | Abertura de arquivos (JPEG, HEIC, RAW pela prévia embutida) |
| `icons.js` | Ícones da interface |
| `filmes/` | Os filmes: tabela 3D (`.bin`) e ficha (`.json`) de cada um; `indice.json` diz quais aparecem |
| `sw.js`, `manifest.webmanifest` | Funciona sem internet e instala na tela do celular |
| `android/` | APK (Capacitor): `android/gerar_apk.sh` |
| `testes/` | Testes automáticos (Playwright); veja `testes/README.md` |
| `vendor/` | Decodificador HEIC (libheif, LGPL-3.0) |
| `classico/` | O app anterior (v47), guardado e ainda acessível em `/classico/` |
| `novo/` | Endereço antigo do app novo: leva ao principal e desliga o cache antigo |
| `pesquisa/` | Pesquisa dos filmes: motor espectral, fichas técnicas, ferramentas (não é carregada pelo app) |
| `referencias/` | Referências de estilo e estudos (não é carregada pelo app) |

## Como rodar

```bash
python3 -m http.server 8000     # na raiz; abra http://localhost:8000/
android/gerar_apk.sh            # gera o APK (baixa o SDK do Android na primeira vez)
```
Os filmes são gerados por `pesquisa/motor/filmes_finais.py` (depois de `pesquisa/motor/exportar.py`). Próximos passos em `PROXIMOS.md`; o que testar em cada versão em `TESTE.md`.

## Regra de atualização

A cada versão nova:

1. Suba o número em `sw.js` (`const CACHE = 'revela-vNN'`). Sem isso, quem já tem o app instalado continua com a versão antiga.
2. Acrescente uma linha no topo do **Histórico** abaixo.
3. Use o mesmo `vNN` no início da mensagem do commit.

## Histórico

| Versão | Data | O que mudou |
|---|---|---|
| v48.5 (teste) | 2026-11-18 | **Receitas** (aba Filmes › Receitas): 7 combinações de filme + revelação + textura num toque, com nomes clássicos e tudo ajustável depois (Silver 400 · Puxado, Silver Portrait · Grão, Chrome 64 · Rua, Chrome 64 · Vencido, Portrait 400 · Puxado, Portrait 160 · Claro, Tungsten 800 · Noite). Inspiração em `pesquisa/receitas.md`. |
| v48.6 (teste) | 2026-11-18 | **Tela mais limpa**: no celular, Ajustes e Analógico viram uma linha de ferramentas com um controle por vez (como no VSCO e no RNI) e um ponto nas ferramentas mexidas. Painel com altura fixa (228 px no Pixel 7, antes até 367): a foto não encolhe ao trocar de aba ou de ferramenta. No computador, tudo à vista na coluna. |
| v48.7 (teste) | 2026-11-18 | **Ajustes clássicos** (portados do app publicado e postos depois do filme): Exposição, Brilho, Contraste, Realces, Sombras, Brancos, Pretos, Esmaecer, **Curvas** (Luz, Vermelho, Verde, Azul; no celular o desenho fica sobre a foto), Calor, Matiz, Saturação, Vibração, **Tom de pele**, **Cores** (HSL em 8 faixas), Clareza, Nitidez, Vinheta e **Corte** (Livre, Original, 1:1, 4:5, 2:3, 9:16, 3:2, 16:9; girar, espelhar, endireitar com zoom automático). Analógico: **Difusão**. **Retrato guardado na gaveta** (chave `RETRATO` em `novo/app.js`). Correção: a posição sorteada da luz vazada não era enviada ao motor. |
| v48.8 (teste) | 2026-11-19 | **Puxar e Vencido junto do filme** (aba Filmes: Intensidade · Puxar · Vencido) e valendo também sem filme (antes não faziam nada no Digital). Curvas: dois cliques, dois toques ou botão direito apagam o ponto. Cores mostra o nome da cor. Luz vazada sem Raios. Poeira ao lado do Grão. Celular: descrição do filme de passagem e altura igual em todas as abas. |
| v48.9 (teste) | 2026-11-19 | **Enquadrar** (inspirado no SKRWT, gravação do usuário): ícones Cortar, Girar, Endireitar, Perspectiva vertical e horizontal e **Lente** (barril/almofada à mão, sem perfis); régua com marcas; grade; ✕ cancela e ✓ aplica; ampliação automática conferida em vários pontos da borda (a lente curva as bordas). A mesma conta no JavaScript (`mapeia`) e no shader (`geoUv`). Espelhar saiu. |
| v48.10 (teste) | 2026-11-19 | **Nitidez −100 a +100** (como no RNI): o lado − é a **cópia em papel fotográfico** (maciez do ampliador e do papel + acutância que mantém as formas + luz que anda no papel), portado do `uPrint` do app publicado. **Grão por tipo** (Fino, Clássico, Áspero, Colorido). Receitas **Silver 400 · Noturno** (inspiração: Daido Moriyama) e **Chrome 64 · Chuva** (Saul Leiter). |
| v48.11 (teste) | 2026-11-19 | **12 filmes**: entram **Portrait 800** (base KP 800), **Gold 200** (base KG 200) e **Vivid 50** (identidade do Velvia 50 sobre o cromo E100), afastados dos vizinhos parecidos comparando os 12 lado a lado (`pesquisa/filmes_finais.md`). Receitas **Portrait 800 · Cidade** e **Gold 200 · Fim de tarde**. |
| v48.13 (teste) | 2026-11-19 | **Estudo do RNI Films** (gravações do usuário): número grande sobre a foto ao arrastar; barra acesa a partir do zero, com pontinho no zero. **Grão** mais assumido, com manchinhas e cor leve nos coloridos (a essência do Analog Feel entra no grão, sem ferramenta duplicada). **Poeira** refeita: fios curvos, grumos irregulares, tamanhos variados, menos quantidade. 48.12: descrição do Silver Portrait sem a marcação do rosto. |
| v48.14 (teste) | 2026-11-19 | **Ampliação** (queimar o céu com filtro duro a partir do horizonte, acender o assunto sem estourar, queimar o entorno; em paradas de luz na cópia, antes do grão) e **Flash** dos anos 90 (luz na cena antes do filme: assunto até +0,7 parada, fundo até −2,2, queda pela composição típica da foto de flash, luz fria e dura, brilho na pele; o ombro do filme segura a pele). Mira e horizonte sobre a foto. Receitas **Silver 400 · Épico** (Salgado) e **Gold 200 · Flash**. Sem IA. |
| v48.15 (teste) | 2026-11-19 | **Máscara que abraça o assunto** (no estilo dos U Points do Snapseed, sem IA): no miolo do círculo vale tudo; nas bordas, a semelhança de cor e brilho com o ponto tocado (foto levemente desfocada, por regiões) decide. A primeira versão partia assuntos de duas cores (cachorro laranja e branco); corrigido. **Círculo com o tamanho real**, que se muda arrastando a borda ou com pinça. Vale para Ampliação e Flash. |
| v48.16 (teste) | 2026-11-20 | **Minhas receitas** (no aparelho, sem conta; código `RV1.` para passar adiante, validado ao colar), **ficha do filme** (toque longo), **cortina** de comparação (um toque no botão comparar) e **exportar para o Instagram** (1080 px, 4:5 no máximo, redução em etapas). |
| v48.17 (teste) | 2026-11-20 | Luz vazada: **Rolo aberto**, **Fresta** e **Névoa quente** (a "queima do fim do rolo" ficou de fora por duplicar o tipo Início; a Fresta foi refeita depois do primeiro teste por parecer artificial). Revisão geral sem problemas em 320 px, iPhone e computador. |
| v48.18 (teste) | 2026-11-20 | **Exportar**: formato (JPEG ou PNG, lembrado) e destino (Salvar ou Compartilhar… pelo menu do sistema; no APK, plugin Share). A opção Instagram saiu: o Revela entrega a foto, o destino é escolha da pessoa. |
| v48.19 (teste) | 2026-11-20 | **Seletivo** (até 4 pontos; Luz, Contraste, Saturação, Calor, Estrutura, Entorno; máscara que abraça com miolo menor, sem halo; máscara visível em vermelho), **Céu** com proteção do que não é céu (semelhança com a cor do céu no alto e perto do horizonte), **estilos de Flash** (Anos 90, Compacta digital, Festa). A Ampliação virou Céu; assunto e entorno foram para o Seletivo. Correções: pergunta coberta pelos pontos; tamanho só pela alça. |
| v48.20 (teste) | 2026-11-20 | **Exportação segura em fotos grandes**: limite de 16 MP no Safari do iPhone/iPad (acima disso sai em branco) e conferência do tamanho aceito pela placa de vídeo em qualquer aparelho. **Testes automáticos** guardados em `novo/testes/` (as fotos de teste ficam fora do repositório). |
| v49.1 | 2026-11-20 | **Sessão guardada no aparelho** (IndexedDB): se o Android fechar o app em segundo plano, a foto, a edição e o desfazer voltam sozinhos; perda da placa de vídeo recarrega e recupera. **Filme de inspiração** embaixo de cada nome na faixa. |
| v49.2 | 2026-11-20 | **Identidade nova**: ícone da cópia inclinada (céu petróleo, paleta Kodachrome), serifa só nos destaques e letra do sistema no resto, marcação vermelha, "inspirados em filmes reais", contraste e áreas de toque melhores, sem nome repetido nas ferramentas de uma barra. Ícone gerado por `referencias/icone/gerar_icone.py` + `testes/icones_png.js`. |
| v49.3 | 2026-11-22 | **Vermelho Valentino** em todos os destaques (`--accent: #b5121b`; texto pequeno em `--accent-texto: #e0403f`); seleção do filme com borda simples. |
| v49.4 | 2026-11-22 | **Cartão do filme** ao escolher (nome, inspiração, descrição); sem o filme real embaixo das miniaturas; faixa de Filmes e Receitas com a mesma altura. |
| v50 | 2026-11-23 | **Preto e branco seguindo o celular** (`prefers-color-scheme`), seleção em retângulo arredondado invertido; **Ajustes em 6 ferramentas** com segunda linha (`sub` em GRUPOS); Esmaecer e Vinheta em Analógico; **Enquadrar na barra de cima** (`#bEnquadrar`); ícone refinado (escuro e claro). |
| **v49** | 2026-11-20 | **O Revela novo vira o app e o site principal** (o anterior vai para `/classico/`; `/novo/` leva ao principal e desliga o cache antigo; APK com o nome "Revela"). **Limpeza do código** (sem moldura do filme, riscos longos, luz vazada Raios, escolhas de laboratório e filtro, chave liga/desliga). **Dicas de primeira vez** para os gestos escondidos. **Receitas por família** (preto e branco, cor, noite e flash). |
| v48.4 (teste) | 2026-11-18 | **Filmes mais fiéis** (comparação com as curvas do VSCO, `pesquisa/vsco_curvas.md`): luzes mais claras nos filmes coloridos (brancos não ficam acinzentados) e Pro 400 mais macio e arejado, como o 400H. **Revelação** (aba Analógico, qualquer filme): **Puxar** (−1 a +3 pontos: mais contraste e grão) e **Vencido** (véu, cor desbotada, menos sensibilidade e o tom de cada rolo, com dado). |
| v48.3 (teste) | 2026-11-17 | Borda do filme escolhido não sai mais cortada em cima (a faixa ganhou espaço para ela). |
| v48.2 (teste) | 2026-11-17 | **Topo cabe em celular estreito** (visto no Moto Edge 50 Neo: "Exportar" cortado): com a foto aberta, o nome sai do topo e os botões ficam mais próximos; conferido de 320 a 412 px. |
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
