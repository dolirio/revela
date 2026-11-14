"""Exporta um filme do motor espectral para o formato que o app novo carrega (novo/filmes/).

Uso: python3 pesquisa/motor/exportar.py

Formato do pacote (dois arquivos por filme):
  <id>.json  metadados: nome, categoria, descrição, domínio da tabela, parâmetros analógicos vindos da ficha
  <id>.bin   tabela de cor 3D, Uint16 little-endian, N×N×N×3 (R mais rápido, depois G, depois B)

A tabela trabalha em LUZ DA CENA, não na foto pronta:
  entrada  = exposição de cada canal em paradas relativas ao cinza médio, de MIN a MAX
             (t = (log2(x / 0,18) − MIN) / (MAX − MIN), com x = luz linear do canal)
  saída    = cor sRGB final (codificada), já com negativo + scanner + curva do laboratório
Assim o app aplica a exposição e o equilíbrio de cor ANTES do filme, e a foto atravessa a curva real do filme.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from motor import Motor, srgb_encode  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(AQUI, '..', '..', 'novo', 'filmes')
N, MIN, MAX = 33, -9.0, 7.0

FILMES = [
    {
        'id': 'portra400', 'motor': {'filme': 'portra400', 'papel': 'endura_premier'},
        'nome': 'Portra 400', 'inspirado': 'Kodak Portra 400', 'cat': 'negativo',
        'nota': 'negativo de retrato · ISO 400 · pele dourada, contraste baixo, latitude enorme',
        'dir': 0.25,
        # parâmetros analógicos tirados da ficha (ver pesquisa/filmes/portra-400.md)
        'analogico': {
            'grao': 0.30,              # Print Grain Index 37 em 10×15 (35 mm): visível, fino
            'grao_tamanho': 1.0,
            'halacao': 0.04,           # filme com camada anti-halo: halação discreta
            'nitidez_canal': [0.55, 0.85, 0.80],   # MTF a 40 ciclos/mm: R 50%, G 74%, B 74% (relativo)
        },
    },
]


def exporta(f):
    m = Motor(**f['motor'])
    g = np.linspace(0, 1, N)
    b, gg, r = np.meshgrid(g, g, g, indexing='ij')
    t = np.stack([r, gg, b], -1).reshape(-1, 3)
    x = 0.18 * 2.0 ** (MIN + t * (MAX - MIN))
    out = np.clip(srgb_encode(m.escaneia(x, 0.0, f['dir'])), 0, 1)
    os.makedirs(DESTINO, exist_ok=True)
    (np.round(out * 65535).astype('<u2')).tofile(os.path.join(DESTINO, f['id'] + '.bin'))
    meta = {k: f[k] for k in ('id', 'nome', 'inspirado', 'cat', 'nota', 'analogico')}
    meta['tabela'] = {'n': N, 'min': MIN, 'max': MAX, 'formato': 'uint16le rgb, r mais rápido', 'motor': 'pesquisa/motor (espectral, caminho escaneado)'}
    # cinza médio na saída: o app usa para alinhar o modo "digital" (intensidade 0) ao mesmo meio-tom
    mid = srgb_encode(m.escaneia(np.array([[0.18, 0.18, 0.18]]), 0.0, f['dir']))[0]
    meta['cinza_medio_saida'] = [round(float(v), 4) for v in mid]
    with open(os.path.join(DESTINO, f['id'] + '.json'), 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, ensure_ascii=False, indent=1)
    print('exportado', f['id'], 'cinza médio ->', meta['cinza_medio_saida'])


if __name__ == '__main__':
    for f in FILMES:
        exporta(f)
    with open(os.path.join(DESTINO, 'indice.json'), 'w', encoding='utf-8') as fp:
        json.dump([f['id'] for f in FILMES], fp)
