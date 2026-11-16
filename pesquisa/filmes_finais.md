# Os 6 filmes do app (17/11/2026)

**Decisão do usuário:** poucos filmes, cada um com identidade clara ("alma"), nomes clássicos e sem distrações. Os filmes anteriores eram fiéis à física, mas a diferença entre eles era sutil demais no resultado.

**Como cada filme é feito** (`motor/filmes_finais.py`):
1. A base é um filme do motor espectral (a física).
2. Por cima entra uma identidade: curva de tons, cor por faixa de matiz (com as luzes altas protegidas, para o sol não mudar de cor) e tom nas sombras e nas luzes.
3. Tudo isso é assado numa única tabela 3D. O grão é o do app, com a quantidade padrão de cada filme.

| Filme | Alma | Base |
|---|---|---|
| Portrait 400 | luz dourada, pele que brilha, verdes quentes | KP 400 |
| Chrome 100 | cor densa, azul profundo, contraste firme | KE 100 |
| Pro 400 | verdes para o ciano, ar leve, brancos limpos | KP 160 |
| Tungsten 800 | sombras azul-petróleo, luzes laranja com halo | C 800T |
| Silver 400 | P&B épico, pretos profundos (Tri-X + filtro laranja) | KX 400 |
| Silver Portrait | P&B íntimo, rosto em destaque | receita Lindbergh |

**Teste:** 8 fotos originais do usuário (iPhone, DNG, câmeras antigas; dia, noite, interior, contraluz), sem edição prévia. As fotos já editadas que ele mandou serviram como referência de gosto.

**No app:**
- Uma linha só, sem categorias.
- **Ajustes:** Luz, Calor, Matiz; Retrato só no Silver Portrait.
- **Analógico:** Grão, Tamanho do grão, Halação.
- O equilíbrio automático volta ao cinza **do próprio filme**, o que mantém o dourado do Portrait 400.
- Laboratório (Frontier) e filtros de lente saíram da tela: agora vêm embutidos em cada filme.

As tabelas antigas continuam em `novo/filmes/`, mas fora do índice.
