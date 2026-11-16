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
                                output_color=rawpy.ColorSpace.sRGB)   # orientação do arquivo (foto na vertical)
        return rgb.astype(np.float32) / 65535
    img = cv2.cvtColor(cv2.imread(caminho, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
    return np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4)


def acha_marcas(lin):
    """Acha as 4 marcas dos cantos: quadrado escuro com um quadrado claro dentro.
    Se falhar, tenta de novo com a imagem mais reduzida: numa foto tremida a marca fica borrada,
    e reduzir encolhe o borrão junto com ela."""
    erro = None
    for fator in (1, 2, 3):
        try:
            return _acha_marcas(lin, fator)
        except ValueError as e:
            erro = e
    raise erro


def _candidatos_img(lin, fator=1):
    y = lin.mean(2)
    y = y / max(float(np.percentile(y, 99.5)), 1e-6)        # foto escura (subexposta) ou RAW linear: estica antes
    g = np.clip(np.clip(y, 0, 1) ** (1 / 2.2) * 255, 0, 255).astype(np.uint8)
    esc = max(1, int(max(g.shape) / 2000)) * fator
    g = cv2.resize(g, (g.shape[1] // esc, g.shape[0] // esc), interpolation=cv2.INTER_AREA)
    cand = []
    # vários limiares: uma marca perto de texto ou de sombra pode sumir num deles e aparecer em outro
    for bloco, k in ((51, 15), (31, 10), (75, 20)):
        bw = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, bloco, k)
        cs, hier = cv2.findContours(bw, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        cand += _candidatos(cs, hier, esc)
    unicos = []
    for c in sorted(cand, reverse=True):   # junta a mesma marca achada em mais de um limiar
        if all(abs(c[1] - u[1]) > 12 * esc or abs(c[2] - u[2]) > 12 * esc for u in unicos):
            unicos.append(c)
    return g, esc, unicos


def acha_cartelas(lin, n=2):
    """Foto com n cartelas (ex.: papel fotográfico à esquerda e papel comum à direita): acha cada uma pelas
    suas 4 marcas, escolhendo a melhor quadra, tirando as marcas dela e escolhendo a próxima.
    Devolve as quadras da esquerda para a direita."""
    from itertools import combinations
    for fator in (1, 2, 3):
        g, esc, cand = _candidatos_img(lin, fator)
        quadras, resto = [], sorted(cand, reverse=True)[:16]
        for _ in range(n):
            if len(resto) < 3:
                break
            melhor, nota = _melhor_quadra(combinations(resto, 4)) if len(resto) >= 4 else (None, 1e9)
            if melhor is None or nota > 0.8:
                # reserva: três marcas + a quarta deduzida pela geometria (ex.: marca encostada na borda da foto)
                melhor, nota = _melhor_quadra([list(t) + [_quarta_marca(g, list(t), esc)] for t in combinations(resto[:8], 3)])
            if melhor is None or nota > 0.8:
                break
            quadras.append(melhor)
            usados = {(round(float(x)), round(float(y))) for x, y in melhor}
            resto = [c for c in resto if (round(c[1]), round(c[2])) not in usados]
        if len(quadras) == n:
            return sorted(quadras, key=lambda q: float(np.mean(q[:, 0])))
    raise ValueError(f'não achei {n} cartelas na foto')


def _acha_marcas(lin, fator=1):
    g, esc, cand = _candidatos_img(lin, fator)
    if len(cand) == 3:   # a quarta marca se perdeu (ex.: encostada na borda do papel): deduz e confirma
        cand.append(_quarta_marca(g, cand, esc))
    if len(cand) < 4:
        raise ValueError(f'achei só {len(cand)} marcas de canto; a cartela inteira precisa aparecer na foto')
    cand.sort(reverse=True)
    # escolhe, entre as combinações de 4, a que tem a forma da cartela: proporção certa, lados opostos parecidos
    # e marcas do mesmo tamanho (evita confundir um quadro escuro com uma marca)
    from itertools import combinations
    melhor, nota_min = _melhor_quadra(combinations(cand[:10], 4))
    if melhor is None or nota_min > 0.8:
        # reserva: três marcas verdadeiras + a quarta deduzida pela geometria e confirmada no lugar
        quadras = [list(t) + [_quarta_marca(g, list(t), esc)] for t in combinations(cand[:8], 3)]
        melhor, nota_min = _melhor_quadra(quadras)
    if melhor is None or nota_min > 0.8:
        raise ValueError('não achei as 4 marcas com a forma da cartela')
    return melhor


def _melhor_quadra(quadras):
    alvo = (W - 2 * M - LADO) / (H - 2 * M - LADO)
    melhor, nota_min = None, 1e9
    for q in quadras:
        pts = np.float32([[x, y] for _, x, y in q])
        s_, d_ = pts.sum(1), pts[:, 0] - pts[:, 1]
        o = np.float32([pts[np.argmin(s_)], pts[np.argmax(d_)], pts[np.argmin(d_)], pts[np.argmax(s_)]])  # tl, tr, bl, br
        if len({tuple(p) for p in o.tolist()}) < 4:
            continue
        topo, base = np.linalg.norm(o[1] - o[0]), np.linalg.norm(o[3] - o[2])
        esq, dir_ = np.linalg.norm(o[2] - o[0]), np.linalg.norm(o[3] - o[1])
        if min(topo, base, esq, dir_) < 1:
            continue
        prop = (topo + base) / (esq + dir_)
        areas = [a for a, _, _ in q]
        nota = abs(np.log(prop / alvo)) + abs(np.log(topo / base)) + abs(np.log(esq / dir_)) + np.std(areas) / np.mean(areas)
        if nota < nota_min:
            melhor, nota_min = o, nota
    return melhor, nota_min


def _quarta_marca(g, tres, esc):
    """Com 3 marcas, a quarta fica no canto que completa o paralelogramo; depois procura, numa janela em volta,
    o padrão da marca (quadrado escuro com miolo claro) por correlação."""
    pts = np.array([[x, y] for _, x, y in tres]) / esc
    d = [np.linalg.norm(pts[i] - pts[j]) for i, j in ((0, 1), (0, 2), (1, 2))]
    k = int(np.argmax(d)); a, b = ((0, 1), (0, 2), (1, 2))[k]; c = 3 - a - b   # a e b são opostos; c é o canto do meio
    est = pts[a] + pts[b] - pts[c]
    lado = np.sqrt(np.mean([t[0] for t in tres])) / esc                        # lado da marca (pixels reduzidos)
    L = max(int(round(lado)), 8)
    mol = np.full((L, L), 0, np.uint8); m0 = int(round(L * 25 / 90)); m1 = L - m0
    mol[m0:m1, m0:m1] = 255
    r = int(4 * L)
    x0, y0 = int(max(est[0] - r, 0)), int(max(est[1] - r, 0))
    jan = g[y0:int(est[1] + r), x0:int(est[0] + r)]
    if jan.shape[0] <= L or jan.shape[1] <= L:
        return (tres[0][0], est[0] * esc, est[1] * esc)
    res = cv2.matchTemplate(jan, mol, cv2.TM_CCOEFF_NORMED)
    _, _, _, mx = cv2.minMaxLoc(res)
    return (tres[0][0], (x0 + mx[0] + L / 2) * esc, (y0 + mx[1] + L / 2) * esc)


def _candidatos(cs, hier, esc):
    cand = []
    for i, c in enumerate(cs):
        a = cv2.contourArea(c)
        if a < 60:
            continue
        # retângulo girado: a cartela pode estar inclinada na foto (na X-T50, ~10°), e um quadrado girado
        # ocupa só ~75% da caixa reta em volta dele, o que reprovava marcas verdadeiras
        (_, _), (w, h), _ = cv2.minAreaRect(c)
        if min(w, h) < 1 or not 0.7 < w / h < 1.4 or a < 0.8 * w * h:
            continue
        filho = hier[0][i][2]
        if filho < 0:
            continue
        af = cv2.contourArea(cs[filho])
        if 0.08 < af / a < 0.35:   # miolo branco: (40/90)² ≈ 0,2 da área
            m = cv2.moments(c)
            cand.append((a, m['m10'] / m['m00'] * esc, m['m01'] / m['m00'] * esc))
    return cand


def mede_lado(caminho, lado, marcas=None):
    """Foto com DUAS cartelas lado a lado: mede só a da esquerda ('esq') ou a da direita ('dir').
    Procura as marcas apenas na metade escolhida da foto."""
    lin = abre(caminho)
    h, w = lin.shape[:2]
    x0 = 0 if lado == 'esq' else w // 2
    if marcas is None:
        m = acha_marcas(lin[:, x0:x0 + w // 2]); m[:, 0] += x0
    else:
        m = np.float32(marcas)
    return _mede_com(lin, m, caminho, sufixo='.' + lado)


def mede_cartelas(caminho, n=2, marcas=None):
    """Mede as n cartelas da foto (da esquerda para a direita). marcas: lista de quadras já conhecidas."""
    lin = abre(caminho)
    quadras = acha_cartelas(lin, n) if marcas is None else [np.float32(m) for m in marcas]
    return [_mede_com(lin, q, caminho, sufixo=f'.c{i}') for i, q in enumerate(quadras)]


def mede(caminho, marcas=None):
    """marcas: posições já conhecidas (ex.: as da foto RAW de origem; a revelação RAW na câmera mantém o
    mesmo enquadramento, então todas as simulações de uma foto usam as marcas dela)."""
    lin = abre(caminho)
    marcas = acha_marcas(lin) if marcas is None else np.float32(marcas)
    return _mede_com(lin, marcas, caminho)


def _mede_com(lin, marcas, caminho, sufixo=''):
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
    with open(caminho + sufixo + '.medidas.json', 'w', encoding='utf-8') as f:
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
