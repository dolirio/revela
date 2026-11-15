"""Analisa uma sessão de fotos da cartela (RAW + simulações reveladas na câmera).

Uso: python3 referencias/analisar_sessao.py <pasta-das-fotos> <pasta-de-saida> [nome-da-sessao] [papeis.json]

1. Lê os dados internos de cada arquivo (exiftool): simulação (ImageTone), hora da foto de origem,
   compensação de exposição. As simulações reveladas na câmera guardam a hora do RAW de origem.
2. Mede a cartela em cada arquivo. As simulações usam as marcas do JPG da própria câmera daquela foto
   (mesmo enquadramento), o que resolve fotos escuras demais para achar as marcas.
3. Descobre o papel de cada foto pela saturação (o sulfite deixa as cores mais fracas).
4. Gera: curva de tons por simulação, equilíbrio do cinza por exposição, cor por quadro, e um relatório.
"""
import glob
import json
import os
import subprocess
import sys
from collections import defaultdict

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import medir  # noqa: E402

plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False, 'figure.dpi': 110})
Q = medir.MAPA['quadros']
IDX = {(q['grupo'], q.get('i')): k for k, q in enumerate(Q)}
CINZA_REF = IDX[('colorchecker', 21)]          # "cinza 5" do ColorChecker: o cinza médio
CINZAS = [IDX[('colorchecker', i)] for i in range(18, 24)] + [IDX[('cinzas', i)] for i in range(12)]
CORES = list(range(18))                          # os 18 quadros coloridos do ColorChecker
NOMES_CC = ['pele escura', 'pele clara', 'céu', 'folhagem', 'flor azul', 'verde-água', 'laranja', 'azul arroxeado',
            'vermelho médio', 'roxo', 'verde-limão', 'amarelo-laranja', 'azul', 'verde', 'vermelho', 'amarelo', 'magenta', 'ciano']
COR_SIM = {'Standard': '#444', 'Negative Film': '#c2702a', 'Positive Film': '#2a6fc2', 'Retro': '#8a6d3b',
           'Bleach Bypass 2': '#6b8a8a', 'Cross Processing 2': '#9b3fa0'}


def exif(pasta):
    saida = subprocess.run(['exiftool', '-q', '-j', '-FileName', '-DateTimeOriginal', '-ImageTone', '-ExposureCompensation',
                            '-ExposureTime', '-FNumber', '-ISO'] + sorted(glob.glob(os.path.join(pasta, 'R*.*'))),
                           capture_output=True, text=True).stdout
    return [d for d in json.loads(saida) if d['FileName'].upper().endswith(('.JPG', '.DNG'))]


def medidas(pasta, inv):
    grupos = defaultdict(list)
    for d in inv:
        grupos[d['DateTimeOriginal']].append(d)
    res = {}
    for hora, ds in grupos.items():
        dng = next(d for d in ds if d['FileName'].upper().endswith('.DNG'))
        base = dng['FileName'][:-4]
        jpg_cam = os.path.join(pasta, base + '.JPG')
        m_cam = json.load(open(jpg_cam + '.medidas.json')) if os.path.exists(jpg_cam + '.medidas.json') else medir.mede(jpg_cam)
        for d in ds:
            p = os.path.join(pasta, d['FileName'])
            if d['FileName'].upper().endswith('.DNG'):
                m = json.load(open(p + '.medidas.json')) if os.path.exists(p + '.medidas.json') else medir.mede(p)
                # conferência: o brilho dos quadros no RAW tem de acompanhar o JPG da câmera; se não, as marcas
                # do RAW saíram trocadas e usamos as do JPG (mesma foto, mesmo enquadramento, escala ajustada)
                a = np.array([q['linear'] for q in m['quadros']]).mean(1); b = np.array([q['linear'] for q in m_cam['quadros']]).mean(1)
                if np.corrcoef(np.log(a + 1e-4), np.log(b + 1e-4))[0, 1] < 0.95:
                    h_raw, w_raw = medir.abre(p).shape[:2]
                    h_jpg, w_jpg = medir.abre(jpg_cam).shape[:2]
                    marcas = np.array(m_cam['marcas_px']) * [w_raw / w_jpg, h_raw / h_jpg]
                    m = medir.mede(p, marcas.tolist())
                    print('  marcas do RAW refeitas pelo JPG:', d['FileName'])
            else:
                m = medir.mede(p, m_cam['marcas_px'])     # mesmas marcas da foto de origem
            res[d['FileName']] = np.array([q['linear'] for q in m['quadros']])
    return grupos, res


def lab(lin):
    return medir.lab(np.clip(lin, 0, None))


def lch(L):
    return np.stack([L[..., 0], np.hypot(L[..., 1], L[..., 2]), np.degrees(np.arctan2(L[..., 2], L[..., 1])) % 360], -1)


def main(pasta, saida, nome='sessão', papeis=None):
    os.makedirs(saida, exist_ok=True)
    inv = exif(pasta)
    grupos, M = medidas(pasta, inv)
    # ---- cada foto de origem: exposição, papel
    fotos = []
    for hora, ds in sorted(grupos.items()):
        dng = next(d for d in ds if d['FileName'].upper().endswith('.DNG'))
        cam = dng['FileName'][:-4] + '.JPG'
        sat = float(np.mean(lch(lab(M[cam][CORES]))[:, 1]))
        fotos.append({'hora': hora, 'dng': dng['FileName'], 'comp': float(dng.get('ExposureCompensation', 0) or 0),
                      'sat_std': sat, 'sims': {d['ImageTone']: d['FileName'] for d in ds if d['FileName'] != dng['FileName']}})
    # papel: o sulfite deixa as cores bem mais fracas. Separa as fotos em dois grupos pela saturação do JPG Standard
    # (o ponto de corte é o maior salto entre valores ordenados), comparando só fotos de mesma exposição
    sats = sorted(f['sat_std'] for f in fotos)
    saltos = [sats[i + 1] - sats[i] for i in range(len(sats) - 1)]
    corte = (sats[int(np.argmax(saltos))] + sats[int(np.argmax(saltos)) + 1]) / 2 if saltos else 0
    for f in fotos:
        f['papel'] = 'fotográfico' if f['sat_std'] > corte else 'comum'
    # anotações do fotógrafo, quando existem, têm prioridade sobre a dedução
    if papeis:
        for f in fotos:
            f['papel'] = papeis.get(f['dng'], f['papel'])
    # referência de luz: o cinza médio do RAW na exposição 0 de cada papel
    ref = {}
    for f in fotos:
        if f['comp'] == 0 and f['papel'] not in ref:
            ref[f['papel']] = float(M[f['dng']][CINZA_REF] @ medir.SRGB_XYZ[1])
    rel = {'sessao': nome, 'fotos': [{k: v for k, v in f.items() if k != 'sims'} | {'simulacoes': f['sims']} for f in fotos]}

    # ---- 1) curva de tons: brilho na simulação x luz no RAW (em paradas do cinza médio)
    sims_principais = ['Standard', 'Negative Film', 'Positive Film']
    fig, ax = plt.subplots(1, 2, figsize=(11, 4.2), sharey=True)
    curvas = {}
    for a, papel in zip(ax, ['fotográfico', 'comum']):
        for sim in sims_principais:
            xs, ys = [], []
            for f in fotos:
                if f['papel'] != papel or sim not in f['sims']:
                    continue
                Y_raw = M[f['dng']][CINZAS] @ medir.SRGB_XYZ[1]
                L_sim = lab(M[f['sims'][sim]][CINZAS])[:, 0]
                xs += list(np.log2(np.maximum(Y_raw, 1e-6) / ref[papel])); ys += list(L_sim)
            if xs:
                o = np.argsort(xs); xs, ys = np.array(xs)[o], np.array(ys)[o]
                a.plot(xs, ys, 'o', ms=3, alpha=0.5, color=COR_SIM[sim])
                # curva suave (média móvel em paradas)
                g = np.linspace(xs.min(), xs.max(), 60); sm = [np.median(ys[np.abs(xs - x) < 0.35]) if np.any(np.abs(xs - x) < 0.35) else np.nan for x in g]
                a.plot(g, sm, color=COR_SIM[sim], lw=2, label=sim)
                curvas[f'{papel}/{sim}'] = {'paradas': np.round(g, 2).tolist(), 'L': np.round(sm, 1).tolist()}
        a.axvline(0, color='#bbb', lw=0.8, ls=':')
        a.set(title=f'Papel {papel}', xlabel='luz no RAW (paradas em relação ao cinza médio)', ylim=(0, 100))
        a.legend(frameon=False, fontsize=8)
    ax[0].set_ylabel('luminosidade na simulação (L*)')
    fig.suptitle(f'Ricoh GR IIIx: curva de tons ({nome})', fontsize=11)
    fig.tight_layout(); fig.savefig(os.path.join(saida, 'curva_tons.png')); plt.close(fig)
    rel['curvas_tons'] = curvas

    # ---- 2) equilíbrio do cinza em cada exposição (a*, b* do cinza médio)
    fig, ax = plt.subplots(1, 2, figsize=(11, 3.8), sharey=True)
    eq = {}
    for a, papel in zip(ax, ['fotográfico', 'comum']):
        for sim in sims_principais:
            pts = sorted(((f['comp'], lab(M[f['sims'][sim]][CINZA_REF])) for f in fotos if f['papel'] == papel and sim in f['sims']), key=lambda t: t[0])
            if not pts:
                continue
            c = [p[0] for p in pts]; A = [p[1][1] for p in pts]; B = [p[1][2] for p in pts]
            a.plot(c, B, '-o', color=COR_SIM[sim], lw=2, ms=4, label=f'{sim}: b* (+ amarelo)')
            a.plot(c, A, '--', color=COR_SIM[sim], lw=1.2, label=f'{sim}: a* (+ magenta)')
            eq[f'{papel}/{sim}'] = {'comp': c, 'a': np.round(A, 2).tolist(), 'b': np.round(B, 2).tolist()}
        a.axhspan(-2, 2, color='#eee'); a.axhline(0, color='#bbb', lw=0.8)
        a.set(title=f'Papel {papel}', xlabel='compensação de exposição (paradas)')
    ax[0].set_ylabel('desvio de cor do cinza médio'); ax[1].legend(frameon=False, fontsize=7, loc='upper left', bbox_to_anchor=(1, 1))
    fig.tight_layout(); fig.savefig(os.path.join(saida, 'equilibrio_cinza.png')); plt.close(fig)
    rel['equilibrio_cinza'] = eq
    # o cinza impresso não é neutro (a impressora deixa um tom): o que interessa é a diferença para o Standard
    # da MESMA foto, que cancela a cor da impressão e da luz
    relativo = {}
    for papel in ['fotográfico', 'comum']:
        for sim in ['Negative Film', 'Positive Film']:
            linhas = []
            for f in sorted(fotos, key=lambda f: f['comp']):
                if f['papel'] == papel and sim in f['sims'] and 'Standard' in f['sims']:
                    d = lab(M[f['sims'][sim]][CINZA_REF]) - lab(M[f['sims']['Standard']][CINZA_REF])
                    linhas.append((f['comp'], round(float(d[1]), 2), round(float(d[2]), 2), round(float(d[0]), 1)))
            relativo[f'{papel}/{sim}'] = [{'comp': c, 'da': a, 'db': b, 'dL': L} for c, a, b, L in linhas]
    rel['cinza_relativo_ao_standard'] = relativo

    # ---- 3) cor na exposição 0, papel fotográfico: o que cada simulação faz em relação ao RAW
    f0 = next(f for f in fotos if f['comp'] == 0 and f['papel'] == 'fotográfico' and len(f['sims']) > 3)
    raw = M[f0['dng']] * (0.18 / (M[f0['dng']][CINZA_REF] @ medir.SRGB_XYZ[1]))
    c_raw = lch(lab(raw))
    cor = {}
    linhas = []
    for sim, arq in sorted(f0['sims'].items()):
        c_s = lch(lab(M[arq]))
        dh = (c_s[CORES, 2] - c_raw[CORES, 2] + 180) % 360 - 180
        cor[sim] = {'arquivo': arq, 'croma_relativo': round(float(np.mean(c_s[CORES, 1] / np.maximum(c_raw[CORES, 1], 1))), 3),
                    'matiz_medio_abs': round(float(np.mean(np.abs(dh))), 1),
                    'por_quadro': {n: {'L': round(float(c_s[i, 0]), 1), 'C': round(float(c_s[i, 1]), 1), 'h': round(float(c_s[i, 2]), 1),
                                       'dh': round(float(dh[i]), 1)} for i, n in enumerate(NOMES_CC)}}
        linhas.append((sim, c_s))
    cor['RAW (neutro)'] = {'por_quadro': {n: {'L': round(float(c_raw[i, 0]), 1), 'C': round(float(c_raw[i, 1]), 1), 'h': round(float(c_raw[i, 2]), 1)}
                                          for i, n in enumerate(NOMES_CC)}}
    rel['cor_exposicao0_papel_fotografico'] = cor
    # folha visual: os 24 quadros do ColorChecker em cada simulação
    enc = lambda v: np.clip(np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.power(np.clip(v, 0, None), 1 / 2.4) - 0.055), 0, 1)
    fileiras = [('RAW (neutro)', enc(raw[:24]))] + [(s, enc(M[a][:24])) for s, a in sorted(f0['sims'].items())]
    fig, ax = plt.subplots(len(fileiras), 1, figsize=(10, 0.62 * len(fileiras) + 0.6))
    for a, (n, v) in zip(ax, fileiras):
        a.imshow(v.reshape(1, 24, 3), aspect='auto', interpolation='nearest'); a.set_xticks([]); a.set_yticks([])
        a.set_ylabel(n, rotation=0, ha='right', va='center', fontsize=8)
        for s in a.spines.values():
            s.set_visible(False)
    fig.tight_layout(); fig.savefig(os.path.join(saida, 'cartela_simulacoes.png')); plt.close(fig)

    with open(os.path.join(saida, 'relatorio.json'), 'w', encoding='utf-8') as fp:
        json.dump(rel, fp, ensure_ascii=False, indent=1)
    return rel


if __name__ == '__main__':
    papeis = json.load(open(sys.argv[4], encoding='utf-8')) if len(sys.argv) > 4 else None
    r = main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'sessão', papeis)
    for f in r['fotos']:
        print(f"{f['dng']}  comp {f['comp']:+.0f}  papel {f['papel']:12} sat_std {f['sat_std']:.1f}  sims {len(f['simulacoes'])}")
    for s, v in r['cor_exposicao0_papel_fotografico'].items():
        if 'croma_relativo' in v:
            pq = v['por_quadro']
            print(f"{s:20} croma {v['croma_relativo']:.2f} matiz {v['matiz_medio_abs']:4.1f}° | pele clara h {pq['pele clara']['h']:.0f} C {pq['pele clara']['C']:.0f} | pele escura h {pq['pele escura']['h']:.0f} C {pq['pele escura']['C']:.0f} | céu h {pq['céu']['h']:.0f}")
    raw = r['cor_exposicao0_papel_fotografico']['RAW (neutro)']['por_quadro']
    print(f"{'RAW':20} pele clara h {raw['pele clara']['h']:.0f} C {raw['pele clara']['C']:.0f} | pele escura h {raw['pele escura']['h']:.0f} C {raw['pele escura']['C']:.0f} | céu h {raw['céu']['h']:.0f}")
