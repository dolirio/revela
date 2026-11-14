# Protótipo do motor espectral (Portra 400)

Primeira versão do motor que simula o filme pela física, a partir das fichas técnicas da Kodak. O cálculo roda **no computador**. O app recebe só o resultado: uma LUT 3D (tabela de cor) `.cube`.

![Retrato: digital, Revela atual e protótipo](../figuras/motor_retrato.jpg)

*Foto de teste: "Mother Nature: Summer", de Autumn Goodman (Unsplash, 2017, CC0), via Wikimedia Commons.*

## Como funciona

```
foto (sRGB) ─► luz da cena (espectro) ─► exposição das 3 camadas do filme ─► interação entre camadas (DIR)
           ─► densidade de cada camada ─► espectro do negativo (corantes + máscara laranja)
           ─┬► SCANNER de laboratório: sensores RGB ─► inversão linear ─► curva de tons do laboratório   ← padrão
            └► CÓPIA óptica: ampliador ─► papel Endura Premier ─► corantes do papel ─► cor vista
```

| Etapa | Dados usados | Aproximação declarada |
|---|---|---|
| Cor → luz | CIE 1931 (ajuste analítico de Wyman et al., 2013) | Cada cor vira o espectro mais suave de um objeto real (refletância de 0 a 1) sob luz do dia |
| Exposição das camadas | **Sensibilidade espectral da ficha** | — |
| Interação entre camadas (DIR) | — | Modelo de primeira ordem, força 0,25, escolhida pela saturação. **Precisa de calibração** |
| Densidade | **Curvas características da ficha** | Prolongadas em linha reta depois do fim do gráfico |
| Corantes do negativo | **Densidade espectral da ficha** (cinza médio − Dmin) | A ficha não separa os corantes; foram separados por ajuste (gaussianas). **Ponto mais frágil** (ver abaixo) |
| Scanner | — | Sensores estreitos em 455, 535 e 660 nm, como os LEDs de um Frontier; inversão linear ajustada num cinza de −2 a +2 paradas |
| Cópia em papel | **Curvas, sensibilidade e corantes do Endura Premier** | Ampliador de tungstênio a 3200 K; base do papel plana |

## Resultados

### Escala de cinza

![Escala de cinza](../figuras/motor_cinza.png)

- **O cinza fica neutro de −4 a +5 paradas** no caminho escaneado: o desvio fica abaixo de 0,6 (abaixo de 2 não se percebe). O motor atual do Revela amarela os claros (b* chega a +6).
- **As luzes dobram suave para o branco** (+3 paradas → L* 91; +5 → 98), em vez de cortar como no digital. É a latitude do Portra aparecendo.
- **As sombras se comprimem e ficam abertas** (o preto não vai a zero), como num scan de laboratório.
- A cópia óptica é bem mais contrastada. Isso é fiel ao papel real, mas não é o visual que se procura hoje.

### Cartela de cores

![Cartela](../figuras/motor_cartela.png)

| | Saturação média (relativa ao digital) | Desvio médio de matiz | Pele clara (L*, croma, matiz) | Pele escura (L*, croma, matiz) |
|---|---|---|---|---|
| Original digital | 1,00 | — | 65,7 · 21,7 · 51° | 38,0 · 18,1 · 49° |
| Revela atual (KP 400) | 0,94 | 4,8° | 69,0 · 24,8 · 57° | 38,9 · 19,5 · 49° |
| **Protótipo, exposição normal** | **0,92** | 11,5° | 65,5 · 23,3 · **58°** | 37,6 · **24,2** · 48° |
| Protótipo, +1 parada | 0,89 | 12,2° | 80,1 · 18,2 · **65°** | 52,6 · 29,1 · 52° |
| Protótipo, −1 parada | 0,79 | 12,8° | 49,3 · 23,1 · 53° | 26,0 · 17,2 · 44° |

**O que bate com o comportamento conhecido do Portra (dossiê, seção 6):**
- **Pele mais dourada** (matiz 51° → 58°), como se descreve nos scans de Frontier.
- **Pele escura mais quente e cheia** (croma 18 → 24), coerente com o relato de que o Portra pode deixar pele escura "laranja demais".
- **Superexposto:** mais claro, mais pastel e mais amarelado nas luzes (matiz da pele 65° a +1 e 71° a +2), como no teste da Dehancer.
- **Subexposto:** cor mais fraca e mais densa.

Nada disso foi ajustado à mão para dar esse resultado. Sai das curvas da ficha.

## O que ainda não está certo

1. **Separação dos corantes (o ponto mais frágil).** Testei três separações que encaixam na ficha quase igualmente bem (diferença de erro abaixo de 0,002). Elas mudam o matiz do magenta em até **40°**: a rosa pink da foto vai do magenta ao vermelho conforme a escolha. **Só fotos de referência reais decidem qual é a certa.** É a prova concreta de que o rolo de referência é indispensável.
2. **Ciano e azul-esverdeado** desviam ~30° para o azul. Pode ser real ou efeito dos sensores do scanner, que são estimados. Precisa de referência.
3. **Força do DIR** escolhida pela saturação média, não medida.
4. **Branco da foto digital:** o branco puro do digital equivale a +2,5 paradas e sai L* ~86, um "branco de filme", levemente acinzentado. No app, o controle de exposição resolve isso.
5. **Cálculo em 8 bits na entrada:** luzes que o celular já estourou não voltam.

## Como testar no celular

Os arquivos `.cube` em [`saida/`](saida/) já funcionam no Revela atual. Conferi que o leitor de LUT do app os aceita (33×33×33).

1. Baixe `saida/portra400_prototipo.cube` (exposição normal) ou `portra400_prototipo_mais1.cube` (+1 parada).
2. No Revela: botão de LUT no topo, ou aba **Filme › Minhas › Importar LUT**.
3. Para uma comparação justa, use a intensidade do filme em 100 e sem outros ajustes.

O grão, a halação e a nitidez por canal ainda não entram: a LUT é só a cor.

## Como reproduzir

```sh
pip install numpy scipy matplotlib pillow
node pesquisa/motor/lut_atual.mjs                       # LUT do motor atual, para comparar
python3 pesquisa/motor/prototipo.py <foto-de-teste.jpg>  # figuras, relatório e LUTs
```

## Próximos passos

1. **Rolo de referência** (dossiê, seção 9): decide os corantes, o DIR e o scanner.
2. Usar os **corantes separados publicados pela Fuji** (Velvia, Provia) como ponto de partida mais realista para a forma dos corantes.
3. Grão, nitidez por canal e halação, a partir dos números da ficha (MTF e Print Grain Index).
4. Aplicar o mesmo método ao segundo filme (sugestão: Gold 200, um negativo de consumo com caráter bem diferente do Portra).
5. Levar o motor ao app: LUT 65×65×65 por filme e variações de exposição (−1, +1, +2) como "receitas" do filme.
