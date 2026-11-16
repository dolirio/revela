# Laboratórios: o que a máquina do laboratório faz com o negativo (16/11/2026)

**Pergunta:** o que falta no motor (verde mais ciano, pele dourada, sombras frias) vem do filme ou do laboratório? E, no laboratório, vem da química, da óptica ou do scanner?

## 1. O que NÃO explica (testado no motor, cartela com espectros medidos)
| Hipótese | Resultado |
|---|---|
| **Cores da luz do scanner** (vermelho 630–690 nm, verde 520–555, azul 455–470) | Muda o matiz só 1° a 3°: a calibração do laboratório para cada filme absorve a diferença. |
| **Faixas largas** (sensor com filtros em vez de LED) | Só tira cor (saturação 0,56–0,74) e leva o verde para o **amarelo**, o contrário das referências. |
| **Cópia óptica em papel RA-4** (Endura) | Céu bem mais ciano (−22° a −40°), mas a folhagem vai para o **amarelo** (−13° a −24°) e a pele do Portra para o rosado. Não é o "visual de scan". |

## 2. O que explica: o ajuste de contraste por canal do scanner
Dados: pares do **mesmo negativo** escaneado no Fuji Frontier SP-3000 e no Noritsu HS-1800, "direto do scanner, sem edição" (JB Flanc, *The Art of Film Scanning: Frontier vs. Noritsu*, 2025, digitalizados na Carmencita Film Lab): 2 cenas em Kodak Gold 200 e 2 em Ektachrome revelado em C-41. As metades foram alinhadas (correlação de detalhe 0,86–0,98) e comparadas pixel a pixel, em luz linear.

Inclinação de cada canal do Frontier em relação ao Noritsu (log da luz):

| Par | Vermelho ÷ verde | Azul ÷ verde |
|---|---|---|
| Gold 200 A | **+25 %** | −5 % |
| Gold 200 B | **+25 %** | −16 % |
| Ektachrome C-41 A | **+28 %** | +5 % |
| Ektachrome C-41 B | **+42 %** | −10 % |

O resultado se repete nos quatro pares: **o Frontier estica o canal vermelho cerca de 25 % mais** e o azul um pouco menos. Os scanners usam ajustes de fábrica por tipo de filme. Quando o contraste de um canal não casa com o do filme, o cinza só fica neutro no meio-tom:
- **sombras** com menos vermelho → **ciano-azuladas** ("cyan and blue shadows", Carmencita);
- **verde** (pouco vermelho) → **mais ciano** ("colder greens");
- **luzes altas** com mais vermelho → **douradas**: um rosto bem exposto fica ali ("skin tones more golden").

Os pares também mostram o Frontier mais frio no geral (b\* menor em quase todos os tons). O brilho e o croma médios mudam de um par para outro (o operador decide a densidade de cada foto), então não foram usados.

## 3. No Revela (`motor/motor.py`, `LABS`)
- **Neutro:** a inversão ideal. Cada canal pela inclinação do próprio filme; o cinza fica cinza em qualquer luz.
- **Frontier:** canais × (1,25 · 1,1; 1,0 · 1,1; 0,92 · 1,1), ou seja, a diferença medida mais um pouco de contraste.
- O app recebe uma tabela por laboratório (`novo/filmes/<id>.frontier.bin`) e mostra a escolha em **Ajustes › No laboratório**.

Medição (cartela, `ferramentas/analisar_hald.py`):

| | Neutro | Frontier |
|---|---|---|
| Folhagem | +1° a +5° | **+8° a +11°** (ciano) |
| Céu | −18° a +1° | −25° a −4° |
| Sombra (a\*/b\* do cinza a −2 paradas) | ≈ 0 | **−2/−4** (ciano-azulado) |
| Contraste nos médios | 28,6–34,2 | 32,6–38,8 |
| Pele clara (exposição normal) | −2° a −8° | −6° a −12° (mais rosada) |

## Limites (honestos)
- Só se mediu a **diferença** Frontier − Noritsu, não cada máquina em relação ao "real". O Neutro do Revela não é o Noritsu.
- A pele **na exposição normal** fica mais rosada no Frontier, e não dourada. O dourado aparece nas luzes altas, isto é, com rosto bem iluminado ou filme superexposto, que é a prática comum com Portra. Conferir com fotos reais.
- São 4 pares de um único fotógrafo. Mais pares (outras cenas, Portra) melhorariam os números.
- Um laboratório "Noritsu" fica para quando houver referência absoluta, por exemplo uma cartela fotografada em filme e escaneada nas duas máquinas.
