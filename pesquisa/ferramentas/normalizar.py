"""Organiza as curvas brutas (dados/fichas/*_bruto.json) no formato que o motor lê (dados/<filme>.json).

Uso: python3 pesquisa/ferramentas/normalizar.py

Regras de identificação, todas físicas ou escritas na própria ficha:
- curvas características: no negativo, a base (Dmin) cresce R < G < B por causa da máscara laranja; no cromo,
  a densidade máxima cresce R < G < B. Confere com as letras impressas ao lado das curvas.
- sensibilidade: cada peça vai para a camada do seu pico (< 490 nm azul, 490–590 nm verde, > 590 nm vermelho);
  peças da mesma camada são unidas pelo máximo.
- densidade espectral: a curva mais alta é o neutro; corantes publicados separados têm pico perto de 1.
- MTF: pelas letras impressas no fim de cada curva.
"""
import glob
import json
import os

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, '..', 'dados')


def rs(c, grade):
    c = sorted(c); x = np.array([a for a, _ in c]); y = np.array([b for _, b in c])
    _, i = np.unique(x, return_index=True)
    return np.interp(grade, x[i], y[i], left=np.nan, right=np.nan)


def lst(v, nd=3):
    return [None if np.isnan(a) else round(float(a), nd) for a in v]


def caracteristica(g, classe):
    pecas = sorted(g['pecas'], key=len, reverse=True)[:3]
    if classe == 'cromo':
        ordem = sorted(pecas, key=lambda c: max(v for _, v in c))
    else:
        ordem = sorted(pecas, key=lambda c: min(v for _, v in c))
    canais = dict(zip('RGB', ordem))
    # conferência com as letras impressas
    letras = {id(c): l for c, l in zip(g['pecas'], g['letras'])}
    concordam = sum(1 for k, c in canais.items() if letras.get(id(c)) == k)
    lo = min(min(a for a, _ in c) for c in pecas); hi = max(max(a for a, _ in c) for c in pecas)
    LH = np.round(np.arange(np.ceil(lo * 20) / 20, hi, 0.05), 2)
    out = {'eixo_x': 'log H (lux·s)', 'logH': LH.tolist(), 'logH_ref': g.get('logH_ref'),
           'letras_concordam': f'{concordam}/3'}
    resumo = {}
    for k, c in canais.items():
        y = rs(c, LH); out[k] = lst(y)
        sl = np.gradient(y, LH)
        resumo[k] = {'dmin': round(float(np.nanmin(y)), 3), 'dmax': round(float(np.nanmax(y)), 3),
                     'gama_medio': round(float(np.nanmedian(np.abs(sl[np.abs(sl) > 0.15]))), 3) if np.any(np.abs(sl) > 0.15) else None}
    out['resumo'] = resumo
    return out


def sensibilidade(g):
    NM = np.arange(350, 721, 5)
    camadas = {}
    for c in g['pecas']:
        pico = max(c, key=lambda t: t[1])[0]
        k = 'azul (forma amarelo)' if pico < 490 else 'verde (forma magenta)' if pico < 590 else 'vermelho (forma ciano)'
        y = rs(c, NM)
        camadas[k] = y if k not in camadas else np.fmax(camadas[k], y)
    return {'eixo_y': 'log sensibilidade (1/(erg/cm²))', 'nm': NM.tolist(), **{k: lst(v) for k, v in sorted(camadas.items())}}


def densidade(g, fid):
    NM = np.arange(400, 801 if fid == 'vision3_500t' else 701, 5)
    pecas = g['pecas']
    picos = [(max(c, key=lambda t: t[1])) for c in pecas]
    out = {'eixo_y': 'densidade difusa', 'nm': NM.tolist()}
    neutro = max(range(len(pecas)), key=lambda i: np.mean([v for _, v in pecas[i]]))
    out['neutro_meio_tom'] = lst(rs(pecas[neutro], NM))
    resto = [i for i in range(len(pecas)) if i != neutro]
    corantes = []
    if len(pecas) > 2:   # corantes publicados separados: em cada faixa, a peça com pico mais perto de 1
        for nome, a, b in (('amarelo', 0, 500), ('magenta', 500, 600), ('ciano', 600, 900)):
            cand = [i for i in resto if a <= picos[i][0] < b and 0.8 < picos[i][1] < 1.15]
            if cand:
                i = min(cand, key=lambda i: abs(picos[i][1] - 1)); corantes.append(i)
                out['corante_' + nome] = lst(rs(pecas[i], NM))
    outros = [i for i in resto if i not in corantes]
    if outros:
        out['dmin'] = lst(rs(pecas[min(outros, key=lambda i: np.mean([v for _, v in pecas[i]]))], NM))
    return out


def mtf(g):
    F = np.array([2.5, 5, 10, 20, 40, 60, 80])
    out = {'ciclos_mm': F.tolist()}
    for c, k in zip(g['pecas'], g['letras']):
        if k:
            c = sorted(c)
            out[k] = [round(float(v), 1) for v in np.interp(np.log10(F), np.log10([a for a, _ in c]), [b for _, b in c], left=np.nan, right=np.nan)]
    return out


def main():
    for f in sorted(glob.glob(os.path.join(DADOS, 'fichas', '*_bruto.json'))):
        fid = os.path.basename(f)[:-11]
        b = json.load(open(f, encoding='utf-8'))
        d = {'filme': b['filme'], 'classe': b['classe'], 'fonte': f"Kodak, publicação {b['publicacao']}",
             'metodo': 'vetores do PDF; eixos por RANSAC sobre os rótulos; conferência visual em pesquisa/figuras/fichas/'}
        for tipo, g in b['graficos'].items():
            if tipo.startswith('caracteristica'):
                d[tipo] = caracteristica(g, b['classe'])
            elif tipo == 'sensibilidade':
                d['sensibilidade'] = sensibilidade(g)
            elif tipo == 'densidade':
                d['densidade_espectral'] = densidade(g, fid)
            elif tipo == 'mtf':
                d['mtf'] = mtf(g)
        with open(os.path.join(DADOS, fid + '.json'), 'w', encoding='utf-8') as fp:
            json.dump(d, fp, ensure_ascii=False, indent=1)
        c = d['caracteristica']
        print(f"{fid:16} ref {c['logH_ref']}  letras {c['letras_concordam']}  "
              + '  '.join(f"{k}: dmin {v['dmin']} gama {v['gama_medio']}" for k, v in c['resumo'].items())
              + f"  | sens: {len([k for k in d.get('sensibilidade', {}) if '(' in k])} camadas"
              + f"  | dens: {[k for k in d.get('densidade_espectral', {}) if k not in ('eixo_y', 'nm')]}")


if __name__ == '__main__':
    main()
