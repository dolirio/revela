"""Valida o protótipo do motor espectral e gera figuras, medidas e LUTs .cube.

Uso: python3 pesquisa/motor/prototipo.py [foto-de-teste.jpg]
Gera em pesquisa/motor/saida/ e pesquisa/figuras/.
"""
import json
import os
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from motor import (CMF, NM, SRGB_XYZ, XYZ_SRGB, Motor, grava_cube, srgb_decode, srgb_encode, xyz_lab)  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'saida')
FIG = os.path.join(AQUI, '..', 'figuras')
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False, 'figure.dpi': 110})
BRANCO = SRGB_XYZ @ np.ones(3)

# ColorChecker clássico, valores sRGB aproximados (8 bits)  # APROX: média de medições publicadas
CARTELA = [('pele escura', (115, 82, 68)), ('pele clara', (194, 150, 130)), ('céu', (98, 122, 157)), ('folhagem', (87, 108, 67)),
           ('flor azul', (133, 128, 177)), ('verde-água', (103, 189, 170)), ('laranja', (214, 126, 44)), ('azul arroxeado', (80, 91, 166)),
           ('vermelho médio', (193, 90, 99)), ('roxo', (94, 60, 108)), ('verde-limão', (157, 188, 64)), ('amarelo-laranja', (224, 163, 46)),
           ('azul', (56, 61, 150)), ('verde', (70, 148, 73)), ('vermelho', (175, 54, 60)), ('amarelo', (231, 199, 31)),
           ('magenta', (187, 86, 149)), ('ciano', (8, 133, 161)), ('branco', (243, 243, 242)), ('cinza 8', (200, 200, 200)),
           ('cinza 6,5', (160, 160, 160)), ('cinza 5', (122, 122, 121)), ('cinza 3,5', (85, 85, 85)), ('preto', (52, 52, 52))]


def lab_de_srgb(enc):
    return xyz_lab(srgb_decode(enc) @ SRGB_XYZ.T, BRANCO)


def lch(lab):
    return np.stack([lab[..., 0], np.hypot(lab[..., 1], lab[..., 2]), np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360], -1)


def aplica_lut(img, lut, n):
    """Interpolação trilinear, como a placa de vídeo faz no app."""
    x = np.clip(img, 0, 1) * (n - 1)
    i0 = np.floor(x).astype(int).clip(0, n - 2); t = x - i0
    L = lut.reshape(n, n, n, 3)   # [b][g][r]
    out = 0
    for db in (0, 1):
        for dg in (0, 1):
            for dr in (0, 1):
                w = (t[..., 2] if db else 1 - t[..., 2]) * (t[..., 1] if dg else 1 - t[..., 1]) * (t[..., 0] if dr else 1 - t[..., 0])
                out = out + w[..., None] * L[i0[..., 2] + db, i0[..., 1] + dg, i0[..., 0] + dr]
    return out


def motor_em(m, enc, paradas=0.0, dir_=0.0, bloco=150000, caminho='scan'):
    lin = srgb_decode(enc.reshape(-1, 3)); out = np.empty_like(lin)
    f = m.escaneia if caminho == 'scan' else m.srgb
    for i in range(0, len(lin), bloco):
        out[i:i + bloco] = f(lin[i:i + bloco], paradas, dir_)
    return np.clip(srgb_encode(out), 0, 1).reshape(enc.shape)


def main(foto=None):
    os.makedirs(SAIDA, exist_ok=True)
    m = Motor()
    with open(os.path.join(SAIDA, 'revela_atual_lut.json')) as f:
        atual = json.load(f)['f_kp400']
    lut_atual = np.array(atual['data'])
    DIR = 0.25
    rel = {'parametros': {'dir': DIR, 'filtro_ampliador': m.filtro.round(4).tolist(),
                          'corantes_ajuste_custo': round(float(m.ajuste_corantes.cost), 5)}}

    # ---------------------------------------------------------- 1) bases espectrais e corantes
    fig, ax = plt.subplots(1, 2, figsize=(10, 3.8))
    for b, c, n in zip(m.base_rgb, ('#c8302a', '#2f8f3a', '#2856b8'), ('R', 'G', 'B')):
        ax[0].plot(NM, b, color=c, lw=2, label=f'espectro da primária {n}')
    ax[0].plot(NM, m.branco, color='#888', lw=1.2, ls='--', label='soma = branco D65')
    ax[0].set(title='Da cor RGB à luz (espectro suave)', xlabel='nm', ylabel='intensidade relativa'); ax[0].legend(frameon=False, fontsize=8)
    alvo = m.f.neutro_esp - m.f.dmin_esp
    ax[1].plot(NM, alvo, color='#222', lw=2.4, label='ficha: cinza médio − Dmin')
    ax[1].plot(NM, m.cor_neg.sum(0), color='#e0a030', lw=1.4, ls='--', label='soma dos corantes ajustados')
    for cc, c, n in zip(m.cor_neg, ('#1aa3b8', '#c0368c', '#d6b416'), ('ciano', 'magenta', 'amarelo')):
        ax[1].plot(NM, cc, color=c, lw=1.8, label=n)
    ax[1].axvspan(380, 400, color='#f3f3f3'); ax[1].axvspan(700, 730, color='#f3f3f3')
    ax[1].set(title='Corantes do negativo separados (desmistura)', xlabel='nm', ylabel='densidade'); ax[1].legend(frameon=False, fontsize=8)
    fig.tight_layout(); fig.savefig(os.path.join(FIG, 'motor_espectros.png')); plt.close(fig)

    # ---------------------------------------------------------- 2) escala de cinza
    st = np.linspace(-4, 5, 37)
    cinza = np.full((len(st), 3), 0.18) * (2.0 ** st)[:, None]
    lab_p = np.array([xyz_lab(m.escaneia(np.array([0.18] * 3), s, DIR) @ SRGB_XYZ.T, BRANCO) for s in st])
    lab_c = np.array([xyz_lab(m.copia(np.array([0.18] * 3), s, DIR) * BRANCO, BRANCO) for s in st])
    enc = srgb_encode(np.clip(cinza, 0, 1))
    lab_a = lab_de_srgb(aplica_lut(enc, lut_atual, 33))
    lab_in = lab_de_srgb(enc)
    fig, ax = plt.subplots(1, 2, figsize=(10, 3.8))
    ax[0].plot(st, lab_in[:, 0], color='#aaa', lw=1.5, ls='--', label='foto digital (corta em +2,5)')
    ax[0].plot(st, lab_a[:, 0], color='#c07a2c', lw=2, label='Revela atual (KP 400)')
    ax[0].plot(st, lab_c[:, 0], color='#8a8fd0', lw=1.4, ls='-.', label='protótipo · cópia em papel (óptica)')
    ax[0].plot(st, lab_p[:, 0], color='#222', lw=2.2, label='protótipo · escaneado')
    ax[0].set(title='Escala tonal de um cartão cinza', xlabel='exposição (paradas em relação ao cinza médio)', ylabel='luminosidade L*')
    ax[0].legend(frameon=False, fontsize=8)
    ax[1].plot(st, lab_p[:, 1], color='#a03c8c', lw=2, label='a*  (+ magenta / − verde)')
    ax[1].plot(st, lab_p[:, 2], color='#c9a227', lw=2, label='b*  (+ amarelo / − azul)')
    ax[1].plot(st, lab_a[:, 1], color='#a03c8c', lw=1, ls=':', label='a* Revela atual')
    ax[1].plot(st, lab_a[:, 2], color='#c9a227', lw=1, ls=':', label='b* Revela atual')
    ax[1].axhspan(-2, 2, color='#eee'); ax[1].axhline(0, color='#bbb', lw=0.8)
    ax[1].set(title='Cor do cinza ao longo da escala', xlabel='exposição (paradas)', ylabel='desvio de cor', ylim=(-8, 8))
    ax[1].legend(frameon=False, fontsize=8)
    fig.tight_layout(); fig.savefig(os.path.join(FIG, 'motor_cinza.png')); plt.close(fig)
    rel['escala_cinza'] = {'paradas': st[::4].tolist(), 'L': lab_p[::4, 0].round(1).tolist(),
                           'a': lab_p[::4, 1].round(2).tolist(), 'b': lab_p[::4, 2].round(2).tolist()}

    # ---------------------------------------------------------- 3) cartela de cores
    cart = np.array([c for _, c in CARTELA], float) / 255
    linhas = [('original (digital)', cart)]
    linhas.append(('Revela atual · KP 400', aplica_lut(cart, lut_atual, 33)))
    for s in (-1, 0, 1, 2):
        linhas.append((f'protótipo · {s:+d} parada' + ('s' if abs(s) > 1 else ''), motor_em(m, cart, s, DIR)))
    linhas.append(('protótipo · 0 · sem DIR', motor_em(m, cart, 0, 0.0)))
    linhas.append(('cópia em papel óptica · 0', motor_em(m, cart, 0, DIR, caminho='copia')))
    fig, ax = plt.subplots(len(linhas), 1, figsize=(11, 1.05 * len(linhas)))
    for a, (n, v) in zip(ax, linhas):
        a.imshow(v.reshape(1, 24, 3)[:, :, :] .repeat(1, 0), aspect='auto', interpolation='nearest')
        a.set_xticks([]); a.set_yticks([]); a.set_ylabel(n, rotation=0, ha='right', va='center', fontsize=9)
        for s in a.spines.values(): s.set_visible(False)
    ax[-1].set_xticks(range(24)); ax[-1].set_xticklabels([n for n, _ in CARTELA], rotation=60, ha='right', fontsize=7)
    fig.tight_layout(); fig.savefig(os.path.join(FIG, 'motor_cartela.png')); plt.close(fig)

    lin0 = lch(lab_de_srgb(cart)); medidas = {}
    for n, v in linhas[1:]:
        l2 = lch(lab_de_srgb(v)); cor = slice(0, 18)
        dh = (l2[cor, 2] - lin0[cor, 2] + 180) % 360 - 180
        medidas[n] = {'croma_relativo_medio': round(float(np.mean(l2[cor, 1] / lin0[cor, 1])), 3),
                      'desvio_matiz_medio_graus': round(float(np.mean(np.abs(dh))), 1),
                      'pele_escura_LCh': l2[0].round(1).tolist(), 'pele_clara_LCh': l2[1].round(1).tolist()}
    medidas['original'] = {'pele_escura_LCh': lin0[0].round(1).tolist(), 'pele_clara_LCh': lin0[1].round(1).tolist()}
    rel['cartela'] = medidas

    # ---------------------------------------------------------- 4) saturação conforme o DIR
    rel['dir_vs_croma'] = {str(d): round(float(np.mean(lch(lab_de_srgb(motor_em(m, cart, 0, d)))[:18, 1] / lin0[:18, 1])), 3)
                           for d in (0.0, 0.15, 0.25, 0.4)}

    # ---------------------------------------------------------- 5) foto de teste
    if foto:
        im = Image.open(foto).convert('RGB'); im.thumbnail((1100, 1100))
        a = np.asarray(im, float) / 255
        quadros = [('original (digital)', a), ('Revela atual · KP 400', aplica_lut(a, lut_atual, 33)),
                   ('protótipo · escaneado · exposição normal', motor_em(m, a, 0, DIR)),
                   ('protótipo · escaneado · +1 parada', motor_em(m, a, 1, DIR)),
                   ('protótipo · escaneado · −1 parada', motor_em(m, a, -1, DIR)),
                   ('protótipo · cópia em papel óptica', motor_em(m, a, 0, DIR, caminho='copia'))]
        fig, ax = plt.subplots(3, 2, figsize=(12, 12.4))
        for x, (n, v) in zip(ax.flat, quadros):
            x.imshow(np.clip(v, 0, 1)); x.set_title(n, fontsize=10); x.axis('off')
        fig.tight_layout(); fig.savefig(os.path.join(FIG, 'motor_retrato.jpg'), dpi=100, pil_kwargs={'quality': 88}); plt.close(fig)

    # ---------------------------------------------------------- 6) LUTs para testar no app (⋯ › Importar LUT)
    for s, nome in ((0, 'portra400_prototipo'), (1, 'portra400_prototipo_mais1')):
        grava_cube(os.path.join(SAIDA, nome + '.cube'), m.lut(33, s, DIR), 33, f'Revela protótipo Portra 400 {s:+d}')
    with open(os.path.join(SAIDA, 'relatorio.json'), 'w', encoding='utf-8') as f:
        json.dump(rel, f, ensure_ascii=False, indent=1)
    print(json.dumps(rel, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
