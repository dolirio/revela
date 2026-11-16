"""Os 6 filmes do app (decisão de 17/11/2026, pesquisa/filmes_finais.md): cada um é um filme do motor espectral
(a física) + uma identidade (curva, cor por faixa, tom nas sombras e nas luzes), assada numa única tabela 3D.
O grão não vai na tabela: é o grão do app, com a quantidade padrão de cada filme.

Uso: python3 pesquisa/motor/filmes_finais.py   (depois de pesquisa/motor/exportar.py, que gera as bases)
"""
import json, os, sys
import numpy as np
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.join(AQUI, '..', '..')
sys.path.insert(0, os.path.join(RAIZ, 'pesquisa', 'ferramentas')); sys.path.insert(0, os.path.join(RAIZ, 'referencias'))
import conferir_assinatura as CA  # noqa: E402
F = os.path.join(RAIZ, 'novo', 'filmes')
dec = lambda v: np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
enc = lambda v: np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.clip(v, 0, None) ** (1 / 2.4) - 0.055)
M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]); Mi = np.linalg.inv(M); W = M.sum(1)


def lab(lin):
    t = (lin @ M.T) / W; f = np.where(t > 0.008856, np.cbrt(np.maximum(t, 0)), 7.787 * t + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab2lin(L):
    fy = (L[..., 0] + 16) / 116; f = np.stack([fy + L[..., 1] / 500, fy, fy - L[..., 2] / 200], -1)
    return (np.where(f > 0.2069, f ** 3, (f - 16 / 116) / 7.787) * W) @ Mi.T


def base(lin, arq):
    meta = json.load(open(os.path.join(F, arq.split('.')[0] + '.json'))); t = meta['tabela']; n = t['n']
    lut = np.fromfile(os.path.join(F, arq + '.bin'), '<u2').astype(float).reshape(n, n, n, 3) / 65535
    g = CA.filme(np.full(3, 0.18), lut, t)
    return CA.filme(lin, lut, t) * ((g @ [0.2126, 0.7152, 0.0722]) / g), meta


def curva(v, A):
    piv, k = A.get('piv', 0.45), A.get('contraste', 1.0); x = np.clip(v, 0, 1)
    s = np.where(x < piv, piv * (x / piv) ** k, 1 - (1 - piv) * ((1 - x) / (1 - piv)) ** k)
    return A.get('preto', 0.0) + (A.get('branco', 1.0) - A.get('preto', 0.0)) * s


def identidade(x, A):
    if A.get('pb'):
        x = np.repeat((x @ [0.2126, 0.7152, 0.0722])[..., None], 3, -1)
    x = x * np.array(A.get('calor', [1, 1, 1]))
    v = enc(np.clip(x, 0, 1)); v = np.stack([curva(v[..., i], A) for i in range(3)], -1)
    L = lab(dec(v)); C = np.hypot(L[..., 1], L[..., 2]); h = np.degrees(np.arctan2(L[..., 2], L[..., 1])) % 360
    sat = A.get('sat', 1.0) * np.ones_like(C)
    for hc, dh, ds, w in A.get('faixas', []):      # (matiz central, giro em graus, ganho de croma, largura); luzes altas protegidas
        d = (h - hc + 180) % 360 - 180; g = np.exp(-0.5 * (d / w) ** 2) * np.clip(1 - (L[..., 0] / 100) ** 3, 0, 1)
        h = h + dh * g; sat = sat * (1 + (ds - 1) * g)
    C = C * sat; Ln = np.clip(L[..., 0] / 100, 0, 1)
    a = C * np.cos(np.radians(h)); b = C * np.sin(np.radians(h))
    sa, sb = A.get('sombra', (0, 0)); la, lb = A.get('luz', (0, 0))
    a = a + sa * (1 - Ln) ** 2 + la * Ln ** 2; b = b + sb * (1 - Ln) ** 2 + lb * Ln ** 2
    return enc(np.clip(lab2lin(np.stack([L[..., 0], a, b], -1)), 0, 1))


FILMES = [
    dict(id='portrait400', nome='Portrait 400', inspirado='Kodak Portra 400', base='kp400', grao=0.22,
         nota='luz dourada, pele que brilha, verdes quentes', calor=[1.08, 1.0, 0.88], contraste=1.16, preto=0.02, branco=0.985, sat=1.10,
         faixas=[(55, 6, 1.18, 22), (115, -12, 0.95, 30), (250, -6, 0.95, 30)], sombra=(1, -1), luz=(3, 14)),
    dict(id='chrome100', nome='Chrome 100', inspirado='Kodak Ektar 100', base='ke100', grao=0.12,
         nota='cor densa, azul profundo, contraste firme', calor=[0.98, 1.0, 1.03], contraste=1.35, preto=0.0, branco=1.0, sat=1.15,
         faixas=[(270, -8, 1.35, 30), (35, 0, 0.82, 18), (60, 0, 0.9, 20)], sombra=(-1, -5), luz=(0, 1)),
    dict(id='pro400', nome='Pro 400', inspirado='Fuji Pro 400H', base='kp160', grao=0.18,
         nota='verdes para o ciano, ar leve, brancos limpos', calor=[0.97, 1.0, 1.03], contraste=1.04, preto=0.05, branco=1.0, sat=1.0,
         faixas=[(135, 30, 1.2, 26), (230, -10, 1.15, 30), (40, -6, 0.9, 20)], sombra=(-6, -2), luz=(-2, 1)),
    dict(id='tungsten800', nome='Tungsten 800', inspirado='CineStill 800T', base='cs800t', grao=0.32,
         nota='noite de cinema: sombras azul-petróleo, luzes laranja com halo', contraste=1.3, preto=0.015, branco=0.99, sat=1.12,
         faixas=[(60, -10, 1.2, 25), (250, -14, 1.2, 35), (130, 25, 0.8, 35)], sombra=(-13, -15), luz=(9, 15)),
    dict(id='silver400', nome='Silver 400', inspirado='Kodak Tri-X 400 com filtro laranja', base='kx400.laranja', grao=0.40,
         nota='preto e branco épico: pretos profundos, céus dramáticos', pb=True, contraste=1.45, preto=0.0, branco=1.0, piv=0.42),
    dict(id='silverportrait', nome='Silver Portrait', inspirado='retrato P&B de Peter Lindbergh', base='lb', grao=0.25,
         nota='preto e branco íntimo: o rosto em destaque · marque o rosto em Ajustes', pb=True),
]

if __name__ == '__main__':
    N, MIN, MAX = 33, -9.0, 7.0
    g = np.linspace(0, 1, N); b, gg, r = np.meshgrid(g, g, g, indexing='ij')
    x = 0.18 * 2.0 ** (MIN + np.stack([r, gg, b], -1).reshape(-1, 3) * (MAX - MIN))
    for A in FILMES:
        y, mb = base(x, A['base'])
        out = identidade(y, A)
        np.round(np.clip(out, 0, 1) * 65535).astype('<u2').tofile(os.path.join(F, A['id'] + '.bin'))
        mid = identidade(base(np.full((1, 3), 0.18), A['base'])[0], A)[0]
        an = dict(mb['analogico']); an['grao'] = A['grao']
        meta = {'id': A['id'], 'nome': A['nome'], 'inspirado': A['inspirado'], 'cat': 'pb' if A.get('pb') else 'cor', 'nota': A['nota'],
                'analogico': an, 'labs': ['neutro'], 'tabela': mb['tabela'], 'cinza_medio_saida': [round(float(v), 4) for v in mid]}
        if 'retrato' in mb:
            meta['retrato'] = mb['retrato']
        else:   # separação do rosto em qualquer filme: luz da cena que sai com a pele no alvo (v6 155, v5 135, como no Lindbergh)
            t = np.linspace(-6, 4, 2001); xs = 0.18 * 2.0 ** t
            v = identidade(base(np.repeat(xs[:, None], 3, 1), A['base'])[0], A) @ [0.2126, 0.7152, 0.0722]
            meta['retrato'] = {'pele_v6': round(float(np.interp(155 / 255, v, xs)), 5), 'pele_v5': round(float(np.interp(135 / 255, v, xs)), 5)}
        json.dump(meta, open(os.path.join(F, A['id'] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(A['id'], 'cinza médio', meta['cinza_medio_saida'])
    json.dump([A['id'] for A in FILMES], open(os.path.join(F, 'indice.json'), 'w'))
