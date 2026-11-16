# Emulação da receita "PB Peter Lindbergh" (Fujifilm X-T50)

Revela o RAW da X-T50 e reproduz a receita do usuário (v1, C1 da câmera), calibrada contra a conversão real do X RAW Studio. Depois aplica a proposta v2 (ver `../anotacoes/peter_lindbergh.md`).

| Arquivo | Papel |
|---|---|
| `prep.py` | Revela os RAWs (meia resolução, linear) e reduz RAW e v1 ao mesmo grid desfocado |
| `fit.py` | Ajusta a mistura de canais e a curva de tons da v1 → `curve_v1.npz` |
| `medir_textura.py` | Mede o grão (amplitude por tom, tamanho) e o contraste local da v1 |
| `lindbergh.py` | Pipeline completo: `python3 lindbergh.py v1|v2 <saída> <RAFs…>` |
| `validar.py` | Compara a v1 emulada com a v1 real |
| `dec.mjs` | Decodifica HEIC com o libheif do próprio app (`vendor/`) para `.rgba` |
| `iphone.py` | Aplica a v3 a fotos já processadas (HEIC do iPhone, Display P3): P3→linear, âncora de cinza médio, grão e textura proporcionais ao quadro |

## Resultado da calibração (v1 emulada × v1 real, 3 fotos)
- Mistura de canais medida (ACROS+G): **R 0,10 · G 0,69 · B 0,21**. O verde forte e o vermelho fraco confirmam o filtro G.
- Tom: erro médio **2,5–3,5 níveis em 255**, com viés abaixo de ±1,1.
- Grão: igual à v1 em todas as faixas de tom (diferença ≤ 0,5 nível); cerca de 20 níveis nos médios, caindo para 12 nos brancos.
- Contraste local (banda σ8–64 px): 97–99 % do real.

## O que foi medido e o que foi estimado na v2
- **Medido:** a base (curva, mistura, grão Small, contraste local da v1).
- **Estimado:** o tamanho de um passo de Highlight/Shadow (±0,035), de um passo de Clarity (9,4 % na banda média), a nitidez e o grão Large (σ 1,1 px, 1,5× mais visível que o Small em escala de visualização). Para confirmar, basta converter a v2 de verdade no X RAW Studio e rodar `validar.py`.

## Teste no iPhone (16/11/2026)
4 retratos em HEIC (iPhone, ISO 1000, luz de janela, sem ProRAW). A receita funcionou sem ajuste específico. Limitações: a foto já vem com o tom e a redução de ruído do iPhone, que não são desfeitos; a exposição é ancorada no cinza médio (0,18 → cinza médio da curva v1). Com ProRAW (DNG), o ponto de partida seria a luz da cena, como na X-T50.

## v5 retrato (16/11/2026)
Medido em 4 fotos de referência do fotógrafo (rua, praia, sol, retrato), comparadas com os retratos v3:

| | Pele (mediana) | Faixa dentro do rosto (p10–p90) | Rosto − mediana da foto | Textura fina da pele |
|---|---|---|---|---|
| Referências | 95–157 | larga (ex.: 21–145, 55–201) | +54 a +118 | 10–15 |
| v3 | 174–188 | estreita (127–197) | +20 | 11–27 |
| **v5** | **133–137** | **16–169 a 75–169** | **+77/+78** (perfil contraluz: +35) | sem nitidez extra |

Conclusões: a pele fica no cinza médio (não clara); a separação vem do rosto acima da foto inteira, não do fundo imediato (nas fotos de praia o fundo é mais claro que o rosto); há luz e sombra dentro do rosto; a textura vem do grão, não da nitidez.

`v5_retrato.py`: exposição ajustada até a pele cair em 135; contraste ×1,25 em paradas centrado no rosto; entorno escurecido por máscara suave (adaptativo, até 2,5 paradas) até o rosto ficar ≥ +60 acima da mediana; Shadow +1, Highlight −1, Clarity 0, sem nitidez, leve suavização da nitidez do iPhone; grão orgânico. **O rosto foi marcado à mão neste teste**; no app, viria de detecção de rosto.

## v5 → v6 (16/11/2026)
O usuário achou a v5 escura demais ("prefiro a v3"). A v6 é o meio-termo: pele no topo da faixa medida (alvo 155), contraste ×1,12, entorno −0,55 parada fixo (sem escurecimento adaptativo), Shadow −1 (como a v1/v3). Resultado: pele 156–157, rosto +44 a +46 acima da mediana (v3: +20; v5: +78). O perfil contra a janela (IMG_7117) não separa sem escurecer muito: aí a luz da cena manda.

## Decisão (16/11/2026)
- **v6 é o ponto padrão** do retrato Lindbergh.
- **v3 e v5 ficam como extremos** de um controle de "separação do rosto" (0 = v3, padrão = v6, máximo = v5), como recurso criativo.
- No app, a posição do rosto viria de detecção automática no próprio aparelho (pessoas e, quando possível, animais), com ajuste manual por toque como alternativa.

## No app novo (16/11/2026)
- **Filme "Lindbergh"** (categoria P&B, `novo/filmes/lb.*`): a tabela é gerada da **receita calibrada** (mistura de canais e curva medidas na C1, Shadow −1, Highlight −1), por `pesquisa/motor/exportar.py` (`ReceitaLindbergh`). Grão e nitidez são os controles analógicos do app.
- **Seção "Retrato"** em Ajustes, só neste filme: **Marcar o rosto** (toque na foto), **Separação do rosto** (0 = v3, 50 = v6 padrão, 100 = v5) e **Tamanho do rosto**. No shader: contraste centrado no rosto (1,0 → 1,12 → 1,25), pele exposta para o alvo (v6 155, v5 135), entorno escurecido por máscara suave (0 → 0,55 → 1,5 parada).
- **Conferência** (retrato IMG_7110 no app):

| Separação | Pele (app) | Pele (teste) | Rosto − foto (app) | Rosto − foto (teste) |
|---|---|---|---|---|
| 0 (v3) | 170 | 174–188 | +29 | +20 |
| 50 (v6) | 158 | 156–157 | +52 | +44 a +46 |
| 100 (v5) | 132 | 133–137 | +75 | +77/+78 |

- **Próximo passo:** marcar o rosto sozinho, com detecção de rosto no próprio aparelho (fase 7 do panorama). Por enquanto, o toque.
