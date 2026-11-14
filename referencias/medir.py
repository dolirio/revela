"""Mede a cartela do Revela numa foto (RAW ou JPEG) e compara simulações de filme com o RAW da mesma cena.

Uso:
  python3 referencias/medir.py foto.RAF|.DNG|.jpg [...]          mede cada foto -> <foto>.medidas.json
  python3 referencias/medir.py --compara bruto.RAF simulacao.jpg  diferença por quadro (L*, croma, matiz)

Como funciona:
1. Abre a foto. RAW é revelado de forma neutra e linear (balanço de branco da câmera, sem curva, sem brilho
   automático). JPEG é convertido de sRGB para luz linear.
2. Acha os 4 quadrados pretos com miolo branco dos cantos da cartela e calcula a perspectiva (homografia).
3. Lê cada quadro da cartela pelo mapa (cartela_mapa.json), usando só o miolo (50%) e a mediana dos pixels.
"""
import json
import os
import sys

import cv2
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAW = ('.raf', '.dng', '.arw', '.cr2', '.cr3', '.nef', '.orf', '.rw2', '.pef')
MAPA = json.load(open(os.path.join(AQUI, 'cartela_mapa.json'), encoding='utf-8'))
W, H = MAPA['tamanho_px']; M, LADO = 130, 90
CANTOS = np.float32([[M + LADO / 2, M + LADO / 2], [W - M - LADO / 2, M + LADO / 2],
                     [M + LADO / 2, H - M - LADO / 2], [W - M - LADO / 2, H - M - LADO / 2]])   # centros das marcas
SRGB_XYZ = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])


def abre(caminho):
    """-> imagem em luz linear sRGB (float32, 0..1+)."""
    if caminho.lower().endswith(RAW):
        import rawpy
        with rawpy.imread(caminho) as r:
            rgb = r.postprocess(use_camera_wb=True, no_auto_bright=True, gamma=(1, 1), output_bps=16,
                                output_color=rawpy.ColorSpace.sRGB, user_flip=0)
        return rgb.astype(np.float32) / 65535
    img = cv2.cvtColor(cv2.imread(caminho, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
    return np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4)


def acha_marcas(lin):
    """Acha as 4 marcas dos cantos: quadrado escuro com um quadrado claro dentro."""
    g = np.clip(lin.mean(2) ** (1 / 2.2) * 255, 0, 255).astype(np.uint8)
    esc = max(1, int(max(g.shape) / 2000))
    g = cv2.resize(g, (g.shape[1] // esc, g.shape[0] // esc))
    bw = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 51, 15)
    cs, hier = cv2.findContours(bw, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    cand = []
    for i, c in enumerate(cs):
        a = cv2.contourArea(c)
        if a < 60:
            continue
        x, y, w, h = cv2.boundingRect(c)
        if not 0.7 < w / h < 1.4 or a < 0.75 * w * h:
            continue
        filho = hier[0][i][2]
        if filho < 0:
            continue
        af = cv2.contourArea(cs[filho])
        if 0.08 < af / a < 0.35:   # miolo branco: (40/90)² ≈ 0,2 da área
            m = cv2.moments(c)
            cand.append((a, m['m10'] / m['m00'] * esc, m['m01'] / m['m00'] * esc))
    if len(cand) < 4:
        raise ValueError(f'achei só {len(cand)} marcas de canto; a cartela inteira precisa aparecer na foto')
    cand.sort(reverse=True)
    # as 4 marcas têm o mesmo tamanho: pega o grupo de 4 de área mais parecida entre as maiores
    melhor = min((cand[i:i + 4] for i in range(len(cand) - 3)), key=lambda q: np.std([a for a, _, _ in q]) / np.mean([a for a, _, _ in q]))
    pts = np.float32([[x, y] for _, x, y in melhor])
    s, d = pts.sum(1), pts[:, 0] - pts[:, 1]
    tl, br = pts[np.argmin(s)], pts[np.argmax(s)]
    tr, bl = pts[np.argmax(d)], pts[np.argmin(d)]
    return np.float32([tl, tr, bl, br])


def mede(caminho):
    lin = abre(caminho)
    marcas = acha_marcas(lin)
    Hm = cv2.getPerspectiveTransform(CANTOS, marcas)   # cartela -> foto
    out = []
    for q in MAPA['quadros']:
        x0, y0, x1, y1 = q['caixa']
        mx, my = (x1 - x0) * 0.25, (y1 - y0) * 0.25
        grade = np.stack(np.meshgrid(np.linspace(x0 + mx, x1 - mx, 12), np.linspace(y0 + my, y1 - my, 12)), -1).reshape(-1, 1, 2).astype(np.float32)
        p = cv2.perspectiveTransform(grade, Hm).reshape(-1, 2)
        xi = np.clip(p[:, 0].round().astype(int), 0, lin.shape[1] - 1); yi = np.clip(p[:, 1].round().astype(int), 0, lin.shape[0] - 1)
        v = np.median(lin[yi, xi], axis=0)
        out.append({**{k: q[k] for k in ('grupo', 'i', 'srgb') if k in q}, 'linear': [round(float(a), 5) for a in v]})
    res = {'arquivo': os.path.basename(caminho), 'marcas_px': marcas.round(1).tolist(), 'quadros': out}
    with open(caminho + '.medidas.json', 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    return res


def lab(lin):
    xyz = np.asarray(lin) @ SRGB_XYZ.T; w = SRGB_XYZ @ np.ones(3); t = xyz / w
    f = np.where(t > (6 / 29) ** 3, np.cbrt(t), t / (3 * (6 / 29) ** 2) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def compara(bruto, sim):
    a, b = mede(bruto), mede(sim)
    # o RAW e o JPEG têm brilho diferente: normaliza pelo cinza médio (quadro "cinza 5" do ColorChecker)
    la = np.array([q['linear'] for q in a['quadros']]); lb = np.array([q['linear'] for q in b['quadros']])
    ia = 21
    la = la * (0.18 / la[ia].mean()); lb = lb * (0.18 / lb[ia].mean())
    A, B = lab(la), lab(lb)
    ca, cb = np.hypot(A[:, 1], A[:, 2]), np.hypot(B[:, 1], B[:, 2])
    ha, hb = np.degrees(np.arctan2(A[:, 2], A[:, 1])), np.degrees(np.arctan2(B[:, 2], B[:, 1]))
    print(f'{"quadro":24} {"ΔL*":>6} {"croma":>12} {"Δmatiz":>7}')
    for q, al, bl, x, y, h1, h2 in zip(a['quadros'], A[:, 0], B[:, 0], ca, cb, ha, hb):
        dh = (h2 - h1 + 180) % 360 - 180 if x > 6 else 0
        print(f"{q['grupo'] + ' ' + str(q.get('i', '')):24} {bl - al:+6.1f} {x:5.1f}->{y:5.1f} {dh:+7.1f}")


if __name__ == '__main__':
    if sys.argv[1] == '--compara':
        compara(sys.argv[2], sys.argv[3])
    else:
        for c in sys.argv[1:]:
            r = mede(c); print(c, 'ok,', len(r['quadros']), 'quadros medidos')
