# Espectros naturais e correção só dos corantes (16/11/2026)

**Pergunta:** por que o motor não levava a folhagem para o ciano, se cinco fontes independentes fazem isso (Ricoh, Fuji, RNI e as duas sessões de câmera)? E por que os filmes do Revela saíam 20 a 30 % mais saturados que as referências?

## O que foi testado
Ferramenta: espectros **medidos** de objetos reais, em vez de espectros inventados a partir do RGB.
- **Treino:** 190 refletâncias do conjunto da AMPAS (rawtoaces), em `dados/refletancias_reais.json`.
- **Teste:** o ColorChecker medido (média BabelColor), que fica fora do treino.

1. **A hipótese da borda vermelha (>690 nm) caiu.** A camada vermelha do Portra praticamente não enxerga acima de ~680 nm. O que pesa é o **vale da clorofila em 650–680 nm**, justamente onde essa camada é mais sensível. A base suave antiga punha refletância lisa ali. Uma folha real tem um vale, e o filme a vê mais ciano.
2. **O culpado maior era a correção do laboratório.** Ela era treinada para devolver a **cor da cena**. Com isso, desfazia não só a mistura dos corantes (o que o laboratório faz de verdade), mas também **o jeito de o filme enxergar cor**, que é a sensibilidade espectral de cada camada, ou seja, o caráter do filme. Era o que apagava a folhagem ciano e deixava tudo saturado demais.

## O que mudou no motor (`motor/motor.py`)
- **`EspectroNatural`:** cada cor RGB vira um espectro com a forma típica de objetos reais daquela cor. A cor vista continua **exata**; muda só a forma do espectro. Isso vale nas cores do dia a dia. Nas cores muito saturadas (poucos dados) volta suavemente à base antiga, para a tabela não ficar áspera.
- **`_calibra_lab`:** o alvo agora é a **exposição de cada camada do filme**. O laboratório desfaz só a mistura dos corantes, com força 1 em todos os filmes. Antes era 0,7 ou 0,9, um meio-termo para compensar o problema.

## Resultado (cartela, filmes do app, `ferramentas/analisar_hald.py`)
| | Antes | Agora | RNI (referência) |
|---|---|---|---|
| Saturação × entrada | 1,02–1,29 | **0,74–1,09** | 0,77–1,06 |
| Céu (matiz) | −6° a +3° | **−18° a +1°** (para o ciano) | −32° a +5° |
| Folhagem (matiz) | 0 a +3° | +1° a +5° (+5° a +9° com folha real medida) | +18° a +26° (exceto Gold/Ultramax) |
| Pele clara (matiz) | −1° a −8° | −2° a −8° | −21° a +11° (sem consenso) |

Contraste, cinza médio e brilho não mudam: as correções têm soma zero no neutro. A aspereza da tabela (2ª diferença máxima) ficou em 0,035–0,068, contra 0,02–0,035 antes. Não há saltos visíveis.

## O que fica em aberto
- A física explica a **direção** do verde ciano, mas não o tamanho: +5° contra +20° nas referências. O resto é escolha de escaneamento ("look" de Frontier/Noritsu), assim como a pele dourada. Isso vai para a **opção de Laboratório**, não para o filme.
- O KP 160 ficou com saturação 0,74, mais baixa que a do RNI (1,06). Conferir com fotos reais antes de mexer.
