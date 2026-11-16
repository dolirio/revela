# Filmes do app novo × assinatura medida nas câmeras (16/11/2026)

Ferramenta: [`ferramentas/conferir_assinatura.py`](ferramentas/conferir_assinatura.py). A cartela de projeto (luz linear, cinza 5 = 0,18) passa pela tabela de cada filme como no shader, com o equilíbrio automático do laboratório ligado, e é comparada com a mesma cartela sem filme. Referência: [comparação Ricoh × Fuji](../referencias/resultados/comparacao_ricoh_xt50.md).

## Resultado

| Filme | Cinza (L\*) | Contraste nos médios | Saturação | Pele clara (matiz / croma) | Céu | Folhagem |
|---|---|---|---|---|---|---|
| KE 100 (Ektar) | 50,7 | 32,3 | 1,27 | −8° / +5,4 | −14° / +5,8 | +3° / +12,7 |
| KP 160 (Portra 160) | 50,7 | 32,0 | 0,98 | −9° / −0,5 | −15° / −0,4 | +1° / +0,9 |
| KG 200 (Gold) | 50,7 | 32,1 | 1,17 | +3° / +4,0 | −8° / +2,5 | −1° / +9,9 |
| KP 400 (Portra 400) | 50,7 | 32,1 | 1,11 | −8° / +2,7 | −13° / +1,9 | +1° / +6,8 |
| KU 400 (Ultramax) | 50,7 | 32,0 | 1,23 | −1° / +4,9 | −1° / +8,1 | 0° / +8,9 |
| KP 800 (Portra 800) | 50,7 | 31,9 | 1,09 | +3° / +1,4 | −1° / +4,9 | −1° / +3,5 |
| C 800T | 50,7 | 32,2 | 1,06 | +4° / −0,1 | 0° / +4,8 | −2° / +3,2 |
| *Assinatura "negativo" (Ricoh e Fuji)* | *+6 a +7 sobre o padrão* | *41–50* | — | ***+20°*** | ***−20°*** | ***+20°*** |

Curva do cinza (L\* em −4…+4 paradas) praticamente igual em todos: ~14 / 17 / 24 / 35 / **51** / 68 / 82 / 91 / 96.

## Leitura
1. **Tom igual em todos os filmes.** Cinza, contraste e pretos saem idênticos (diferença < 1 L\*). A curva do laboratório/scanner, aplicada depois do negativo, está apagando a diferença de contraste entre os filmes: o Ektar devia ser bem mais contrastado que o Portra. É o primeiro ponto a investigar no motor (`pesquisa/motor/exportar.py`).
2. **Contraste baixo e pretos levantados.** 32 contra 38–50 nas câmeras; o preto não desce de L\* 14 (nas câmeras, 3–8 a −3 paradas). Combina com "negativo escaneado", mas está no limite do lavado.
3. **Pele do Portra no sentido oposto.** O Portra 160/400 puxa a pele −8°/−9° para o **rosado**, enquanto a própria descrição do filme diz "pele dourada" e as duas câmeras puxam +20° para o âmbar. Gold, Portra 800 e 800T vão um pouco para o âmbar (+3° a +4°), bem menos que as câmeras.
4. **Céu:** a direção bate (para o ciano) em Ektar, Portra 160/400 e Gold, com a metade da intensidade.
5. **Folhagem:** nenhum filme leva o verde ao ciano. Atenção: isso pode estar **certo** para Kodak. O verde-ciano é traço conhecido dos negativos **Fuji** (Superia), que inspiram a Classic Neg; o Portra tende a verdes mais contidos. A câmera não é a verdade sobre o Kodak.

## O que fazer
- **Tom:** fazer cada filme guardar o próprio contraste (da ficha técnica) através da etapa do laboratório.
- **Pele:** rever no motor o caminho da cor da pele no Portra (corantes, máscara laranja e correção do scanner). A direção esperada é âmbar.
- **Prova final:** as câmeras dão a *direção* do "jeito de negativo", não o valor certo de cada filme Kodak. Quem decide são as fotos da cartela em filme real escaneado (fase 8 do plano).

## Causa do "tom igual em todos" (encontrada no motor)
Em `motor.py`, `_prepara_scanner` ajusta a inversão do scanner **com a inclinação do próprio filme** (reta em densidade, cinza de −2 a +2 paradas), e depois todos passam pela mesma `curva_lab(contraste=1,15)`. Com isso, a inclinação de cada filme é dividida por ela mesma, e todos saem com o mesmo contraste.

Inclinação medida no motor (gama efetivo no scanner, R/G/B):

| Filme | R | G | B | média |
|---|---|---|---|---|
| Ektar 100 | 0,628 | 0,588 | 0,664 | **0,627** |
| Portra 400 | 0,572 | 0,556 | 0,634 | 0,587 |
| Gold 200 | 0,576 | 0,571 | 0,615 | 0,587 |
| Portra 800 | 0,556 | 0,539 | 0,604 | 0,566 |
| Portra 160 | 0,569 | 0,540 | 0,597 | 0,569 |
| Ultramax 400 | 0,542 | 0,533 | 0,591 | 0,555 |
| Vision3 500T | 0,487 | 0,547 | 0,518 | 0,517 |

**Proposta:** dividir pela inclinação de um filme de referência comum (ex.: Portra 400), mantendo a correção por canal de cada filme para o cinza continuar neutro. O Ektar ficaria ~7 % mais contrastado que o Portra 400, e o Vision3 ~12 % mais suave, como nas fichas.

## Correções aplicadas (16/11/2026)
1. **Contraste por filme** (`motor.py`, `GAMA_REF = 0,587`, Portra 400): o scanner continua invertendo cada canal pela inclinação dele, mas o contraste final segue a inclinação média do filme em relação ao Portra 400.
2. **Pele dos Portra 160/400** (`exportar.py`, `lab=0.9`): a correção do laboratório a 70 % deixava a mistura dos corantes puxar a pele 8° para o rosado. Sem correção a pele vai a −37°; a 100 % fica neutra (+3°), mas a saturação do Portra 400 sobe acima da do Gold. 90 % deixa a pele neutra (−1°).

Depois das correções:

| Filme | Contraste | Saturação | Pele | Céu | Folhagem |
|---|---|---|---|---|---|
| KE 100 | **34,3** | 1,29 | −8° | −14° | +3° |
| KP 160 | 31,1 | 1,04 | **−1°** | −6° | +1° |
| KG 200 | 32,1 | 1,17 | +3° | −8° | −1° |
| KP 400 | 32,1 | 1,18 | **−1°** | −4° | +2° |
| KU 400 | 30,3 | 1,22 | −1° | −1° | 0° |
| KP 800 | 30,9 | 1,08 | +2° | −1° | −1° |
| C 800T | **28,6** | 1,02 | +4° | 0° | −2° |

## O que fica em aberto
- **Pele "dourada":** a física modelada leva a pele ao neutro, não ao âmbar. O dourado que as câmeras imitam (+20°) deve vir do "jeito" do scanner do laboratório (Frontier/Noritsu), não do filme. Entra como etapa própria, calibrada com scans reais.
- **Saturação do Portra 400 ≈ Gold:** depende do DIR (interação entre camadas), que a ficha não publica e está provisório. Calibrar com as fotos da cartela em filme real.
- **Ektar com pele −8°:** mesma causa provável (sobra da mistura dos corantes); conferir junto com o Portra na prova com filme real.
