# Briefing: identidade visual e interface do Revela

> Copie tudo abaixo da linha e cole na outra IA.

---

Você é diretor de arte e designer de produto. Quero que você crie **opções de identidade visual e de interface** para um app de fotografia chamado **Revela**. Leia o briefing inteiro antes de começar.

## 1. O que é o Revela
O Revela é um app que transforma fotos digitais em fotos com **alma de filme analógico**. A pessoa fotografa com qualquer celular ou câmera, abre a foto no Revela, escolhe um filme e exporta. Tudo é processado no próprio aparelho; nenhuma foto sai dele.

- Funciona como **web app** (instalável na tela do celular, funciona sem internet) e como **app Android**.
- Os filmes não são filtros de cor desenhados no olho. Cada filme nasce de um **motor que simula a física do filme real**, com dados das fichas técnicas da Kodak e da Fuji: como cada camada enxerga a luz, a curva de cada filme, o grão, a halação. Por cima da física, cada filme ganha uma **identidade** própria, testada em fotos reais.
- O nome **Revela** tem duplo sentido: **revelar** o filme no laboratório e **revelar** algo, mostrar como você viu aquele momento.

## 2. O problema que ele resolve
A foto do celular moderno sai "lavada" e ultranítida: correta, mas sem alma. Apps como **RNI Films, VSCO, Hipstamatic, Mextures e Labbet** resolvem isso no iPhone, mas muitos nunca chegaram ao Android, ou chegaram piores. O editor nativo do iPhone, o Google Fotos e o Snapseed não têm essa elegância e identidade. O Lightroom consegue, mas exige conhecimento técnico e uma parafernália de ferramentas.

## 3. Para quem é
Para quem fotografa a própria vida: viagens, a casa numa segunda-feira à tarde, os amigos, os bichos, o pôr do sol, uma cachoeira, uma rua em Paris. No fim do dia, no sofá, a pessoa quer editar algumas fotos para postar ou mandar para quem ama e dizer: *"queria que você estivesse aqui e pudesse ver como eu estou vendo"*.

Ela **não** quer aprender técnica, nem escolher entre 200 presets parecidos. Quer poucas escolhas, cada uma com personalidade clara, e um resultado bonito em dois toques.

## 4. Princípios do produto (não negociáveis)
1. **Poucos filmes, cada um com alma.** São seis. Dá para reconhecer cada um de relance na miniatura.
2. **Claro, intuitivo e sem distrações.** Nada de jargão técnico na tela. Nada de piadas ou referências que exijam explicação.
3. **A foto é a estrela.** A interface some em volta dela.
4. **O caráter analógico é sempre real.** O grão pode ser mais ou menos, mas sempre parece grão de filme, nunca ruído digital.
5. **Elegância de app de fotografia premium** (RNI, VSCO, Snapseed), não de app de efeitos.

## 5. Os seis filmes (nomes definitivos)
| Filme | Alma | Inspiração |
|---|---|---|
| **Portrait 400** | luz dourada, pele que brilha, verdes quentes | Kodak Portra 400 |
| **Chrome 100** | cor densa, azul profundo, contraste firme | Kodak Ektar 100 e os cromos |
| **Pro 400** | verdes para o ciano, ar leve, brancos limpos | Fuji Pro 400H |
| **Tungsten 800** | noite de cinema: sombras azul-petróleo, luzes laranja com halo | CineStill 800T |
| **Silver 400** | preto e branco épico: pretos profundos, céus dramáticos | Kodak Tri-X (pense em Sebastião Salgado) |
| **Silver Portrait** | preto e branco íntimo, o rosto em destaque | o retrato de Peter Lindbergh |

## 6. Como o app funciona hoje (a estrutura a manter)
- **Topo:** abrir foto, desfazer, refazer, comparar com a original (segurar), **Exportar**.
- **Centro:** a foto.
- **Embaixo, três abas:**
  - **Filmes:** uma linha de miniaturas (a própria foto com cada filme) e o controle **Intensidade**.
  - **Ajustes:** **Luz**, **Calor**, **Matiz**. Só no Silver Portrait aparece **Retrato**: marcar o rosto com um toque e escolher a **separação do rosto** (suave, padrão, forte).
  - **Analógico:** **Grão**, **Tamanho do grão**, **Halação**.
- **Tela vazia (antes de abrir uma foto):** hoje é só um botão "Abrir uma foto". Precisa de uma tela de boas-vindas de verdade.

## 7. O que já existe e o que está fraco
- **Ícone atual:** uma fatia de fruta cítrica rosa com casca verde e amarela, sobre fundo preto. É de quando o app tinha outro nome e outra ideia. Diz "fruta" ou "drinque", não fotografia. **Deve ser substituído.**
- **Interface atual:** funciona, mas parece protótipo de engenheiro. Miniaturas pequenas e apertadas, texto pequeno, controles empilhados, descrições longas ocupando espaço, troca de filme sem transição.
- **Rascunho de direção** (pode seguir, contestar ou superar): fundo quase preto quente (#11100F), texto marfim (#EEE7DC), um único acento âmbar (#E2A257, a luz do Portrait 400). Serifa clássica para o nome (Instrument Serif), sans-serif limpa para a interface (Inter). Três ideias de ícone: um círculo de luz âmbar com grão; o "R" em serifa sobre âmbar; um fotograma 35 mm com a janela âmbar.

## 8. O que eu quero de você
Crie **três direções diferentes** de identidade visual. Para cada uma, entregue:
1. **Conceito** em duas ou três frases: a ideia e o sentimento.
2. **Ícone do app:** descrição precisa e, se puder, o desenho (SVG ou imagem). Tem de funcionar em 1024 px e em 48 px na tela do celular, no fundo claro e no escuro.
3. **Logotipo / escrita do nome** "Revela".
4. **Paleta:** fundo, superfícies, texto principal, texto secundário e um ou dois acentos, em hexadecimal, com contraste legível (mínimo 4,5:1 para textos).
5. **Tipografia:** fontes (de preferência gratuitas, como as do Google Fonts) e a escala de tamanhos.
6. **Tela principal** (celular, 390 × 844): a foto, a linha de filmes e a aba Filmes aberta. Mostre como fica a miniatura escolhida, o nome do filme, a descrição curta e o controle de intensidade.
7. **Tela de boas-vindas** (antes de abrir uma foto).
8. **Detalhes de interação:** como é a troca de filme (transição), como são os controles deslizantes, como é o "segurar para ver a original", e uma pequena vibração ao chegar no centro do controle.
9. **Tom de voz:** como o app fala (as frases curtas da tela de boas-vindas, as descrições dos filmes, a mensagem depois de exportar). É em **português do Brasil**, direto, caloroso, sem jargão.

## 9. Restrições
- **Não copie** a identidade de RNI, VSCO, Hipstamatic, Kodak, Fuji ou de qualquer outra marca: inspiração sim, cópia não. Não use logotipos ou embalagens de filmes reais.
- **Nada de** gradientes chamativos, emojis, neon, "estética de IA", mockups com efeitos exagerados.
- Tudo tem de caber num celular comum, com toques de no mínimo 44 px.
- Precisa funcionar no Android e no iPhone e ser fácil de implementar em HTML e CSS.

## 10. Como avaliar as opções
Uma boa direção:
- é reconhecível no ícone pequeno;
- deixa a foto brilhar;
- faz os seis filmes parecerem seis personalidades;
- tem a sofisticação silenciosa de um bom app de fotografia;
- e faz a pessoa querer abrir o app no fim do dia só para rever as fotos.
