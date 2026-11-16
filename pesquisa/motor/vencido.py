"""Filme vencido: o que a Kodak descreve, aplicado ao motor espectral (protótipo de estudo, ainda fora do app).

Fontes (pesquisa/vencido.md):
- Kodak Alaris CIS-2017-1 (2019): "speed, contrast, color balance, and fog level change gradually after manufacture.
  Adverse storage conditions accelerate these changes. Color materials are more seriously affected than black-and-white
  materials because adverse conditions usually affect the emulsion layers to different degrees."
- Kodak TIB 5202 (2002): a radiação gama natural "increases the D-min and toe densities and also increases grain";
  geladeira NÃO reduz esse efeito; filmes mais rápidos sofrem mais (EI 500 ≈ 3× EI 125, Kodak Storage Information).

Dois mecanismos, separados como na física:
1. RADIAÇÃO (não depende da temperatura): uma exposição extra igual em todas as camadas (um "pré-flash" lento ao longo
   dos anos). Sobe a base e o pé da curva, apaga o detalhe das sombras e tira contraste delas. Cresce com os anos e com
   a sensibilidade do filme (expoente 0,79, de 3× para 4× de ISO).
2. QUÍMICA (depende do calor): cada camada perde sensibilidade e contraste em ritmo próprio. A Kodak diz que as
   camadas mudam "em graus diferentes", mas não diz em que direção: varia de filme para filme. Aqui a direção vem de
   uma semente (cada rolo vencido é diferente), e o tamanho, dos anos e do armazenamento.
Magnitudes # APROX: a Kodak não publica taxas. A regra prática dos fotógrafos é "1 parada por década" em temperatura
ambiente; os números abaixo seguem essa ordem de grandeza até haver negativos vencidos medidos.
"""
import numpy as np

# fator do envelhecimento químico por armazenamento (temperatura ambiente = 1)
ARMAZENAMENTO = {'freezer': 0.05, 'geladeira': 0.25, 'ambiente': 1.0, 'calor': 3.0}


def parametros(anos, iso=400, armazenamento='ambiente', semente=0):
    rng = np.random.default_rng(semente)
    # radiação: exposição de véu (luz linear relativa ao cinza médio 0,18) — 10 anos, ISO 400 ≈ 5 paradas abaixo do cinza
    veu = 0.18 * 2.0 ** -5 * (anos / 10) * (iso / 400) ** 0.79
    k = ARMAZENAMENTO[armazenamento] * anos / 10
    desvio = rng.normal(0, 0.5, 3)                     # cada camada envelhece num ritmo (R, G, B)
    perda = np.clip(0.35 * k * (1 + desvio), 0, None)  # paradas de sensibilidade perdidas por camada
    contraste = np.clip(1 - 0.08 * k * (1 + desvio), 0.5, 1)   # fração do contraste que sobra por camada
    return {'veu': veu, 'perda': perda, 'contraste': contraste}


def aplica(motor, p):
    """Envelhece o filme do motor (o laboratório continua calibrado para o filme NOVO, como na vida real)."""
    if not hasattr(motor, 'inv'):
        motor._prepara_scanner()
    exp0, neg0 = motor.exposicao, motor.negativo
    ref = motor.f.ref

    def exposicao(rgb_lin, paradas=0.0):
        L = exp0(rgb_lin, paradas)
        H = 10 ** (L - ref) * 0.18 + p['veu']          # véu soma luz em todas as camadas
        return ref + np.log10(H / 0.18) - p['perda'] * np.log10(2)

    def negativo(L, dir_=0.0):
        # contraste menor por camada: a curva gira em torno do cinza médio
        return neg0(ref + (L - ref) * p['contraste'], dir_)
    motor.exposicao, motor.negativo = exposicao, negativo
    return motor
