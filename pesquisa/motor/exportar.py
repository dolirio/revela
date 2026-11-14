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

# Interação entre camadas (DIR, 4º número depois do tamanho do grão): a ficha não publica. Valor provisório pela
# descrição do próprio fabricante (Ektar "ultra vívido" > UltraMax > Gold > Portra 400/800 > Portra 160 "natural"),
# até a calibração com as fotos de referência.
# Parâmetros vindos das fichas: grão pelo Print Grain Index (35 mm, cópia 10×15; 25 = limite do visível),
# nitidez por camada pela MTF a 40 ciclos/mm, halação pela presença de camada anti-halo.
P400_NIT = [0.67, 1.0, 1.0]


def grao(pgi):
    return round(max(0.06, 0.30 * (pgi - 15) / (37 - 15)), 3)


def F(id_, motor, nome, inspirado, nota, pgi, tam, dir_, halacao=0.04, nit=None, paradas=0.0, cat='negativo'):
    return {'id': id_, 'motor': {'filme': motor}, 'nome': nome, 'inspirado': inspirado, 'cat': cat, 'nota': nota,
            'paradas': paradas, 'dir': dir_,
            'analogico': {'grao': grao(pgi), 'grao_tamanho': tam, 'halacao': halacao, 'nitidez_canal': nit or P400_NIT}}


FILMES = [
    F('ke100', 'ektar100', 'KE 100', 'Kodak Ektar 100', 'negativo · ISO 100 · cor viva, grão finíssimo, céus profundos', 22, 0.85, 0.40),
    F('kp160', 'portra160', 'KP 160', 'Kodak Portra 160', 'negativo de retrato · ISO 160 · suave, pele natural, contraste baixo', 28, 0.9, 0.06),
    F('kg200', 'gold200', 'KG 200', 'Kodak Gold 200', 'negativo de consumo · ISO 200 · quente e dourado', 44, 0.95, 0.28),
    F('kp400', 'portra400', 'KP 400', 'Kodak Portra 400', 'negativo de retrato · ISO 400 · pele dourada, contraste baixo, latitude enorme', 37, 1.0, 0.18),
    F('ku400', 'ultramax400', 'KU 400', 'Kodak UltraMax 400', 'negativo de consumo · ISO 400 · cor forte, grão aparente', 46, 1.05, 0.32),
    F('kp800', 'portra800', 'KP 800', 'Kodak Portra 800', 'negativo de retrato · ISO 800 · para pouca luz, mais grão', 48, 1.15, 0.16),
    # CineStill 800T: o Vision3 500T sem a camada anti-halo, fotometrado a ISO 800 (2/3 de parada a menos de luz)
    F('cs800t', 'vision3_500t', 'C 800T', 'CineStill 800T (Kodak Vision3 500T)', 'filme de cinema para luz de tungstênio · ISO 800 · halação vermelha nas luzes',
      52, 1.15, 0.10, halacao=0.55, paradas=-0.68),
]


def nitidez_da_ficha(fid):
    try:
        with open(os.path.join(AQUI, '..', 'dados', fid + '.json'), encoding='utf-8') as fp:
            m = json.load(fp).get('mtf')
        i = m['ciclos_mm'].index(40)
        v = [m[k][i] for k in 'RGB']
        return [round(x / max(v), 3) for x in v]
    except (KeyError, ValueError, TypeError, OSError):
        return None

def exporta(f):
    m = Motor(**f['motor'], corantes='kodak', correcao_lab=0.7, dir_calibracao=0.0, paradas_base=f['paradas'])
    nit = nitidez_da_ficha(f['motor']['filme'])
    if nit:
        f['analogico']['nitidez_canal'] = nit
    g = np.linspace(0, 1, N)
    b, gg, r = np.meshgrid(g, g, g, indexing='ij')
    t = np.stack([r, gg, b], -1).reshape(-1, 3)
    x = 0.18 * 2.0 ** (MIN + t * (MAX - MIN))
    out = np.clip(srgb_encode(m.escaneia(x, 0.0, f['dir'])), 0, 1)
    os.makedirs(DESTINO, exist_ok=True)
    (np.round(out * 65535).astype('<u2')).tofile(os.path.join(DESTINO, f['id'] + '.bin'))
    meta = {k: f[k] for k in ('id', 'nome', 'inspirado', 'cat', 'nota', 'analogico')}
    meta['ficha'] = m.f.nome
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
