# RNI Films × Revela: medição pela imagem Hald (16/11/2026)

Exportações do RNI Films (iPhone, Display P3 convertido para sRGB), grão e "Analog Feel" em 0, intensidade máxima. O nome do filme vem gravado nos metadados de cada arquivo ("Profile 'Kodak Portra 400'"). Ferramenta: [`ferramentas/analisar_hald.py`](ferramentas/analisar_hald.py); números completos em [`hald_rni_vs_revela.json`](hald_rni_vs_revela.json). Uso: **estudo e comparação**; nada do RNI entra no Revela.

Mesma cartela (ColorChecker de projeto, cinza médio = 0,18 linear) nos dois. Deslocamentos em relação à cor de entrada.

| Filme | | Cinza (L\*) | L\* a −2 | Contraste | Cor do cinza (a\*/b\*) | Saturação | Pele clara | Céu | Folhagem |
|---|---|---|---|---|---|---|---|---|---|
| Ektar 100 | RNI | 47,9 | 17,9 | 38,0 | −1,8 / −5,0 | 0,87 | −8° | −18° | **+26°** |
| | Revela | 50,7 | 22,8 | 34,3 | neutro | 1,29 | −8° | −14° | +3° |
| Portra 160 | RNI | 56,7 | 25,8 | 37,3 | +0,4 / −2,2 | 1,06 | +6° | −9° | **+19°** |
| | Revela | 50,7 | 25,0 | 31,1 | neutro | 1,04 | −1° | −6° | +1° |
| Portra 400 | RNI | 64,2 | 30,0 | 29,5 | +3,7 / **−7,5** | 0,87 | **−21°** | +5° | +9° |
| | Revela | 50,7 | 24,4 | 32,1 | neutro | 1,18 | −1° | −4° | +2° |
| Gold 200 | RNI | 63,8 | 32,0 | 33,9 | −2,9 / +1,3 | 0,96 | **+10°** | −25° | −8° |
| | Revela | 50,7 | 24,4 | 32,1 | neutro | 1,17 | +3° | −8° | −2° |
| Ultramax 400 | RNI | 68,4 | **40,7** | **24,2** | +1,1 / +2,2 | 0,79 | +4° | −32° | −15° |
| | Revela | 50,7 | 25,3 | 30,3 | neutro | 1,22 | −1° | −1° | 0° |
| Pro 400H (Fuji) | RNI | 54,3 | 24,9 | 36,4 | −0,3 / +1,1 | 0,88 | +11° | −12° | +18° |
| Superia 400 (Fuji) | RNI | 56,1 | 22,0 | **41,3** | +0,8 / −0,1 | 0,77 | +1° | −7° | +18° |

**Tri-X (RNI):** mistura de canais estimada R 0,31 · G 0,49 · B 0,21. Pesa **mais o vermelho** que a luminância comum (0,21): a pele sai mais clara. O oposto da receita Lindbergh (Acros + filtro G: R 0,10), que escurece a pele de propósito.

## O que o RNI faz diferente do Revela
1. **Saturação menor.** Quase todos os filmes do RNI ficam **abaixo** da cor de entrada (0,77–1,06); os do Revela ficam acima (1,02–1,29). O Ektar é o caso extremo: 0,87 no RNI contra 1,29 no Revela. As câmeras apontam para o mesmo lado (Ricoh Negative Film 0,87 sobre o RAW).
2. **Cada filme tem o seu brilho.** O cinza médio do RNI vai de 48 (Ektar) a 68 (Ultramax). No Revela todos ficam em 50,7. O RNI embute um "jeito de expor" por filme: Portra 400, Gold e Ultramax claros e arejados; Ektar mais denso.
3. **Pretos mais abertos.** A −2 paradas o RNI fica em 18–41 de L\*; o Revela, em 23–25. O Ultramax do RNI é quase "lavado" (preto em 41, contraste 24).
4. **O cinza tem cor.** O RNI deixa um tom em cada filme: Portra 400 lilás-azulado, Ektar frio, Gold e Ultramax levemente quentes. O Revela neutraliza tudo (equilíbrio automático do laboratório ligado).
5. **Verde para o ciano: agora são três fontes.** Ektar +26°, Portra 160 +19°, Pro 400H +18°, Superia +18° no RNI, e +20° na Ricoh e na Fuji. **Não é só traço da Fuji**: o RNI faz isso também nos Kodak. Gold e Ultramax vão para o lado amarelo (−8°, −15°). O Revela não mexe no verde (0° a +3°).
6. **Pele: não há consenso no Portra 400.** O RNI puxa a pele do Portra 400 para o **rosado (−21°)**, com o cinza lilás (parece imitar um scan mais frio, tipo Noritsu). Portra 160, Gold e Pro 400H vão para o âmbar (+6° a +11°). A pele do Ektar coincide exatamente com a do Revela (−8°).

## O que isso muda no plano
- **Folhagem → ciano** passa a ser o achado mais forte (cinco fontes independentes). O motor não produz isso nem sem correção do laboratório. Hipótese a conferir: o espectro de refletância da folhagem no motor não tem a subida forte depois de 690 nm (a "borda vermelha" das plantas), que a camada vermelha do filme ainda enxerga.
- **Saturação do Revela provavelmente alta demais** (20–30 % acima das referências). Conferir depois da folhagem, porque as duas coisas mexem na cor.
- **Brilho e preto por filme** e **tom do cinza** são escolhas de "laboratório". Candidatos a uma opção de laboratório no Revela (ex.: "Frontier", "Noritsu", "neutro"), em vez de ficarem presos no filme.

## Teste do "Analog Feel" (Portra 400)
Três exportações do mesmo filme com o Analog Feel em níveis diferentes, comparadas com a exportação normal do Portra 400:

| Exportação | Diferença da normal | Desfoque (em luz linear) | Exposição | Textura fina restante |
|---|---|---|---|---|
| quantidade 0 | **idêntica, bit a bit** | — | — | — |
| intermediária (provavelmente quantidade 100 com escala menor) | grande | σ ≈ 2,5 px | +10 % (~+⅛ parada) | 40 % da original |
| quantidade 100, escala 100 | grande | σ ≈ 3,5 px | +10 % | 25 % da original |

Os prints do app confirmam: com **quantidade 0** a prévia é a mesma em qualquer escala (0, 50, 100). A **quantidade** liga o efeito; a **escala** muda o tamanho do desfoque/halo.

**Leitura:** o Analog Feel **não mexe na cor**. Ele é um efeito **espacial**: amacia a imagem (como a nitidez limitada do filme e da lente), clareia um pouco e deixa um resíduo leve para o verde, provavelmente de brilho/halo em volta das áreas claras. Por isso, exportações com Analog Feel **não servem como mapa de cor** (o desfoque mistura cores vizinhas do Hald). Para o Revela, confirma a separação certa: **cor = tabela de cor do filme; maciez/halo = camada à parte**, com controle próprio, como o grão.
