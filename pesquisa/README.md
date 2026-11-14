# Pesquisa de filmes do Revela

**Objetivo:** reproduzir cada filme com a fidelidade de quem mede, não de quem ajusta a olho. Cada filme do Revela novo nasce de um dossiê com os dados técnicos do fabricante, o comportamento observado e fotos de referência reais.

## Onde está cada coisa

| Pasta | O que tem |
|---|---|
| [`filmes/`](filmes/) | Um dossiê por filme. O primeiro, e molde dos outros: [Portra 400](filmes/portra-400.md) |
| [`fichas.md`](fichas.md) | Inventário das fichas técnicas de todos os filmes candidatos: onde estão, o que contêm, se os gráficos são extraíveis |
| [`dados/`](dados/) | Números extraídos das fichas, em JSON |
| [`figuras/`](figuras/) | Gráficos refeitos a partir dos dados, mais a conferência da extração sobre o original |
| [`ferramentas/`](ferramentas/) | Scripts para extrair as curvas dos PDFs (um a um ou em lote, com calibração automática dos eixos) e gerar as figuras |
| [`motor/`](motor/README.md) | **Protótipo do motor espectral**: simulação do filme e LUTs `.cube` para testar no app |

## Método

1. **Ficha técnica.** Extrair as curvas do fabricante: características, sensibilidade espectral, densidade dos corantes e MTF. Quando o gráfico é vetorial, as curvas saem direto do desenho do PDF, com precisão total. A extração é sempre conferida sobrepondo os dados ao gráfico original.
2. **Comportamento observado.** Juntar relatos de fotógrafos e laboratórios (exposição, pele, scanners), sempre separados dos dados medidos.
3. **Lacunas.** Listar o que a ficha não diz e como obter.
4. **Fotos de referência.** Cartela de cores e pele em várias exposições, em filme e em digital, com scan de laboratório. É a prova final.
5. **Modelo.** Simulação espectral (luz → camadas → curvas → corantes → scanner ou papel), calculada no computador e entregue ao app como LUT 3D com parâmetros de grão, nitidez e halação.

## Como reproduzir

```sh
pip install pdfplumber numpy matplotlib
# baixe os PDFs listados no topo de ferramentas/extrair.py numa pasta
python3 pesquisa/ferramentas/extrair.py <pasta-dos-pdfs>
python3 pesquisa/ferramentas/graficos.py
```

## Direitos e licenças

- Os **PDFs das fichas não ficam no repositório**: pertencem aos fabricantes. Os scripts apontam para as fontes oficiais.
- Os **números extraídos** são medições técnicas publicadas, usadas aqui como referência de engenharia, com a fonte citada em cada arquivo.
- Projetos abertos de simulação, como o **spektrafilm** (código GPLv3, dados CC BY-SA 4.0), são lidos **só como referência de método**. Nenhum código ou dado deles foi copiado, para o Revela continuar livre para escolher a própria licença.

## Situação

| Filme | Ficha extraída | Dossiê | Fotos de referência | No app |
|---|---|---|---|---|
| Kodak Portra 400 | ✅ | ✅ | ⏳ a fazer | ✅ no app novo (KP 400) |
| Kodak Portra 160 e 800 (com curvas puxadas do 800) | ✅ | — | ⏳ | ✅ (KP 160, KP 800) |
| Kodak Ektar 100 | ✅ | — | ⏳ | ✅ (KE 100) |
| Kodak Gold 200 e UltraMax 400 | ✅ | — | ⏳ | ✅ (KG 200, KU 400) |
| Kodak Vision3 500T (base do CineStill 800T; **corantes C, M, Y publicados separados**) | ✅ | — | ⏳ | ✅ (C 800T) |
| Kodak Ektachrome E100 (cromo; corantes separados) | ✅ | — | ⏳ | falta o caminho de cromo no motor |
| Fuji, preto e branco, instantâneo | ver [fichas.md](fichas.md) | — | — | — |

As 25 extrações das fichas Kodak têm conferência visual em [`figuras/fichas/`](figuras/fichas/) (dados em cor sobre o gráfico original).
