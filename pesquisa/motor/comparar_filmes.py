"""Aplica os pacotes de filme do app (novo/filmes/*.bin) a uma foto, do mesmo jeito que o shader do app,
e monta uma folha de comparação. Testa o próprio pacote que vai para o app.

Uso: python3 pesquisa/motor/comparar_filmes.py <foto.jpg> [exposicao]
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
FILMES = os.path.join(AQUI, '..', '..', 'novo', 'filmes')
FIG = os.path.join(AQUI, '..', 'figuras')


def dec(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def trilinear(lut, n, t):
    x = np.clip(t, 0, 1) * (n - 1); i0 = np.floor(x).astype(int).clip(0, n - 2); f = x - i0
    L = lut.reshape(n, n, n, 3); out = 0
    for db in (0, 1):
        for dg in (0, 1):
            for dr in (0, 1):
                w = (f[..., 2] if db else 1 - f[..., 2]) * (f[..., 1] if dg else 1 - f[..., 1]) * (f[..., 0] if dr else 1 - f[..., 0])
                out = out + w[..., None] * L[i0[..., 2] + db, i0[..., 1] + dg, i0[..., 0] + dr]
    return out


def aplica(img, fid, exposicao=0.0):
    meta = json.load(open(os.path.join(FILMES, fid + '.json'), encoding='utf-8'))
    tb = meta['tabela']; n = tb['n']
    lut = np.fromfile(os.path.join(FILMES, fid + '.bin'), dtype='<u2').astype(float) / 65535
    x = dec(img) * 2.0 ** exposicao
    t = (np.log2(np.maximum(x, 1e-7) / 0.18) - tb['min']) / (tb['max'] - tb['min'])
    return np.clip(trilinear(lut, n, t), 0, 1), meta


def main(foto, exposicao=0.0):
    ids = json.load(open(os.path.join(FILMES, 'indice.json')))
    im = Image.open(foto).convert('RGB'); im.thumbnail((640, 640))
    a = np.asarray(im, float) / 255
    quadros = [('Digital (original)', a)] + [(f"{m['nome']} · {m['inspirado'].split(' (')[0]}", r) for r, m in (aplica(a, i, exposicao) for i in ids)]
    cols = 4; w, h = im.size; rot = 26
    folha = Image.new('RGB', (cols * w, ((len(quadros) + cols - 1) // cols) * (h + rot)), (18, 17, 16))
    d = ImageDraw.Draw(folha)
    try:
        fonte = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    except OSError:
        fonte = ImageFont.load_default()
    for k, (nome, v) in enumerate(quadros):
        x0, y0 = (k % cols) * w, (k // cols) * (h + rot)
        folha.paste(Image.fromarray((v * 255).round().astype('uint8')), (x0, y0 + rot))
        d.text((x0 + 8, y0 + 5), nome, fill=(230, 225, 215), font=fonte)
    sufixo = '' if not exposicao else f'_{exposicao:+.0f}'
    caminho = os.path.join(FIG, f'filmes_comparacao{sufixo}.jpg')
    folha.save(caminho, quality=88)
    print('gravado', caminho)


if __name__ == '__main__':
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 0.0)
