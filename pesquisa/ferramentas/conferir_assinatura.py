"""Confere os filmes do app novo contra a assinatura medida nas câmeras (Ricoh e Fuji).

Passa os quadros da cartela (cores de projeto, em luz linear, cinza médio = 0,18) pela tabela de cada filme
(filmes/*.bin), do mesmo jeito que o shader (log2 da luz / 0,18 -> tabela 3D -> sRGB), com o equilíbrio
automático do laboratório ligado. Compara com a mesma cartela sem filme.

Uso: python3 pesquisa/ferramentas/conferir_assinatura.py
"""
import json
import os
import sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, os.path.join(RAIZ, 'referencias'))
import medir  # noqa: E402

Q = medir.MAPA['quadros']
NOMES = ['pele escura', 'pele clara', 'céu', 'folhagem', 'flor azul', 'verde-água', 'laranja', 'azul arroxeado', 'vermelho médio',
         'roxo', 'verde-limão', 'amarelo-laranja', 'azul', 'verde', 'vermelho', 'amarelo', 'magenta', 'ciano']
dec = lambda v: np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def carrega(fid):
    meta = json.load(open(os.path.join(RAIZ, 'filmes', fid + '.json'), encoding='utf-8'))
    t = meta['tabela']; n = t['n']
    lut = np.fromfile(os.path.join(RAIZ, 'filmes', fid + '.bin'), '<u2').astype(np.float64).reshape(n, n, n, 3) / 65535  # [b][g][r]
    return meta, lut, t


def filme(x, lut, t):
    n = t['n']; u = (np.log2(np.maximum(x, 1e-7) / 0.18) - t['min']) / (t['max'] - t['min'])
    p = np.clip(u, 0, 1) * (n - 1); i0 = np.clip(np.floor(p).astype(int), 0, n - 2); f = p - i0
    out = 0
    for dr in (0, 1):
        for dg in (0, 1):
            for db in (0, 1):
                w = (f[..., 0] if dr else 1 - f[..., 0]) * (f[..., 1] if dg else 1 - f[..., 1]) * (f[..., 2] if db else 1 - f[..., 2])
                out = out + w[..., None] * lut[i0[..., 2] + db, i0[..., 1] + dg, i0[..., 0] + dr]
    return dec(out)


def lch(lin):
    L = medir.lab(np.clip(lin, 0, None)); return np.stack([L[..., 0], np.hypot(L[..., 1], L[..., 2]), np.degrees(np.arctan2(L[..., 2], L[..., 1])) % 360], -1)


def main():
    cc = dec(np.array([Q[k]['srgb'] for k in range(24)], float) / 255)
    cena = cc * (0.18 / (cc[21] @ medir.SRGB_XYZ[1]))          # cinza 5 do ColorChecker = cinza médio
    ref = lch(cena[:18])
    ids = json.load(open(os.path.join(RAIZ, 'filmes/indice.json')))
    linhas = []
    for fid in ids:
        meta, lut, t = carrega(fid)
        g = filme(np.full(3, 0.18), lut, t); bal = (g @ [0.2126, 0.7152, 0.0722]) / g   # equilíbrio automático
        out = filme(cena[:18], lut, t) * bal
        c = lch(out); dh = (c[:, 2] - ref[:, 2] + 180) % 360 - 180
        cz = lambda s: float(medir.lab(filme(np.full(3, 0.18 * 2 ** s), lut, t) * bal)[0])
        r = {'filme': meta['nome'], 'cat': meta['cat'], 'cinza': cz(0), 'contraste': cz(1) - cz(-1),
             'sat': float(np.mean(c[:, 1] / np.maximum(ref[:, 1], 1)))}
        for nome in ('pele clara', 'céu', 'folhagem'):
            k = NOMES.index(nome); r[nome] = (float(dh[k]), float(c[k, 1] - ref[k, 1]))
        linhas.append(r)
    print(f"{'filme':10} {'tipo':9} {'cinza':>6} {'contr.':>6} {'sat×':>5} | {'pele (h/C)':>14} | {'céu (h/C)':>14} | {'folhagem (h/C)':>15}")
    for r in linhas:
        f = lambda v: f"{v[0]:+5.0f}° {v[1]:+5.1f}"
        print(f"{r['filme']:10} {r['cat']:9} {r['cinza']:6.1f} {r['contraste']:6.1f} {r['sat']:5.2f} | {f(r['pele clara']):>14} | {f(r['céu']):>14} | {f(r['folhagem']):>15}")
    return linhas


if __name__ == '__main__':
    main()
