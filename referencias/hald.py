"""Imagem Hald CLUT: um "mapa de todas as cores" usado para medir o que um filtro faz com cada cor.

Uso:
  python3 referencias/hald.py gerar [nivel]            -> referencias/hald_identidade_<n>.png
  python3 referencias/hald.py ler <hald_filtrada.jpg>   -> resumo do filtro (cinzas, pele, saturação)

Passe a imagem de identidade por um filtro (no app, com grão, vinheta e moldura DESLIGADOS) e exporte na maior
qualidade. A imagem que volta descreve a transformação de cor do filtro, cor por cor. Serve para ESTUDO e
COMPARAÇÃO: o resultado não deve ser copiado para dentro do Revela (o visual é produto de quem fez o filtro).
"""
import sys

import numpy as np
from PIL import Image


def gerar(nivel=12):
    n = nivel * nivel                       # cores por canal (12 -> 144)
    t = np.arange(n ** 3)
    r, g, b = t % n, (t // n) % n, t // (n * n)
    img = (np.stack([r, g, b], -1) * 255.0 / (n - 1)).round().astype('uint8').reshape(nivel ** 3, nivel ** 3, 3)
    caminho = f'referencias/hald_identidade_{nivel}.png'
    Image.fromarray(img).save(caminho)
    print('gerado', caminho, img.shape[:2])


def ler(caminho):
    a = np.asarray(Image.open(caminho).convert('RGB'), float) / 255
    lado = a.shape[0]; nivel = round(lado ** (1 / 3)); n = nivel * nivel
    lut = a.reshape(n, n, n, 3)              # [b][g][r]
    def cor(r, g, b):
        idx = lambda v: int(round(v / 255 * (n - 1)))
        return lut[idx(b), idx(g), idx(r)] * 255
    print('nível', nivel, '·', n, 'cores por canal')
    for v in (20, 60, 118, 180, 235):
        print(f'cinza {v:3} ->', np.round(cor(v, v, v)).astype(int))
    for nome, c in (('pele clara', (194, 150, 130)), ('pele escura', (115, 82, 68)), ('céu', (98, 122, 157)), ('folhagem', (87, 108, 67))):
        print(f'{nome:11} {c} ->', tuple(np.round(cor(*c)).astype(int)))


if __name__ == '__main__':
    if sys.argv[1] == 'gerar':
        gerar(int(sys.argv[2]) if len(sys.argv) > 2 else 12)
    else:
        ler(sys.argv[2])
