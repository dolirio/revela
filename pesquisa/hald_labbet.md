# Labbet × RNI × Revela (16/11/2026)

Oito filmes exportados do Labbet sobre `hald_identidade_12.png` (1728 × 1728, sRGB, sem grão), na ordem informada pelo usuário: Fuji 400H, 400S, 800S, Portra 160, 400, 800, Kodak E200 e Gold 200. O Labbet não grava o nome do filme no arquivo, então os nomes vêm da ordem de envio, conferida pelo conteúdo de cada arquivo. Medição com `ferramentas/analisar_hald.py`; números completos em `hald_labbet_rni_revela.json`. **Estudo e comparação apenas**: nada daqui vai para o Revela.

## Filmes em comum
| Filme | App | Cinza (L\*) | +2 paradas | Saturação | Pele | Céu | Folhagem |
|---|---|---|---|---|---|---|---|
| Portra 160 | Labbet | 57,0 | 89,6 | 0,98 | −7° | −3° | +5° |
| | RNI | 56,7 | 91,6 | 1,06 | +6° | −9° | +19° |
| | Revela | 50,7 | 81,8 | 0,74 | −8° | −18° | −2° |
| Portra 400 | Labbet | 60,2 | 89,7 | 0,98 | +3° | +1° | +7° |
| | RNI | 64,2 | 89,5 | 0,87 | −21° | +5° | +9° |
| | Revela | 50,7 | 82,3 | 0,90 | −6° | −8° | +2° |
| Gold 200 | Labbet | 66,4 | 95,1 | 1,17 | +11° | +3° | +4° |
| | RNI | 63,8 | 96,1 | 0,96 | +10° | −25° | −8° |
| | Revela | 50,7 | 82,1 | 0,99 | −2° | −8° | +1° |
| Pro 400H | Labbet | 61,0 | 91,2 | 1,07 | +4° | +18° | −4° |
| | RNI | 54,3 | 86,6 | 0,88 | +11° | −12° | +18° |

## Onde os dois apps concordam (e o Revela fica de fora)
1. **Foto mais clara.** O cinza médio sai entre 57 e 66 nos dois apps, contra 50,7 no Revela. As câmeras dão 48 (Ricoh) a 57 (Fuji Provia).
2. **Luzes altas mais brilhantes.** Duas paradas acima do cinza, os apps dão 87–96 e as câmeras 89–95 (Provia 90,7). O Revela dá 79–83. **O ombro da curva do laboratório do Revela está macio demais:** as luzes altas saem acinzentadas. É o achado mais firme desta rodada, porque cinco fontes concordam.
3. **Pele do Gold dourada** (+10° a +11°) nos dois apps.

## Onde discordam (estilo de cada app)
- **Saturação:** Labbet 0,98–1,17, RNI 0,77–1,06.
- **Folhagem para o ciano:** forte no RNI (+18° a +26°); fraca no Labbet, exceto no Portra 800 (+17°) e no 400S (+10°).
- **Pro 400H:** o Labbet leva o céu para o azul-arroxeado (+18°) e a folhagem para o amarelo (−4°); o RNI faz o contrário.
- **Pele do Portra 400:** −21° no RNI, +3° no Labbet.

## Para o Revela
- **Curva do laboratório:** subir as luzes altas (+2 paradas ≈ 89–91) e decidir o cinza médio (hoje 50,7; referências de 54 a 64). Isso é decisão de produto; ver a resposta ao usuário.
- **Cor:** não há consenso entre os apps além do que já está no motor e na opção de Laboratório.
