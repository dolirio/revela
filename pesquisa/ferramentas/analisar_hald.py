"""Lê imagens Hald filtradas por outros apps (ver referencias/COMO-PASSAR-HALD.md) e mede o que cada filtro faz,
lado a lado com os filmes do app novo (filmes). Serve para ESTUDO e COMPARAÇÃO: nada daqui vai para o app.

Uso: python3 pesquisa/ferramentas/analisar_hald.py <pasta-com-as-hald> [saida.json]

Para cada filtro: curva do cinza (L* para a luz de −3 a +3 paradas, cinza médio = sRGB 0,18 linear),
contraste nos médios, cor do cinza (a*, b*), saturação média dos 18 quadros do ColorChecker e o deslocamento de
matiz/croma da pele, do céu e da folhagem. As exportações vêm em Display P3 (RNI): convertidas para sRGB antes.
"""
import glob
import io
import json
import os
import sys

import numpy as np
from PIL import Image, ImageCms

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, AQUI); sys.path.insert(0, os.path.join(RAIZ, 'referencias'))
import medir  # noqa: E402
import conferir_assinatura as CA  # noqa: E402

enc = lambda v: np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.power(np.clip(v, 0, None), 1 / 2.4) - 0.055)
dec = CA.dec


def carrega_hald(caminho):
    im = Image.open(caminho)
    if 'icc_profile' in im.info:
        src = ImageCms.ImageCmsProfile(io.BytesIO(im.info['icc_profile']))
        im = ImageCms.profileToProfile(im, src, ImageCms.createProfile('sRGB'), outputMode='RGB')
    a = np.asarray(im.convert('RGB'), float) / 255
    n = round(a.shape[0] ** (2 / 3))
    return a.reshape(n, n, n, 3)                       # [b][g][r], valores sRGB codificados


def aplica(lut, rgb_enc):
    n = lut.shape[0]; p = np.clip(rgb_enc, 0, 1) * (n - 1); i0 = np.clip(np.floor(p).astype(int), 0, n - 2); f = p - i0
    out = 0
    for dr in (0, 1):
        for dg in (0, 1):
            for db in (0, 1):
                w = (f[..., 0] if dr else 1 - f[..., 0]) * (f[..., 1] if dg else 1 - f[..., 1]) * (f[..., 2] if db else 1 - f[..., 2])
                out = out + w[..., None] * lut[i0[..., 2] + db, i0[..., 1] + dg, i0[..., 0] + dr]
    return dec(out)                                    # -> luz linear sRGB


def mede(fun):
    """fun: luz linear sRGB (cena, cinza médio 0,18) -> luz linear sRGB de saída."""
    Q = medir.MAPA['quadros']
    cc = dec(np.array([Q[k]['srgb'] for k in range(24)], float) / 255)
    cena = cc * (0.18 / (cc[21] @ medir.SRGB_XYZ[1]))
    ref = CA.lch(cena[:18]); out = fun(cena[:18]); c = CA.lch(out)
    dh = (c[:, 2] - ref[:, 2] + 180) % 360 - 180
    cz = {s: medir.lab(fun(np.full((1, 3), min(0.18 * 2 ** s, 1.0)))[0]) for s in (-3, -2, -1, 0, 1, 2)}
    r = {'curva_L': {s: round(float(v[0]), 1) for s, v in cz.items()},
         'contraste': round(float(cz[1][0] - cz[-1][0]), 1),
         'cinza_ab': [round(float(cz[0][1]), 1), round(float(cz[0][2]), 1)],
         'sombra_ab': [round(float(cz[-2][1]), 1), round(float(cz[-2][2]), 1)],
         'saturacao': round(float(np.mean(c[:, 1] / np.maximum(ref[:, 1], 1))), 2)}
    for nome in ('pele clara', 'pele escura', 'céu', 'folhagem', 'vermelho', 'amarelo', 'azul'):
        k = CA.NOMES.index(nome); r[nome] = [round(float(dh[k]), 1), round(float(c[k, 1] - ref[k, 1]), 1)]
    return r


def main(pasta, saida=None):
    res = {}
    for f in sorted(glob.glob(os.path.join(pasta, '*.jp*g')) + glob.glob(os.path.join(pasta, '*.png'))):
        lut = carrega_hald(f)
        res[os.path.splitext(os.path.basename(f))[0]] = mede(lambda x, l=lut: aplica(l, enc(np.clip(x, 0, 1))))
    for fid in json.load(open(os.path.join(RAIZ, 'filmes/indice.json'))):
        meta, lut, t = CA.carrega(fid)
        g = CA.filme(np.full(3, 0.18), lut, t); bal = (g @ [0.2126, 0.7152, 0.0722]) / g
        res['Revela_' + meta['nome'].replace(' ', '')] = mede(lambda x, l=lut, t=t, b=bal: CA.filme(x, l, t) * b)
    print(f"{'filtro':22} {'L −2/0/+2':>16} {'contr':>5} {'cinza a/b':>10} {'sat':>5} | {'pele clara':>11} | {'céu':>11} | {'folhagem':>11}")
    for k, r in res.items():
        L = r['curva_L']; f = lambda v: f"{v[0]:+4.0f}°{v[1]:+5.1f}"
        print(f"{k:22} {L[-2]:5.1f}/{L[0]:4.1f}/{L[2]:4.1f} {r['contraste']:5.1f} {r['cinza_ab'][0]:+4.1f}/{r['cinza_ab'][1]:+4.1f} {r['saturacao']:5.2f} | {f(r['pele clara'])} | {f(r['céu'])} | {f(r['folhagem'])}")
    if saida:
        json.dump(res, open(saida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return res


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
