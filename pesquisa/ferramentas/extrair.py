"""Extrai os dados das fichas técnicas para pesquisa/dados/*.json.

Uso:
    python3 pesquisa/ferramentas/extrair.py <pasta-com-os-pdfs>

Os PDFs não ficam no repositório (são da Kodak Alaris). Baixe-os das fontes oficiais:
    e4050.pdf  Portra 400        https://www.freestylephoto.com/static/pdf/product_pdf/kodak/e4050_Kodak_Portra_400.pdf
    e4070.pdf  Endura Premier    https://business.kodakmoments.com/sites/default/files/files/products/e4070.pdf

Os gráficos dessas fichas são vetoriais: as curvas são lidas direto do desenho do PDF, sem digitalizar à mão.
Os eixos são calibrados pelos traços de escala do próprio gráfico (posição em pontos -> valor do eixo).
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from vetor import axis, chart, curves_in, pdfplumber  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, '..', 'dados')


def reamostra(c, grade):
    c = sorted(c)
    x = np.array([a for a, _ in c]); y = np.array([b for _, b in c])
    return np.interp(grade, x, y, left=np.nan, right=np.nan)


def lista(v, nd=3):
    return [None if np.isnan(a) else round(float(a), nd) for a in v]


def em_unidades(cs, fx, fy):
    return [[(fx(x), fy(y)) for x, y in c] for c in cs]


def portra400(pasta):
    p = pdfplumber.open(os.path.join(pasta, 'e4050.pdf')).pages[3]
    out = {
        'filme': 'Kodak Professional Portra 400',
        'fonte': 'Kodak Alaris, publicação E-4050, janeiro de 2025, página 4',
        'metodo': 'vetores do PDF; eixos calibrados pelos traços de escala; ver pesquisa/figuras/portra400_conferencia.png',
    }
    # 1) curvas características (traços: logH -3,-2,-1,0 em x; densidade 1,2,3 em y)
    cs = em_unidades(curves_in(p, (81, 102, 266, 288)), axis(118.05, -3, 228.74, 0), axis(241.25, 1, 148.97, 3))
    cs.sort(key=lambda c: c[0][1])          # menor densidade de base = vermelho
    LH = np.round(np.arange(-3.40, 0.56, 0.05), 2)
    car = {'eixo_x': 'log H (lux·s)', 'eixo_y': 'densidade Status M', 'luz': 'luz do dia', 'logH_ref': -1.44, 'logH': LH.tolist()}
    resumo = {}
    for k, c in zip('RGB', cs):
        y = reamostra(c, LH); car[k] = lista(y)
        trecho = (LH > -1.5) & (LH < 0.4)
        dmin = float(np.nanmin(y))
        resumo[k] = {
            'dmin': round(dmin, 3),
            'gama': round(float(np.nanmean(np.gradient(y, LH)[trecho])), 3),
            'densidade_na_ref': round(float(np.interp(-1.44, LH, y)), 3),
            'pe_comeca_em_logH': float(LH[np.argmax(y > dmin + 0.1)]),
        }
    car['resumo'] = resumo
    out['caracteristica'] = car

    # 2) sensibilidade espectral (grade: 300 nm a 700 nm; log sensibilidade 1 e 3)
    cs = em_unidades(curves_in(p, (76, 343, 277, 495)), axis(96.25, 300, 256.65, 700), axis(456.67, 1, 380.95, 3))
    NM = np.arange(380, 705, 5)
    nomes = {}
    for c in cs:   # identifica cada camada pelo comprimento de onda do pico
        pico = max(c, key=lambda t: t[1])[0]
        nomes['azul (forma amarelo)' if pico < 480 else 'verde (forma magenta)' if pico < 600 else 'vermelho (forma ciano)'] = c
    out['sensibilidade'] = {'eixo_y': 'log sensibilidade, 1/(erg/cm²) para D = Dmin + 0,2', 'nm': NM.tolist(),
                            **{n: lista(reamostra(c, NM)) for n, c in sorted(nomes.items())}}

    # 3) densidade espectral (Dmin e neutro de meio-tom)
    cs = em_unidades(curves_in(p, (357, 100, 543, 289), 20), axis(357.52, 400, 541.83, 700), axis(251.2, 0.5, 140.57, 2.0))
    cs.sort(key=lambda c: np.mean([v for _, v in c]))
    NM = np.arange(400, 701, 5)
    out['densidade_espectral'] = {'eixo_y': 'densidade difusa', 'nm': NM.tolist(),
                                  'dmin': lista(reamostra(cs[0], NM)), 'neutro_meio_tom': lista(reamostra(cs[1], NM))}

    # 4) MTF (eixos logarítmicos)
    cs = em_unidades(curves_in(p, (348, 345, 552, 512)), axis(421.6, 10, 494.72, 100, log=True), axis(367.12, 100, 439.21, 10, log=True))
    F = np.array([2.5, 5, 10, 20, 40, 60, 80])
    cs.sort(key=lambda c: -c[-1][1])   # no fim da curva: azul > verde > vermelho
    mtf = {'ciclos_mm': F.tolist()}
    for k, c in zip('BGR', cs):
        c = sorted(c)
        mtf[k] = [round(float(v), 1) for v in np.interp(np.log10(F), np.log10([a for a, _ in c]), [b for _, b in c])]
    out['mtf'] = mtf
    return out


def endura_premier(pasta):
    pdf = pdfplumber.open(os.path.join(pasta, 'e4070.pdf'))
    out = {'papel': 'Kodak Professional Endura Premier', 'fonte': 'Kodak Alaris, publicação E-4070, dezembro de 2017, páginas 4 e 5',
           'metodo': 'vetores do PDF; eixos calibrados pelos rótulos numéricos (erro de ajuste < 0,015)'}
    cs, _ = chart(pdf.pages[3], (363, 70, 551, 257))
    cs.sort(key=lambda c: -max(v for _, v in c))   # densidade máxima: R > G > B
    LH = np.round(np.arange(-3.0, 0.0, 0.025), 3)
    car = {'eixo_x': 'log H (lux·s)', 'eixo_y': 'densidade Status A', 'processo': 'RA-4', 'logH': LH.tolist()}
    resumo = {}
    for k, c in zip('RGB', cs):
        y = reamostra(c, LH); car[k] = lista(y)
        resumo[k] = {'dmin': round(float(np.nanmin(y)), 3), 'dmax': round(float(np.nanmax(y)), 3),
                     'gama_maximo': round(float(np.nanmax(np.gradient(y, LH))), 2),
                     'logH_para_D1': round(float(np.interp(1.0, y, LH)), 3)}
    car['resumo'] = resumo
    out['caracteristica'] = car

    cs, _ = chart(pdf.pages[4], (86, 48, 276, 237))
    cs.sort(key=lambda c: max(c, key=lambda t: t[1])[0])
    NM = np.arange(400, 701, 5)
    out['corantes'] = {'nm': NM.tolist(), **{n: lista(reamostra(c, NM)) for n, c in zip(['amarelo', 'magenta', 'ciano'], cs)}}

    cs, _ = chart(pdf.pages[3], (348, 314, 553, 467))
    cs.sort(key=lambda c: c[0][0])
    NM = np.arange(350, 721, 5)
    out['sensibilidade'] = {'eixo_y': 'log sensibilidade', 'nm': NM.tolist(),
                            **{n: lista(reamostra(c, NM)) for n, c in zip(['azul (forma amarelo)', 'verde (forma magenta)', 'vermelho (forma ciano)'], cs)}}
    return out


if __name__ == '__main__':
    pasta = sys.argv[1]
    for nome, f in (('portra400', portra400), ('endura_premier', endura_premier)):
        d = f(pasta)
        with open(os.path.join(DADOS, nome + '.json'), 'w', encoding='utf-8') as fp:
            json.dump(d, fp, ensure_ascii=False, indent=1)
        print('gravado', nome)
