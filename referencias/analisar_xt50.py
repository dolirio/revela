"""Analisa a sessão da Fujifilm X-T50: RAW + simulações convertidas no X RAW Studio (uma pasta por simulação).

Uso: python3 referencias/analisar_xt50.py <pasta-dos-RAF> <pasta-das-simulacoes> <pasta-de-saida> [extra=nome:pasta ...]

- <pasta-das-simulacoes> tem uma subpasta por simulação (ACROS, ASTIA, …). O nome da simulação vem do EXIF
  (FilmMode / Saturation para os P&B), não do nome da pasta.
- extra: pastas a mais, com nome dado (ex.: "PB Lindbergh v1:/caminho/v1").
- Cada simulação é ligada ao RAW pela hora da foto (DateTimeOriginal), que o X RAW Studio preserva.
  Os nomes dos arquivos não servem: o DSCF0658 sai como DSCF0688(n).
- Fotos com duas cartelas: esquerda = papel fotográfico, direita = papel comum (anotações da sessão).
  Fotos com uma cartela: papel fotográfico.
- As marcas são achadas no JPG Provia de cada foto (claro e com a mesma geometria de todas as conversões);
  o RAW tem as suas, ou as do Provia deslocadas pelo recorte do X RAW Studio (24 × 26 px).
"""
import glob
import json
import os
import subprocess
import sys
from collections import defaultdict
from multiprocessing import Pool

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import medir  # noqa: E402

plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False, 'figure.dpi': 110})
Q = medir.MAPA['quadros']
IDX = {(q['grupo'], q.get('i')): k for k, q in enumerate(Q)}
CINZA_REF = IDX[('colorchecker', 21)]
CINZAS = [IDX[('colorchecker', i)] for i in range(18, 24)] + [IDX[('cinzas', i)] for i in range(12)]
CORES = list(range(18))
NOMES_CC = ['pele escura', 'pele clara', 'céu', 'folhagem', 'flor azul', 'verde-água', 'laranja', 'azul arroxeado',
            'vermelho médio', 'roxo', 'verde-limão', 'amarelo-laranja', 'azul', 'verde', 'vermelho', 'amarelo', 'magenta', 'ciano']
ORDEM = ['Provia', 'Astia', 'Velvia', 'Classic Chrome', 'Reala Ace', 'Pro Neg Std', 'Pro Neg Hi', 'Classic Neg',
         'Nostalgic Neg', 'Eterna', 'Eterna Bleach Bypass', 'Acros']
PB = {'Acros', 'PB Lindbergh v1'}


def nome_sim(d):
    fm = str(d.get('FilmMode', '') or '')
    for chave, nome in (('Provia', 'Provia'), ('Astia', 'Astia'), ('Velvia', 'Velvia'), ('Classic Chrome', 'Classic Chrome'),
                        ('Reala', 'Reala Ace'), ('Pro Neg. Std', 'Pro Neg Std'), ('Pro Neg. Hi', 'Pro Neg Hi'),
                        ('Classic Negative', 'Classic Neg'), ('Nostalgic', 'Nostalgic Neg'), ('Bleach', 'Eterna Bleach Bypass'),
                        ('Eterna', 'Eterna'), ('Acros', 'Acros')):
        if chave.lower() in fm.lower():
            return nome
    sat = str(d.get('Saturation', '') or '')
    return 'Acros' if 'acros' in sat.lower() else (fm or sat or '?')


def exif(arquivos):
    out = subprocess.run(['exiftool', '-q', '-j', '-FileName', '-Directory', '-DateTimeOriginal', '-ExposureCompensation',
                          '-FilmMode', '-Saturation', '-ImageWidth', '-ImageHeight'] + arquivos, capture_output=True, text=True).stdout
    return json.loads(out)


def _mede_jpg(args):
    caminho, quadras = args
    lin = medir.abre(caminho)
    return caminho, [np.array([q['linear'] for q in medir._mede_com(lin, np.float32(m), caminho, f'.c{i}')['quadros']]) for i, m in enumerate(quadras)]


def _marcas(caminho):
    lin = medir.abre(caminho)
    try:
        return caminho, [m.tolist() for m in medir.acha_cartelas(lin, 2)]
    except ValueError:
        try:
            return caminho, [medir.acha_marcas(lin).tolist()]
        except ValueError:
            return caminho, None


def lab(lin):
    return medir.lab(np.clip(lin, 0, None))


def lch(L):
    return np.stack([L[..., 0], np.hypot(L[..., 1], L[..., 2]), np.degrees(np.arctan2(L[..., 2], L[..., 1])) % 360], -1)


def main(pasta_raf, pasta_sims, saida, extras):
    os.makedirs(saida, exist_ok=True)
    rafs = exif(sorted(glob.glob(os.path.join(pasta_raf, '*.RAF'))))
    jpgs = exif(sorted(glob.glob(os.path.join(pasta_sims, '*', '*.jpg'))))
    for nome, pasta in extras:
        for d in exif(sorted(glob.glob(os.path.join(pasta, '*.jpg')))):
            d['_sim'] = nome; jpgs.append(d)
    por_hora = defaultdict(dict)
    for d in jpgs:
        d.setdefault('_sim', nome_sim(d))
        por_hora[d['DateTimeOriginal']][d['_sim']] = os.path.join(d['Directory'], d['FileName'])
    fotos = []
    for r in rafs:
        sims = por_hora.get(r['DateTimeOriginal'], {})
        fotos.append({'raf': os.path.join(r['Directory'], r['FileName']), 'nome': r['FileName'][:-4], 'hora': r['DateTimeOriginal'],
                      'comp': float(eval(str(r.get('ExposureCompensation', 0) or 0).replace('+', ''))), 'sims': sims})
    print(f'{len(fotos)} RAW, {sum(len(f["sims"]) for f in fotos)} conversões ligadas pela hora', flush=True)

    # 1) marcas: no Provia de cada foto
    with Pool(4) as pool:
        marcas = dict(pool.map(_marcas, [f['sims']['Provia'] for f in fotos if 'Provia' in f['sims']]))
    # 2) medidas: RAW e todas as conversões com as marcas do Provia (o RAW é deslocado pelo recorte)
    tarefas = []
    for f in fotos:
        m = marcas.get(f['sims'].get('Provia'))
        f['n_cartelas'] = 0 if m is None else len(m)
        if m is None:
            continue
        for arq in f['sims'].values():
            tarefas.append((arq, m))
    with Pool(4) as pool:
        M = dict(pool.map(_mede_jpg, tarefas, chunksize=4))
    raw_tarefas = []
    for f in fotos:
        m = marcas.get(f['sims'].get('Provia'))
        if m is None:
            continue
        import rawpy
        with rawpy.imread(f['raf']) as R:
            s = R.sizes; fl = s.flip
        wr, hr = (s.width, s.height) if fl not in (5, 6) else (s.height, s.width)
        from PIL import Image
        wj, hj = Image.open(f['sims']['Provia']).size
        if hr > wr and wj > hj:
            wj, hj = hj, wj
        dx, dy = (wr - wj) / 2, (hr - hj) / 2
        raw_tarefas.append((f['raf'], [(np.array(q) + [dx, dy]).tolist() for q in m]))
    with Pool(4) as pool:
        M.update(dict(pool.map(_mede_jpg, raw_tarefas)))

    # 3) por cartela: papel e referência de luz
    # Fotos com duas cartelas: esquerda = fotográfico, direita = comum. Fotos com uma só: o papel é decidido
    # comparando a saturação do Provia com a das fotos de duas cartelas de exposição mais próxima
    # (no começo da sessão as duas cartelas foram fotografadas uma de cada vez, alternando).
    sat = lambda f, c: float(np.mean(lch(lab(M[f['sims']['Provia']][c][CORES]))[:, 1]))
    duplas = [f for f in fotos if f['n_cartelas'] == 2]
    linhas = []   # (foto, papel, cartela)
    for f in fotos:
        if f['n_cartelas'] == 2:
            linhas += [(f, 'fotográfico', 0), (f, 'comum', 1)]
        elif f['n_cartelas'] == 1:
            viz = min(duplas, key=lambda d: abs(d['comp'] - f['comp']))
            s0 = sat(f, 0)
            f['papel_deduzido'] = 'fotográfico' if abs(s0 - sat(viz, 0)) < abs(s0 - sat(viz, 1)) else 'comum'
            linhas.append((f, f['papel_deduzido'], 0))
    # referência de luz: o cinza médio do RAW numa foto com as duas cartelas na exposição 0 (mesma luz para os dois papéis)
    f_ref = min(duplas, key=lambda d: abs(d['comp']))
    ref = {p: (float(M[f_ref['raf']][c][CINZA_REF] @ medir.SRGB_XYZ[1]) / 2 ** f_ref['comp'], f_ref['nome'])
           for p, c in (('fotográfico', 0), ('comum', 1))}
    rel = {'fotos': [{'nome': f['nome'], 'comp': f['comp'], 'cartelas': f['n_cartelas'], 'papel_uma_cartela': f.get('papel_deduzido'), 'simulacoes': sorted(f['sims'])} for f in fotos],
           'referencia_cinza_medio': {p: {'Y_raw_comp0': round(v, 5), 'foto': n} for p, (v, n) in ref.items()}}
    sims = [s for s in ORDEM if any(s in f['sims'] for f in fotos)] + sorted({s for f in fotos for s in f['sims']} - set(ORDEM))

    # 4) curva de tons por simulação (L* dos cinzas x luz no RAW, paradas do cinza médio)
    curvas = {}
    fig, ax = plt.subplots(1, 2, figsize=(12, 4.6), sharey=True)
    cmap = plt.get_cmap('tab20')
    for a, papel in zip(ax, ['fotográfico', 'comum']):
        for i, sim in enumerate(sims):
            xs, ys = [], []
            for f, p, c in linhas:
                if p != papel or sim not in f['sims']:
                    continue
                Y_raw = M[f['raf']][c][CINZAS] @ medir.SRGB_XYZ[1]
                xs += list(np.log2(np.maximum(Y_raw, 1e-6) / ref[papel][0])); ys += list(lab(M[f['sims'][sim]][c][CINZAS])[:, 0])
            if not xs:
                continue
            o = np.argsort(xs); xs, ys = np.array(xs)[o], np.array(ys)[o]
            g = np.round(np.arange(np.ceil(xs.min() * 2) / 2, xs.max() + 1e-9, 0.5), 2)
            sm = [float(np.median(ys[np.abs(xs - x) < 0.3])) if np.any(np.abs(xs - x) < 0.3) else None for x in g]
            curvas[f'{papel}/{sim}'] = {'paradas': g.tolist(), 'L': [None if v is None else round(v, 1) for v in sm]}
            a.plot(g, [np.nan if v is None else v for v in sm], color=cmap(i % 20), lw=1.8, label=sim)
        a.axvline(0, color='#bbb', lw=0.8, ls=':')
        a.set(title=f'Papel {papel}', xlabel='luz no RAW (paradas em relação ao cinza médio)', ylim=(0, 100))
    ax[0].set_ylabel('luminosidade na simulação (L*)'); ax[1].legend(frameon=False, fontsize=7, loc='upper left', bbox_to_anchor=(1, 1))
    fig.suptitle('Fujifilm X-T50: curva de tons das simulações', fontsize=11)
    fig.tight_layout(); fig.savefig(os.path.join(saida, 'curva_tons.png')); plt.close(fig)
    rel['curvas_tons'] = curvas

    # 5) cor na foto de exposição mais perto de 0, papel fotográfico (cartela 0): cada simulação x RAW e x Provia
    f0, _, c0 = min((t for t in linhas if t[1] == 'fotográfico' and len(t[0]['sims']) >= 12), key=lambda t: abs(t[0]['comp']))
    raw = M[f0['raf']][c0] * (0.18 / (M[f0['raf']][c0][CINZA_REF] @ medir.SRGB_XYZ[1]))
    c_raw = lch(lab(raw)); c_prov = lch(lab(M[f0['sims']['Provia']][c0]))
    cor = {'foto': f0['nome'], 'comp': f0['comp']}
    for sim in sims:
        if sim not in f0['sims']:
            continue
        v = M[f0['sims'][sim]][c0]; cs = lch(lab(v))
        d = {'cinza_medio_Lab': np.round(lab(v[CINZA_REF]), 1).tolist()}
        if sim in PB:
            # P&B: como cada cor vira cinza (L* do quadro / L* do cinza de mesma luminância no RAW)
            d['L_por_cor'] = {n: round(float(cs[i, 0]), 1) for i, n in enumerate(NOMES_CC)}
            d['L_raw_por_cor'] = {n: round(float(c_raw[i, 0]), 1) for i, n in enumerate(NOMES_CC)}
        else:
            dh = (cs[CORES, 2] - c_raw[CORES, 2] + 180) % 360 - 180
            d |= {'croma_relativo_raw': round(float(np.mean(cs[CORES, 1] / np.maximum(c_raw[CORES, 1], 1))), 3),
                  'croma_relativo_provia': round(float(np.mean(cs[CORES, 1] / np.maximum(c_prov[CORES, 1], 1))), 3),
                  'matiz_medio_abs': round(float(np.mean(np.abs(dh))), 1),
                  'por_quadro': {n: {'L': round(float(cs[i, 0]), 1), 'C': round(float(cs[i, 1]), 1), 'h': round(float(cs[i, 2]), 1),
                                     'dh_raw': round(float(dh[i]), 1)} for i, n in enumerate(NOMES_CC)}}
        cor[sim] = d
    cor['RAW (neutro)'] = {'por_quadro': {n: {'L': round(float(c_raw[i, 0]), 1), 'C': round(float(c_raw[i, 1]), 1), 'h': round(float(c_raw[i, 2]), 1)}
                                          for i, n in enumerate(NOMES_CC)}}
    rel['cor_exposicao0_papel_fotografico'] = cor
    enc = lambda v: np.clip(np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.power(np.clip(v, 0, None), 1 / 2.4) - 0.055), 0, 1)
    fileiras = [('RAW (neutro)', enc(raw[:24]))] + [(s, enc(M[f0['sims'][s]][c0][:24])) for s in sims if s in f0['sims']]
    fig, ax = plt.subplots(len(fileiras), 1, figsize=(10, 0.55 * len(fileiras) + 0.6))
    for a, (n, v) in zip(ax, fileiras):
        a.imshow(v.reshape(1, 24, 3), aspect='auto', interpolation='nearest'); a.set_xticks([]); a.set_yticks([])
        a.set_ylabel(n, rotation=0, ha='right', va='center', fontsize=8)
        for s_ in a.spines.values():
            s_.set_visible(False)
    fig.tight_layout(); fig.savefig(os.path.join(saida, 'cartela_simulacoes.png')); plt.close(fig)

    # 6) cinza médio de cada simulação em cada exposição, relativo ao Provia da mesma cartela (cancela impressão e luz)
    eq = {}
    for papel in ['fotográfico', 'comum']:
        for sim in sims:
            pts = []
            for f, p, c in sorted(linhas, key=lambda t: t[0]['comp']):
                if p == papel and sim in f['sims'] and 'Provia' in f['sims']:
                    d = lab(M[f['sims'][sim]][c][CINZA_REF]) - lab(M[f['sims']['Provia']][c][CINZA_REF])
                    pts.append({'comp': f['comp'], 'dL': round(float(d[0]), 1), 'da': round(float(d[1]), 2), 'db': round(float(d[2]), 2)})
            if pts:
                eq[f'{papel}/{sim}'] = pts
    rel['cinza_relativo_ao_provia'] = eq
    with open(os.path.join(saida, 'relatorio.json'), 'w', encoding='utf-8') as fp:
        json.dump(rel, fp, ensure_ascii=False, indent=1)
    return rel


if __name__ == '__main__':
    import multiprocessing as mp
    mp.set_start_method('forkserver')   # o rawpy pode travar com 'fork'
    extras = [tuple(a.split(':', 1)) for a in sys.argv[4:]]
    r = main(sys.argv[1], sys.argv[2], sys.argv[3], extras)
    for f in r['fotos']:
        print(f"{f['nome']}  comp {f['comp']:+.2f}  cartelas {f['cartelas']}  {f['papel_uma_cartela'] or ''}  simulações {len(f['simulacoes'])}")
    print('referência:', r['referencia_cinza_medio'])
