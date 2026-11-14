# Como fotografar as referências (Fujifilm, Ricoh e celular)

**Objetivo:** medir, com números, o que cada simulação de filme da Fuji e da Ricoh faz com as cores, e usar isso como referência de apoio para o motor de filmes do Revela.

**A ideia central:** fotografar em **RAW**, que é o arquivo "cru" e neutro, e depois usar o **conversor RAW da própria câmera** para gerar um JPEG de cada simulação **a partir da mesma foto**. Assim todas as simulações têm exatamente a mesma luz e a mesma exposição, e a única diferença entre elas é a simulação. É assim que dá para medir.

---

## 1. Preparar a cartela

1. Imprima **`cartela_revela_A4.pdf`** em tamanho A4, de preferência num laboratório de fotos, em **papel fotográfico fosco**. O papel brilhante reflete luz e atrapalha.
2. Peça ao laboratório **para não fazer correção automática de cor**. Em casa, imprima em papel fotográfico fosco, com a impressora em "sem ajuste de cor" ou "cores do aplicativo".
3. Não precisa ficar perfeita. O que vou medir é a **diferença** entre o RAW e cada simulação, sobre a mesma foto da mesma cartela.
4. **Não use a cartela na tela** de um computador ou celular. A tela emite luz em cores muito puras, que não se comportam como objetos reais, e isso enganaria a medição.

## 2. Montar a cena (vale para as duas câmeras)

| Item | Como fazer |
|---|---|
| Luz | **Luz do dia**, de uma destas formas: (a) ao ar livre, na sombra aberta ou em dia nublado; ou (b) **dentro de casa, perto de uma janela grande**, com as lâmpadas **apagadas** e a cartela virada para a janela (você de costas para ela). Entre 2 horas depois do nascer do sol e 2 horas antes do pôr. **Sem sol batendo direto** na cartela. **Não use as lâmpadas da casa** para a cartela (ver nota abaixo) |
| Cartela | Presa numa parede ou num papelão, bem plana, **de frente para a câmera** (sem inclinação). Sem sombra sua ou de outros objetos sobre ela |
| Enquadramento | A cartela ocupando **mais ou menos metade do quadro, no centro**. Os 4 quadradinhos dos cantos precisam aparecer |
| Foco | Na cartela. Tripé ajuda, mas não é obrigatório |
| ISO | O mais baixo **nativo** (Fuji: 125 ou 160 conforme o modelo; Ricoh: 100) |
| Abertura | f/5.6 ou f/8 |
| Balanço de branco | **Fixo em "Luz do dia" (Daylight)**, nunca automático |
| Formato | **RAW + JPEG** (Fuji: RAW sem compressão ou com compressão sem perda; Ricoh: DNG) |

> **Por que não as lâmpadas da casa?** As lâmpadas comuns, de LED ou fluorescentes, têm "buracos" no espectro: faltam algumas cores na luz. Além disso, costumam ser fracas (obrigam a subir o ISO, o que gera ruído) e, muitas vezes, misturam tipos de lâmpada. As fichas dos filmes e as simulações são feitas para luz do dia. A luz da casa só entra de propósito, na cena 5 ("interior com lâmpada amarela").

### A série de exposições

Com a **abertura fixa**, faça 6 fotos variando a **compensação de exposição**:

**−2, −1, 0, +1, +2, +3**

Ou seja, o 0 mais uma série mais escura e uma mais clara. É isso que mostra como cada simulação trata a superexposição e a subexposição, uma das marcas mais fortes de cada filme.

---

## 3. Fujifilm

### 3.1 Ajustes antes de fotografar

Ponha tudo no **neutro**:

| Ajuste | Valor |
|---|---|
| Faixa dinâmica (DR) | **DR100** |
| Prioridade de faixa dinâmica (D-Range Priority) | Desligada |
| Tons: luzes / sombras | 0 / 0 |
| Cor | 0 |
| Nitidez | 0 |
| Redução de ruído (High ISO NR) | **−4** (o mínimo) |
| Clareza (Clarity) | 0 |
| Efeito de grão | Desligado |
| Color Chrome Effect / FX Blue | Desligados |
| Pele suave | Desligada |
| Espaço de cor | sRGB |

### 3.2 Gerar as simulações no conversor RAW da câmera

**Menu de reprodução › Conversão RAW (RAW CONVERSION)**

1. Escolha a foto **0** da série.
2. Em **Simulação de filme**, escolha uma simulação, confira se os outros ajustes continuam neutros (como em 3.1) e crie o JPEG.
3. Repita para **cada simulação que a sua câmera tiver**:

| Prioridade | Simulação | Por que importa |
|---|---|---|
| ⭐ | **Classic Neg.** | A Fuji descreve como negativo de consumo, no estilo do Superia |
| ⭐ | **Pro Neg. Std** e **Pro Neg. Hi** | Negativo profissional de retrato (família Pro 160) |
| ⭐ | **Nostalgic Neg.** | Negativo com aparência de cópia antiga |
| ⭐ | **Reala Ace** | Inspirado no Superia Reala |
| ⭐ | **Velvia**, **Provia**, **Astia** | Os cromos da própria Fuji |
| ⭐ | **Acros** (sem filtro) | P&B da Fuji |
| | Classic Chrome | A Fuji diz que não imita um filme específico; útil como comparação |
| | Eterna e Eterna Bleach Bypass | Filme de cinema |
| | Monocromático e Sépia | Referência de P&B simples |

4. Para as fotos **−2, −1, +1, +2, +3**, converta **só as simulações principais**: Classic Neg., Pro Neg. Std, Nostalgic Neg. e Velvia (se tiver).

Na prática, isso dá uns 12 JPEGs da foto 0 e uns 20 da série. O conversor deixa repetir a mesma foto quantas vezes você quiser.

> **Atalho pelo computador:** o **FUJIFILM X RAW STUDIO** (gratuito, Windows e Mac) faz a mesma conversão usando o processador da própria câmera, ligada ao computador por cabo USB. O resultado é idêntico ao da câmera e dá para converter várias fotos de uma vez. Confira no site da Fujifilm se o seu modelo é compatível. Use os mesmos ajustes neutros do item 3.1, mudando só a simulação.

---

## 4. Ricoh GR

### 4.1 Ajustes antes de fotografar

| Ajuste | Valor |
|---|---|
| Image Control | **Standard** (padrão) para fotografar |
| Correção de sombras (Shadow Correction) | **Desligada** |
| Correção de iluminação periférica | Desligada |
| Redução de ruído de ISO alto | Desligada ou no mínimo |
| Clareza / nitidez | 0 |

### 4.2 Gerar as simulações na revelação RAW da câmera

**Reprodução › menu › Revelação RAW (RAW Development)**

1. Escolha a foto **0**.
2. Em **Image Control**, escolha um efeito **com os parâmetros dele no padrão** e salve o JPEG.
3. Repita para:

| Prioridade | Image Control |
|---|---|
| ⭐ | **Negative Film** (se o seu firmware tiver) |
| ⭐ | **Positive Film** |
| ⭐ | **Standard** (a referência neutra da Ricoh) |
| | Retro, Bleach Bypass, Cross Processing |
| | Monotone, Hard Monotone, Soft Monotone, Hi-Contrast B&W |

4. Para a série **−2 a +3**, converta só **Negative Film** e **Positive Film**.

> Com o firmware 2.00 ou mais novo, a revelação RAW da GR III/IIIx aceita **várias fotos de uma vez**: escolha o Image Control e aplique na série inteira.

---

## 5. Cenas reais (opcional, mas muito útil)

A cartela mede as cores. Cenas reais mostram como cada simulação trata **pele, céu, folhagem e luzes fortes**. Faça em RAW, exposição 0 e balanço de branco **Luz do dia**:

1. **Retrato** à sombra (pele de perto)
2. **Paisagem** com céu azul e nuvens
3. **Folhagem e flores** (vermelhos, rosas, verdes)
4. **Contraluz** (sol atrás do assunto ou janela clara)
5. **Interior com lâmpada amarela**, sem ajustar o branco (mostra o comportamento com luz quente)

Converta cada uma só com as simulações ⭐ principais.

## 6. O celular

Fotografe a cartela **uma vez** com a câmera normal do celular que você usa com o Revela, sem filtros e na mesma luz. Assim sei como chega ao app a foto que o celular entrega.

---

## 7. Como me enviar

1. Crie no **Google Drive** uma pasta chamada **`Revela - referências`**, com as subpastas `fuji`, `ricoh` e `celular`.
2. Envie **os arquivos originais**: os RAW (`.RAF` da Fuji, `.DNG` da Ricoh) e os JPEGs gerados pelas câmeras. **Não edite e não mande por WhatsApp**, que comprime e apaga os dados.
3. Me diga **os modelos exatos das câmeras** (ex.: X100V, GR IIIx). As simulações mudam de geração para geração.
4. Se puder, escreva num bloco de notas qual foto é qual. Os JPEGs da Fuji e da Ricoh costumam guardar o nome da simulação nos dados do arquivo, mas a anotação evita confusão.

Com acesso à pasta, eu leio os arquivos, localizo a cartela automaticamente pelas marcas dos cantos e meço cada quadro.
