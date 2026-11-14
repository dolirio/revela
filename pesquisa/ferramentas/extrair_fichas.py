"""Extrai as curvas de várias fichas técnicas vetoriais (Kodak) de uma vez, com conferência visual.

Uso: python3 pesquisa/ferramentas/extrair_fichas.py <pasta-dos-pdfs> [pasta-das-conferencias]

Para cada gráfico: acha a moldura, calibra os eixos pelos rótulos numéricos com RANSAC (robusto a textos
soltos dentro do gráfico e a erros de digitação da própria ficha), extrai as curvas vetoriais e gera uma
imagem de conferência (dados em cor por cima do gráfico original). Os PDFs não ficam no repositório.
"""
import json
import math
import os
import re
import sys

import numpy as np
import pdfplumber
import pypdfium2
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vetor import polyline  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, '..', 'dados', 'fichas')

# arquivo, página (0 = primeira), tipo do gráfico, moldura aproximada (x0, topo, x1, base em pontos), opções
GRAFICOS = {
    'gold200': ('gold200.pdf', 'Kodak Gold 200', 'E-7022 (junho de 2023)', 'negativo', [
        (3, 'caracteristica', (53, 68, 270, 282), {}), (3, 'densidade', (328, 52, 547, 265), {}), (3, 'sensibilidade', (75, 318, 275, 470), {'interna': 1})]),
    'ultramax400': ('ultramax400.pdf', 'Kodak UltraMax 400', 'E-7023 (fevereiro de 2016)', 'negativo', [
        (3, 'caracteristica', (53, 102, 269, 323), {}), (3, 'densidade', (328, 101, 547, 323), {}), (3, 'sensibilidade', (43, 358, 282, 569), {})]),
    'portra160': ('portra160.pdf', 'Kodak Portra 160', 'E-4051 (janeiro de 2025)', 'negativo', [
        (3, 'caracteristica', (81, 102, 266, 287), {'interna': 1}), (3, 'densidade', (355, 101, 539, 286), {'interna': 1}),
        (3, 'sensibilidade', (74, 348, 274, 500), {'interna': 1}), (3, 'mtf', (349, 350, 551, 504), {'interna': 1})]),
    'portra800': ('portra800.pdf', 'Kodak Portra 800', 'E-4040', 'negativo', [
        (3, 'caracteristica', (53, 73, 271, 284), {}), (3, 'caracteristica_push1', (52, 310, 270, 525), {}),
        (3, 'caracteristica_push2', (329, 67, 546, 281), {}), (3, 'sensibilidade', (350, 314, 551, 465), {'interna': 1}),
        (4, 'densidade', (81, 102, 265, 286), {'interna': 1}), (4, 'mtf', (72, 346, 274, 499), {'interna': 1})]),
    'ektar100': ('ektar100.pdf', 'Kodak Ektar 100', 'E-4046 (janeiro de 2025)', 'negativo', [
        (3, 'caracteristica', (81, 108, 266, 292), {'interna': 1}), (3, 'densidade', (357, 106, 542, 290), {'interna': 1}),
        (3, 'sensibilidade', (74, 357, 275, 508), {'interna': 1}), (3, 'mtf', (348, 358, 550, 511), {'interna': 1})]),
    'vision3_500t': ('vision3_500t.pdf', 'Kodak Vision3 500T', 'H-1-5219t (2015)', 'negativo', [
        (3, 'caracteristica', (354, 122, 538, 307), {'interna': 1, 'xlado': 'cima'}),
        (3, 'sensibilidade', (353, 518, 553, 670), {'interna': 1}),
        (4, 'densidade', (82, 155, 266, 340), {'interna': 1})]),
    'ektachrome_e100': ('ektachromeE100.pdf', 'Kodak Ektachrome E100', 'E-4000 (agosto de 2018)', 'cromo', [
        (2, 'caracteristica', (369, 359, 554, 543), {'interna': 1}), (2, 'mtf', (358, 127, 560, 280), {'interna': 1}),
        (3, 'sensibilidade', (74, 107, 275, 259), {'interna': 1}), (3, 'densidade', (71, 351, 271, 500), {'interna': 1})]),
}
LOG_Y = {'mtf'}
LOG_X = {'mtf'}


def moldura(p, aprox, interna):
    if interna:
        return aprox
    x0, t0, x1, b0 = aprox
    cands = [(r['x0'], r['top'], r['x1'], r['bottom']) for r in p.rects
             if r['x0'] >= x0 - 2 and r['x1'] <= x1 + 2 and r['top'] >= t0 - 2 and r['bottom'] <= b0 + 2
             and r['width'] > 80 and (r['width'] * r['height']) < 0.93 * (x1 - x0) * (b0 - t0)]
    if cands:
        return max(cands, key=lambda r: (r[2] - r[0]) * (r[3] - r[1]))
    # sem retângulo: usa as linhas longas dentro da área
    hs = [l for l in p.lines if l['x0'] >= x0 - 2 and l['x1'] <= x1 + 2 and l['top'] >= t0 and l['bottom'] <= b0 and l['x1'] - l['x0'] > 0.5 * (x1 - x0)]
    vs = [l for l in p.lines if l['x0'] >= x0 and l['x1'] <= x1 and l['top'] >= t0 - 2 and l['bottom'] <= b0 + 2 and l['bottom'] - l['top'] > 0.5 * (b0 - t0)]
    return (min(l['x0'] for l in vs), min(l['top'] for l in hs), max(l['x0'] for l in vs), max(l['top'] for l in hs))


def ransac(pares, log=False, tol=0.025):
    """pares (posição, valor) -> função posição->valor. Escolhe a reta com mais rótulos de acordo."""
    if log:
        pares = [(p, math.log10(v)) for p, v in pares if v > 0]
    melhor = None
    for i in range(len(pares)):
        for j in range(i + 1, len(pares)):
            (p1, v1), (p2, v2) = pares[i], pares[j]
            if abs(p2 - p1) < 5 or v1 == v2:
                continue
            k = (v2 - v1) / (p2 - p1); b = v1 - k * p1
            span = abs(k) * 200
            dentro = [(p, v) for p, v in pares if abs(k * p + b - v) < tol * span]
            if not melhor or len(dentro) > len(melhor):
                melhor = dentro
    if not melhor or len(melhor) < 3:
        raise ValueError(f'rótulos insuficientes: {pares}')
    P = np.array([p for p, _ in melhor]); V = np.array([v for _, v in melhor])
    k, b = np.polyfit(P, V, 1)
    erro = float(np.max(np.abs(k * P + b - V)))
    f = (lambda p: 10 ** (k * p + b)) if log else (lambda p: k * p + b)
    return f, {'rotulos_usados': len(melhor), 'rotulos_vistos': len(pares), 'erro_max': round(erro, 4)}


def numeros(p):
    out = []
    for w in p.extract_words(keep_blank_chars=False):
        t = w['text'].replace('−', '-').replace('–', '-')
        if re.fullmatch(r'-?\d+(\.\d+)?', t):
            out.append(((w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2, float(t)))
    return out


def corrige_barra(vals):
    """Rótulos com notação de barra (3̄.0 = −3) chegam sem sinal: 3, 2, 1, 0, 1. Desce e sobe -> nega a descida."""
    v = list(vals)
    i0 = int(np.argmin(v))
    if i0 > 0 and all(v[i] > v[i + 1] for i in range(i0)) and all(x >= 0 for x in v):
        v = [-x if i < i0 else x for i, x in enumerate(v)]
    return v


def calibra(p, box, tipo, opc):
    x0, t0, x1, b0 = box
    ns = numeros(p)
    if opc.get('xlado') == 'cima':
        xs = [(x, v) for x, y, v in ns if x0 - 15 <= x <= x1 + 15 and t0 - 24 < y < t0 - 1]
    else:
        xs = [(x, v) for x, y, v in ns if x0 - 15 <= x <= x1 + 15 and b0 + 1 < y < b0 + 20]
    xs.sort()
    if tipo not in LOG_X:
        xs = list(zip([a for a, _ in xs], corrige_barra([b for _, b in xs])))
    ys = [(y, v) for x, y, v in ns if x0 - 38 < x < x0 - 1 and t0 - 9 <= y <= b0 + 9]
    fx, ix = ransac(xs, tipo in LOG_X)
    fy, iy = ransac(ys, tipo in LOG_Y)
    return fx, fy, {'x': ix, 'y': iy}


def curvas(p, box):
    x0, t0, x1, b0 = box
    out = []
    for o in p.curves:
        if o['x0'] < x0 - 1 or o['x1'] > x1 + 1 or o['top'] < t0 - 1 or o['bottom'] > b0 + 1 or o.get('fill'):
            continue
        pts = polyline(o)
        if len(pts) < 6:
            continue
        xs = [a for a, _ in pts]; ys = [b for _, b in pts]
        if max(xs) - min(xs) > 0.97 * (x1 - x0) and max(ys) - min(ys) > 0.97 * (b0 - t0) and len(pts) <= 12:
            continue   # a própria moldura
        if max(xs) - min(xs) < 0.06 * (x1 - x0):
            continue   # traços curtos (setas, marcas)
        out.append(pts)
    if not out:
        out = costura([o for o in p.curves if o.get('fill') and o['x0'] >= x0 - 1 and o['x1'] <= x1 + 1
                       and o['top'] >= t0 - 1 and o['bottom'] <= b0 + 1 and (o['x1'] - o['x0']) < 8])
    return out


def costura(segs):
    """Algumas fichas desenham as curvas como dezenas de pedacinhos preenchidos (traço convertido em contorno).
    Cada pedaço vira um segmento (ponta esquerda -> ponta direita, no meio da espessura), e os segmentos que se
    tocam são encadeados de novo numa curva."""
    pecas = []
    for o in segs:
        pts = o['pts']
        xe, xd = min(a for a, _ in pts), max(a for a, _ in pts)
        ye = np.mean([b for a, b in pts if abs(a - xe) < 0.6]); yd = np.mean([b for a, b in pts if abs(a - xd) < 0.6])
        pecas.append([(xe, ye), (xd, yd)])
    cadeias = []
    for sgm in sorted(pecas, key=lambda q: q[0][0]):
        melhor, dist = None, 1.6
        for c in cadeias:
            d = math.dist(c[-1], sgm[0])
            if d < dist:
                melhor, dist = c, d
        if melhor:
            melhor.append(sgm[1])
        else:
            cadeias.append(list(sgm))
    return [c for c in cadeias if len(c) >= 6]


def extrai(pasta, conf=None):
    os.makedirs(DADOS, exist_ok=True)
    resumo = {}
    for fid, (arq, nome, pub, classe, graficos) in GRAFICOS.items():
        pdf = pdfplumber.open(os.path.join(pasta, arq))
        doc = pypdfium2.PdfDocument(os.path.join(pasta, arq))
        d = {'filme': nome, 'publicacao': pub, 'classe': classe, 'graficos': {}}
        for pg, tipo, aprox, opc in graficos:
            p = pdf.pages[pg]
            box = moldura(p, aprox, opc.get('interna'))
            try:
                fx, fy, cal = calibra(p, box, tipo.split('_')[0], opc)
            except ValueError as e:
                print(f'!! {fid}/{tipo} moldura {[round(v) for v in box]}: {e}'); continue
            cs = curvas(p, box)
            pecas = [[(round(float(fx(x)), 4), round(float(fy(y)), 4)) for x, y in c] for c in cs]
            letras = [w for w in p.extract_words() if w['text'] in ('R', 'G', 'B') and box[0] - 5 < w['x0'] < box[2] + 25 and box[1] - 5 < w['top'] < box[3] + 5]
            rot = []
            for c in cs:   # letra mais próxima de cada curva (para MTF e curvas características)
                dist = {w['text']: min(math.dist(((w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2), q) for q in c) for w in letras}
                rot.append(min(dist, key=dist.get) if dist and min(dist.values()) < 14 else None)
            ref = None
            for w in p.extract_words(keep_blank_chars=True):
                m = re.search(r'Log H Ref:?\s*(-?\d+\.\d+)', w['text'])
                if m and box[0] - 5 < w['x0'] < box[2] and box[1] - 5 < w['top'] < box[3]:
                    ref = float(m.group(1))
            if ref is None and opc.get('xlado') == 'cima':   # Vision3: o 0 da escala "Camera Stops" é a exposição normal
                zero = [((w['x0'] + w['x1']) / 2) for w in p.extract_words() if w['text'] == '0' and box[3] < w['top'] < box[3] + 20]
                if zero:
                    ref = round(float(fx(zero[0])), 3)
            d['graficos'][tipo] = {'pagina': pg + 1, 'moldura_pt': [round(v, 1) for v in box], 'calibracao': cal, 'pecas': pecas,
                                   'letras': rot, 'logH_ref': ref}
            resumo[f'{fid}/{tipo}'] = f"{len(pecas)} peças · rótulos x {cal['x']['rotulos_usados']}/{cal['x']['rotulos_vistos']} y {cal['y']['rotulos_usados']}/{cal['y']['rotulos_vistos']} · erro {cal['x']['erro_max']}/{cal['y']['erro_max']}"
            if conf:   # conferência: redesenha as curvas extraídas (em unidades do eixo) de volta na página
                esc = 2.5
                im = doc[pg].render(scale=esc).to_pil().convert('RGB'); dr = ImageDraw.Draw(im)
                inv_x = _inverso(fx, box[0], box[2]); inv_y = _inverso(fy, box[3], box[1])
                cores = [(230, 40, 40), (30, 160, 60), (40, 80, 220), (220, 140, 0), (160, 40, 200), (0, 170, 170)]
                for i, c in enumerate(pecas):
                    dr.line([(inv_x(x) * esc, inv_y(y) * esc) for x, y in c], fill=cores[i % 6], width=3)
                m = 40
                im.crop((int((box[0] - m) * esc), int((box[1] - m) * esc), int((box[2] + m / 2) * esc), int((box[3] + m) * esc))).save(
                    os.path.join(conf, f'conf_{fid}_{tipo}.png'))
        with open(os.path.join(DADOS, fid + '_bruto.json'), 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False)
    for k, v in resumo.items():
        print(f'{k:36} {v}')


def _inverso(f, p0, p1):
    """Inverte uma calibração monotônica (valor -> posição) por interpolação."""
    a, b = min(p0, p1), max(p0, p1)
    ps = np.linspace(a - 80, b + 80, 4000); vs = np.array([f(p) for p in ps])
    o = np.argsort(vs)
    return lambda v: float(np.interp(v, vs[o], ps[o]))


if __name__ == '__main__':
    extrai(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
