"""Gera as figuras do dossiê a partir de pesquisa/dados/*.json e roda a simulação simples da escala de cinza.

Uso: python3 pesquisa/ferramentas/graficos.py
"""
import json
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, '..', 'dados')
FIG = os.path.join(AQUI, '..', 'figuras')
COR = {'R': '#c8302a', 'G': '#2f8f3a', 'B': '#2856b8'}
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False, 'figure.dpi': 110})


def carrega(n):
    with open(os.path.join(DADOS, n + '.json'), encoding='utf-8') as f:
        return json.load(f)


def arr(v):
    return np.array([np.nan if a is None else a for a in v], dtype=float)


neg, pap = carrega('portra400'), carrega('endura_premier')

# ---------------------------------------------------------------- figura 1: o negativo
fig, ax = plt.subplots(2, 2, figsize=(10, 7.6))
c = neg['caracteristica']; LH = arr(c['logH'])
for k in 'RGB':
    ax[0, 0].plot(LH, arr(c[k]), color=COR[k], lw=2, label=f"{k}  (gama {c['resumo'][k]['gama']:.2f})")
ax[0, 0].axvline(-1.44, color='#999', ls=':', lw=1)
ax[0, 0].text(-1.40, 0.15, 'cinza médio\n(log H −1,44)', color='#777', fontsize=8)
ax[0, 0].set(title='Curvas características', xlabel='log da exposição (lux·s)', ylabel='densidade (Status M)', xlim=(-4, 1), ylim=(0, 4))
ax[0, 0].legend(frameon=False, loc='upper left')

s = neg['sensibilidade']; NM = arr(s['nm'])
for n, k in (('azul (forma amarelo)', 'B'), ('verde (forma magenta)', 'G'), ('vermelho (forma ciano)', 'R')):
    ax[0, 1].plot(NM, arr(s[n]), color=COR[k], lw=2, label=n)
ax[0, 1].set(title='Sensibilidade espectral das camadas', xlabel='comprimento de onda (nm)', ylabel='log sensibilidade', ylim=(0, 3.2))
ax[0, 1].legend(frameon=False, fontsize=8, loc='lower left')

d = neg['densidade_espectral']; NM = arr(d['nm'])
ax[1, 0].plot(NM, arr(d['neutro_meio_tom']), color='#222', lw=2, label='cinza médio')
ax[1, 0].plot(NM, arr(d['dmin']), color='#d08a2c', lw=2, label='base + máscara laranja (Dmin)')
ax[1, 0].plot(NM, arr(d['neutro_meio_tom']) - arr(d['dmin']), color='#777', lw=1.4, ls='--', label='só os corantes (diferença)')
ax[1, 0].set(title='Densidade espectral do negativo', xlabel='comprimento de onda (nm)', ylabel='densidade', ylim=(0, 2.2))
ax[1, 0].legend(frameon=False, fontsize=8)

m = neg['mtf']
for k in 'RGB':
    ax[1, 1].semilogx(m['ciclos_mm'], m[k], color=COR[k], lw=2, marker='o', ms=3, label=k)
ax[1, 1].axhline(100, color='#bbb', lw=0.8)
ax[1, 1].set_xticks(m['ciclos_mm']); ax[1, 1].set_xticklabels([f'{v:g}' for v in m['ciclos_mm']]); ax[1, 1].minorticks_off()
ax[1, 1].set(title='Nitidez (MTF)', xlabel='ciclos por mm', ylabel='resposta (%)', ylim=(0, 125))
ax[1, 1].legend(frameon=False)
fig.suptitle('Kodak Portra 400: dados da ficha técnica E-4050 (2025), extraídos dos vetores do PDF', fontsize=11)
fig.tight_layout(); fig.savefig(os.path.join(FIG, 'portra400_ficha.png')); plt.close(fig)

# ---------------------------------------------------------------- figura 2: o papel
fig, ax = plt.subplots(1, 2, figsize=(10, 3.8))
c = pap['caracteristica']; LH = arr(c['logH'])
for k in 'RGB':
    ax[0].plot(LH, arr(c[k]), color=COR[k], lw=2, label=k)
ax[0].set(title='Endura Premier: curvas características', xlabel='log da exposição (lux·s)', ylabel='densidade (Status A)')
ax[0].legend(frameon=False)
cc = pap['corantes']; NM = arr(cc['nm'])
for n, k in (('amarelo', 'B'), ('magenta', 'G'), ('ciano', 'R')):
    ax[1].plot(NM, arr(cc[n]), color=COR[k], lw=2, label=n)
ax[1].set(title='Endura Premier: corantes', xlabel='comprimento de onda (nm)', ylabel='densidade espectral')
ax[1].legend(frameon=False)
fig.tight_layout(); fig.savefig(os.path.join(FIG, 'endura_premier.png')); plt.close(fig)

# ---------------------------------------------------------------- simulação ingênua: cinza do negativo ao papel
# Supõe (errado de propósito) que a densidade Status M do negativo é o que o papel "vê".
# Filtragem do ampliador fixa, equilibrada para o cinza médio exposto corretamente (densidade 0,75 na cópia).
nLH = arr(neg['caracteristica']['logH']); pLH = arr(pap['caracteristica']['logH'])
N = {k: arr(neg['caracteristica'][k]) for k in 'RGB'}; P = {k: arr(pap['caracteristica'][k]) for k in 'RGB'}
ok = {k: ~np.isnan(P[k]) for k in 'RGB'}
REF, ALVO = -1.44, 0.75
const = {k: np.interp(ALVO, P[k][ok[k]], pLH[ok[k]]) + np.interp(REF, nLH, N[k]) for k in 'RGB'}
paradas = np.arange(-2, 4.01, 0.25)
copia = {k: [] for k in 'RGB'}
for st in paradas:
    lh = REF + st * np.log10(2)
    for k in 'RGB':
        copia[k].append(np.interp(const[k] - np.interp(lh, nLH, N[k]), pLH[ok[k]], P[k][ok[k]]))
copia = {k: np.array(v) for k, v in copia.items()}
fig, ax = plt.subplots(1, 2, figsize=(10, 3.8))
for k in 'RGB':
    ax[0].plot(paradas, copia[k], color=COR[k], lw=2, label=k)
ax[0].set(title='Cópia de um cartão cinza (modelo ingênuo)', xlabel='exposição do negativo (paradas)', ylabel='densidade na cópia')
ax[0].legend(frameon=False)
ax[1].plot(paradas, copia['B'] - copia['G'], color='#c9a227', lw=2, label='B − G  (+ = cópia amarelada)')
ax[1].plot(paradas, copia['G'] - copia['R'], color='#a03c8c', lw=2, label='G − R  (+ = cópia magenta)')
ax[1].axhline(0, color='#bbb', lw=0.8); ax[1].axhspan(-0.02, 0.02, color='#eee')
ax[1].set(title='Desvio de cor previsto', xlabel='exposição do negativo (paradas)', ylabel='diferença de densidade')
ax[1].legend(frameon=False, fontsize=8)
fig.tight_layout(); fig.savefig(os.path.join(FIG, 'simulacao_ingenua.png')); plt.close(fig)

with open(os.path.join(DADOS, 'simulacao_ingenua.json'), 'w', encoding='utf-8') as f:
    json.dump({'aviso': 'modelo ingênuo (Status M como densidade de cópia); serve para mostrar o limite do método, não para uso no app',
               'paradas': paradas.tolist(), **{k: np.round(v, 3).tolist() for k, v in copia.items()}}, f, ensure_ascii=False, indent=1)
for st in (-2, -1, 0, 1, 2, 3):
    i = int(np.argmin(abs(paradas - st)))
    print(f'{st:+d} paradas: R {copia["R"][i]:.2f} G {copia["G"][i]:.2f} B {copia["B"][i]:.2f}  B-G {copia["B"][i]-copia["G"][i]:+.3f}')
print('figuras gravadas')
