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
