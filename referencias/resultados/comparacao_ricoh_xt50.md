# Ricoh GR IIIx × Fujifilm X-T50: o que cada marca faz com a foto

Comparação das duas sessões com a mesma cartela ([Ricoh](ricoh_sessao1/README.md), [Fuji](xt50_sessao1/README.md)). Papel fotográfico em todas as tabelas.

**Como comparar câmeras diferentes:**
- **Tom:** L\* do cinza em paradas a partir do cinza médio medido pela câmera (exposição 0). A referência de luz vem de uma foto de cada sessão; a luz e a cena não são idênticas, então diferenças de 1–2 L\* não querem dizer nada.
- **Cor:** cada simulação é comparada com o **RAW da própria câmera** (deslocamento de matiz em graus e de croma). Os valores absolutos não se comparam entre sessões: o RAW neutro já difere (pele h 7° na Ricoh e 16° na Fuji), pela matriz de cor de cada sensor e pela luz da sessão.

## 1. O padrão de cada marca: Ricoh Standard × Fuji Provia

| | Ricoh Standard | Fuji Provia |
|---|---|---|
| Cinza médio (L\*) | 48 | **57** |
| Contraste nos médios (L\* em +1 − L\* em −1) | 38 | 39 |
| Sombra (−2 paradas) | 17 | 21 |
| Saturação × RAW | 1,13 | **1,33** |
| Pele clara (matiz / croma × RAW) | −1° / ±0 | −2° / **+3,5** |
| Céu | −8° | −12° |
| Folhagem (croma) | +5,6 | +6,1 |

**Leitura:** com a mesma exposição medida, o JPEG da Fuji sai **mais claro** (cinza 8 L\* acima, cerca de ⅔ de parada) e **mais saturado** (+20 % de cor sobre o RAW, contra +13 % da Ricoh). O contraste nos médios é praticamente o mesmo. A Fuji dá um pouco mais de cor à pele. As duas levam o céu levemente para o ciano.

## 2. "Filme negativo": Ricoh Negative Film × Fuji Classic Neg

| | Ricoh Negative Film | Fuji Classic Neg | Fuji Nostalgic Neg |
|---|---|---|---|
| Pele clara (matiz / croma) | **+20°** / −2,3 | **+19°** / +3,0 | **+26°** / +3,8 |
| Céu | **−20°** / −10 | **−18°** / −12 | −25° / −4 |
| Folhagem | **+20°** / +1,9 | **+22°** / −0,4 | −7° / +2,8 |
| Saturação × RAW | 0,87 | 1,06 | 1,17 |
| Cinza médio (L\*) | 55 (+7 sobre o Standard) | 62 (+6 sobre o Provia) | 58 |
| Contraste nos médios | 41 | **50** | — |

**A descoberta mais interessante:** as duas marcas, que nunca combinaram nada entre si, chegam **à mesma assinatura de "negativo"**:
- **pele +20° para o âmbar**,
- **céu −20° para o ciano**, com menos cor,
- **folhagem +20° para o verde-ciano**,
- **foto mais clara** que o padrão da própria marca.

Isso é o "jeito de negativo escaneado" que as pessoas reconhecem. A diferença está na intensidade: a Ricoh tira cor (0,87) e mantém o contraste suave; a Classic Neg mantém a cor e **sobe muito o contraste** (50 contra 41). A Nostalgic Neg é a versão mais quente (pele +26°) e não mexe na folhagem.

## 3. "Cromo / slide": Ricoh Positive Film × Fuji Velvia

| | Ricoh Positive Film | Fuji Velvia |
|---|---|---|
| Saturação × RAW | 1,22 | **1,64** |
| Pele | +4° / +1,4 | +3° / +5,2 |
| Céu (croma) | +4,4 | **+17** |
| Folhagem (croma) | +3,7 | **+13,8** |
| Cinza médio | **41** (mais escuro) | 56 |
| Contraste nos médios | **45** | 37 |
| Sombra (−2) | **9** | 18 |

**Leitura:** as duas fazem "slide" por caminhos diferentes. A Ricoh faz pelo **tom**: escurece a foto e aumenta o contraste, quase sem mexer na cor. A Fuji faz pela **cor**: céu e verde muito mais saturados, com o tom quase igual ao do Provia. As duas preservam o matiz da pele (+3° a +4°).

## 4. Bleach bypass

| | Ricoh Bleach Bypass 2 | Fuji Eterna Bleach Bypass |
|---|---|---|
| Saturação × RAW | 0,47 | 0,61 |
| Céu | −33° / −21 | −35° / −22 |

As duas tiram metade da cor e levam o céu para o ciano do mesmo jeito.

## O que isso traz para o Revela

1. **A assinatura do negativo é universal e mensurável:** pele +20° ao âmbar, céu −20° ao ciano, verde +20° ao ciano, foto mais clara. Ela serve de **teste de sanidade** para os filmes negativos do motor: se o Gold ou o Portra do Revela não fizerem algo nessa direção, há algo errado. (A causa física provável é a máscara laranja e os corantes do negativo, mais a correção do scanner; isso fica para conferir no motor.)
2. **Quanto cada marca clareia é uma escolha de estilo, não física.** A Fuji põe o cinza ~⅔ de parada acima da Ricoh. O Revela precisa decidir onde fica o seu "cinza médio" e manter isso igual em todos os filmes, para a troca de filme não parecer troca de exposição.
3. **"Slide" pode ser tom ou cor.** Ricoh e Fuji mostram as duas leituras. No Revela, o Ektachrome deve seguir a ficha técnica: contraste alto *e* cor, sem escolher só uma.
4. **P&B:** o filtro de cor (G, R, Ye) muda mais o resultado do que a simulação em si (Acros × Acros+G: pele −4,4, vermelho −5,6). Vale um controle de filtro nos filmes P&B do Revela.
