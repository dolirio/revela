# Preto e branco, cromo e vencidos no app novo (16/11/2026)

## Preto e branco: Kodak Tri-X 400 (`KX 400`)
- **Fonte:** ficha Kodak F-4017 (dez. 2016), lida dos vetores do PDF: sensibilidade espectral (D = 1,0 acima do véu) e curvas características em D-76 (6, 8, 10 e 12 min). Arquivo: `dados/trix400.json`. Revelação usada: **D-76, 8 min** (gama médio 0,62).
- **Motor** (`MotorPB`): espectro natural da cena × sensibilidade do Tri-X → uma camada de prata → curva da ficha → escaneamento com a mesma inversão e curva de laboratório dos coloridos.
- **O que a ficha mostra:** o Tri-X é muito sensível ao azul e **quase não vê acima de 650 nm** (a sensibilidade cai mais de 100× entre 600 e 660 nm). Por isso, sem filtro, céu claro e vermelho e pele mais escuros que numa conversão digital (mistura efetiva R 0,14 · G 0,30 · B 0,56).
- **Filtros na lente** (escolha "Filtro na lente", só nos filmes P&B): amarelo, laranja, vermelho e verde, com exposição compensada.

| Filtro | Fator (motor) | Fator (ficha Kodak) | Mistura efetiva R · G · B |
|---|---|---|---|
| Amarelo (nº 8) | 2,1 | 2 | 0,26 · 0,61 · 0,13 |
| Laranja (nº 21) | 4,0 | — | 0,53 · 0,47 · 0 |
| Vermelho (nº 25) | 8,7 | 8 | 0,83 · 0,14 · 0,03 |
| Verde (nº 11) | 4,0 | 4 | 0,14 · 0,67 · 0,19 |

Com o filtro verde, a mistura bate com a medida na receita Lindbergh do usuário (Fuji Acros + filtro G: 0,10 · 0,69 · 0,21).

## Cromo: Kodak Ektachrome E100 (`KA 100`)
- **Fonte:** ficha E-4000, já digitalizada em `dados/ektachrome_e100.json` (corantes separados).
- **Motor** (`MotorCromo`): mais luz = menos corante; o slide é a imagem final, vista numa mesa de luz do dia. Não há inversão nem papel. O scanner só fixa o cinza médio e faz a calibração de cinza (como com um alvo IT8).
- **Medição (cartela):** contraste nos médios 38; sombras profundas (−2 paradas: L\* 16); luzes que encostam cedo no branco (+2: 80, +3: 85); saturação 1,07; pele +16° (para o âmbar). A pele é o ponto a conferir (Labbet E200: +12°).
- # APROX: filtros Status A como gaussianas e mistura linear dos corantes. Sem a calibração de cinza, o eixo neutro saía rosado nas luzes (a\* +2) e verde nas sombras (−3).

## Vencidos (`KG 200 · 10 anos`, `KU 400 · 20 anos`, `KP 400 · calor`)
O protótipo de `vencido.md` foi aplicado a três filmes, com o laboratório calibrado para o filme **novo** (como na vida real). O grão é maior. Os tamanhos continuam estimativas até haver negativos vencidos medidos.

## Conferência no app
Teste no navegador (Chromium) com retrato do iPhone: troca de categoria, filtros e laboratório sem erros; o filtro só aparece nos P&B, e o laboratório só nos coloridos.
