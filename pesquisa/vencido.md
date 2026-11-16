# Filme vencido: o que a Kodak diz e como entra no motor (16/11/2026)

## Fontes (lidas na íntegra)
- **Kodak Alaris CIS-2017-1**, *Storage and Care of KODAK Photographic Materials* (revisão 10/2019).
- **Kodak TIB 5202**, *Storage and Handling of Unprocessed Film* (maio 2002).
- **Kodak, *Storage Information*** (página de cinema), para a relação com a sensibilidade.

Os dois documentos foram citados pelo app Flashget no filme "C200 expired". Conferi: a citação é correta.

## O que dizem (trechos)
- "speed, contrast, color balance, and fog level change gradually after manufacture. Adverse storage conditions accelerate these changes." (CIS-2017-1)
- "Color materials are more seriously affected than black-and-white materials because adverse conditions usually **affect the emulsion layers to different degrees**." (CIS-2017-1)
- "refrigeration **cannot** reduce the effects of ambient gamma radiation. Naturally occurring gamma radiation increases the **D-min and toe densities** and also increases **grain**. Higher speed films are affected more" (TIB 5202)
- "A film with an Exposure Index (EI) of 500 can exhibit about **three times** the change in performance as a film with an EI of 125." (Storage Information)
- Guarda recomendada: 13 °C ou menos até 6 meses; −18 °C para mais tempo; umidade abaixo de 50–60 %. Filmes de consumo aguentam até 21 °C.

## O que NÃO dizem
- **Taxas** (quantas paradas por ano), **em que direção** cada camada muda e qual camada muda primeiro. A direção varia de filme para filme. A regra prática dos fotógrafos é "1 parada a mais por década vencida", sem medição publicada.

## Como entrou no motor (`motor/vencido.py`, protótipo, ainda fora do app)
Dois mecanismos, como na física:
1. **Radiação** (a geladeira não ajuda): uma exposição extra igual nas três camadas, como um pré-flash lento. Sobe a base e o pé da curva, apaga o detalhe das sombras e aumenta o grão. Cresce com os anos e com a sensibilidade (expoente 0,79, tirado do "3× para 4× de ISO").
2. **Química** (depende do calor: freezer 0,05 · geladeira 0,25 · ambiente 1 · calor 3): cada camada perde sensibilidade e contraste **no seu próprio ritmo**. A direção vem de uma semente, porque cada rolo vencido é diferente ("unpredictable").

O laboratório continua calibrado para o filme **novo**, como acontece de verdade.

## Teste (Gold 200, cartela, equilíbrio automático ligado)
| Caso | L\* −4 / −2 / 0 / +2 | Saturação |
|---|---|---|
| Novo | 14,4 / 24,3 / 50,7 / 82,1 | 0,99 |
| 10 anos na geladeira | 15,2 / 24,7 / 49,6 / 80,5 | 0,96 |
| 10 anos em temperatura ambiente | 15,1 / 23,6 / 45,5 / 75,2 | 0,85–0,90 |
| 20 anos em temperatura ambiente | 16,0 / 23,3 / 41,6 / 68,3 | 0,73–0,82 |
| 10 anos no calor | 15,7 / 22,4 / 38,4 / 62,0 | 0,63–0,75 |

As direções batem com a Kodak: base mais alta, sombras achatadas, foto mais escura (perde sensibilidade), menos contraste e menos cor. Também aparece uma dominante nas sombras que muda de rolo para rolo. **Os tamanhos são estimativas.**

## Para calibrar de verdade
Precisamos de **negativos feitos com filme vencido de idade conhecida**, de preferência com uma cartela, ou ao menos uma foto de cena conhecida escaneada sem correção. Cópias antigas não servem para isso: elas misturam o envelhecimento da cópia com o do filme.

O grão maior pelo véu (TIB 5202) ainda não está ligado ao grão do app.
