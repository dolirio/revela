"""Protótipo do motor espectral de filme do Revela.

Cadeia simulada (uma vez, no computador; o app só recebe a LUT 3D resultante):

    foto (sRGB) ─► luz da cena (espectro) ─► exposição de cada camada do filme (sensibilidade espectral)
        ─► interação entre camadas (DIR) ─► densidade de cada camada (curvas características)
        ─► espectro do negativo (corantes separados + máscara) ─► ampliador + papel (sensibilidade do papel)
        ─► densidade de cada camada do papel (curvas do papel) ─► espectro da cópia ─► cor vista (sRGB)

Dados: pesquisa/dados/portra400.json e endura_premier.json (fichas técnicas da Kodak).
Aproximações declaradas estão marcadas com  # APROX.
"""
import json
import os

import numpy as np
from scipy.optimize import least_squares

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, '..', 'dados')
NM = np.arange(380.0, 731.0, 5.0)   # grade espectral comum (5 nm)
DL = 5.0


def _arr(v):
    return np.array([np.nan if a is None else a for a in v], dtype=float)


def _carrega(n):
    with open(os.path.join(DADOS, n + '.json'), encoding='utf-8') as f:
        return json.load(f)


def _na_grade(nm, v, fora=0.0):
    nm, v = np.asarray(nm, float), _arr(v)
    ok = ~np.isnan(v)
    return np.interp(NM, nm[ok], v[ok], left=fora, right=fora)


# ------------------------------------------------------------------ colorimetria (CIE 1931 2°)
def _g(x, mu, s1, s2):
    s = np.where(x < mu, s1, s2)
    return np.exp(-0.5 * ((x - mu) / s) ** 2)


def cmf(x=NM):
    """Funções de cor CIE 1931, ajuste analítico de Wyman, Sloan e Shirley (2013). # APROX (erro < 1%)"""
    xb = 1.056 * _g(x, 599.8, 37.9, 31.0) + 0.362 * _g(x, 442.0, 16.0, 26.7) - 0.065 * _g(x, 501.1, 20.4, 26.2)
    yb = 0.821 * _g(x, 568.8, 46.9, 40.5) + 0.286 * _g(x, 530.9, 16.3, 31.1)
    zb = 1.217 * _g(x, 437.0, 11.8, 36.0) + 0.681 * _g(x, 459.0, 26.0, 13.8)
    return np.stack([xb, yb, zb])


CMF = cmf()
SRGB_XYZ = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
XYZ_SRGB = np.linalg.inv(SRGB_XYZ)


def srgb_decode(v):
    v = np.asarray(v, float)
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def srgb_encode(v):
    v = np.clip(v, 0, None)
    return np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.power(v, 1 / 2.4) - 0.055)


def xyz_lab(xyz, white):
    t = xyz / white
    f = np.where(t > (6 / 29) ** 3, np.cbrt(t), t / (3 * (6 / 29) ** 2) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


# ------------------------------------------------------------------ RGB -> espectro
def base_espectral():
    """Três espectros de luz cuja cor (CIE) é a de cada primária sRGB, construídos como objetos reais:
    refletância entre 0 e 1 iluminada por luz do dia (corpo negro de 6504 K, a temperatura do D65).
    As três refletâncias somam 1 em cada comprimento de onda, então r = g = b = 1 é exatamente a luz do dia
    (um branco perfeito). Qualquer cor linear RGB vira r·b_r + g·b_g + b·b_b.
    # APROX: é uma escolha entre infinitos espectros possíveis (metamerismo); a mais suave dentro dos limites físicos.
    # (Versão anterior, sem limite de refletância, punha energia absurda acima de 700 nm: descartada.)"""
    n = len(NM)
    luz = planck(6504.0); luz = luz / luz.mean()
    A = CMF * DL
    branco_xyz = A @ luz
    A, branco_xyz = A / branco_xyz[1], branco_xyz / branco_xyz[1]
    # adapta os alvos ao branco desta luz (diferença mínima entre o corpo negro e o D65)
    adapt = branco_xyz / (SRGB_XYZ @ np.ones(3))
    alvos = SRGB_XYZ * adapt[:, None]
    D2 = np.diff(np.eye(n), 2, axis=0)

    def refl(p):
        z = p.reshape(3, n); z = z - z.max(0)
        e = np.exp(z); return e / e.sum(0)          # softmax: cada refletância em [0,1] e a soma é 1

    def res(p):
        r = refl(p)
        cor = np.concatenate([(A @ (r[c] * luz) - alvos[:, c]) * 300.0 for c in range(3)])
        return np.concatenate([cor, (D2 @ p.reshape(3, n).T).ravel() * 0.25])
    p0 = np.zeros(3 * n)
    p0[:n] = (NM - 560) / 40; p0[2 * n:] = (500 - NM) / 40
    r = refl(least_squares(res, p0, max_nfev=6000).x)
    return r * luz                                   # (3, n)


# ------------------------------------------------------------------ o filme
class Filme:
    def __init__(self, dados='portra400'):
        d = _carrega(dados)
        self.nome = d['filme']
        c = d['caracteristica']
        self.logH = _arr(c['logH'])
        self.curva = {k: _arr(c[k]) for k in 'RGB'}
        self.ref = c['logH_ref']
        s = d['sensibilidade']
        chaves = {'B': 'azul (forma amarelo)', 'G': 'verde (forma magenta)', 'R': 'vermelho (forma ciano)'}
        # log sensibilidade -> sensibilidade linear; fora da faixa publicada = 0
        self.sens = np.stack([10 ** _na_grade(s['nm'], s[chaves[k]], fora=-9) for k in 'RGB'])
        e = d['densidade_espectral']
        self.dmin_esp = _na_grade(e['nm'], e['dmin'], fora=np.nan)
        self.neutro_esp = _na_grade(e['nm'], e['neutro_meio_tom'], fora=np.nan)
        # fora de 400–700 nm a ficha não mede: repete a borda  # APROX
        for v in (self.dmin_esp, self.neutro_esp):
            ok = ~np.isnan(v); v[~ok] = np.interp(NM[~ok], NM[ok], v[ok])

    def densidade(self, k, L):
        """Curva característica (Status M), com prolongamento linear além do fim do gráfico."""
        x, y = self.logH, self.curva[k]
        ok = ~np.isnan(y); x, y = x[ok], y[ok]
        g = (y[-1] - y[-5]) / (x[-1] - x[-5])
        L = np.asarray(L, float)
        return np.where(L > x[-1], y[-1] + (L - x[-1]) * g, np.interp(L, x, y))


def status_m():
    """Respostas do densitômetro Status M (padrão para negativos). # APROX: gaussianas nos picos da norma ISO 5-3."""
    return np.stack([_g(NM, mu, s, s) for mu, s in ((650, 12), (540, 15), (445, 14))])   # R, G, B


def desmistura_corantes_kodak(f, ref='vision3_500t'):
    """Separa os corantes usando a FORMA real dos corantes Kodak publicada na ficha do Vision3 500T
    (corantes C, M, Y separados, normalizados no pico). O Portra e os outros negativos Kodak atuais usam a mesma
    família de tecnologia (a ficha do Portra cita a "KODAK VISION Film Technology"). Cada corante pode deslocar
    até 15 nm e alargar ou estreitar até 15%; a máscara laranja consumida entra como dois termos negativos
    (o acoplador do magenta é amarelo; o do ciano é laranja-avermelhado)."""
    r = _carrega(ref)['densidade_espectral']
    forma = {}
    for n in ('ciano', 'magenta', 'amarelo'):
        nm, v = np.asarray(r['nm'], float), _arr(r['corante_' + n]); ok = ~np.isnan(v)
        forma[n] = (nm[ok], np.clip(v[ok], 0, None))
    centro = {n: forma[n][0][np.argmax(forma[n][1])] for n in forma}
    alvo = f.neutro_esp - f.dmin_esp
    w = ((NM >= 400) & (NM <= 700)).astype(float)

    def corante(n, a, d, s):
        nm, v = forma[n]
        return a * np.interp(centro[n] + (NM - centro[n] - d) / s, nm, v)   # fora da faixa medida: repete a borda

    def corantes(p):
        return np.stack([corante('ciano', p[0], p[3], p[6]) - p[10] * _g(NM, 515, 35, 35),
                         corante('magenta', p[1], p[4], p[7]) - p[9] * _g(NM, 445, 25, 25),
                         corante('amarelo', p[2], p[5], p[8])])
    p0 = [1, 1, 1, 0, 0, 0, 1, 1, 1, 0.05, 0.05]
    lo = [0.2, 0.2, 0.2, -15, -15, -15, 0.85, 0.85, 0.85, 0, 0]
    hi = [2.5, 2.5, 2.5, 15, 15, 15, 1.15, 1.15, 1.15, 0.6, 0.6]
    res = least_squares(lambda p: (corantes(p).sum(0) - alvo) * w, p0, bounds=(lo, hi))
    return corantes(res.x), res


def desmistura_corantes(f):
    """Separa a soma 'cinza médio − Dmin' da ficha em três corantes efetivos (C, M, Y).
    A ficha só publica a soma. Cada corante é uma gaussiana assimétrica; o corante 'efetivo' já inclui a máscara
    consumida (por isso pode ficar um pouco abaixo de zero longe do pico).  # APROX: forma gaussiana"""
    alvo = f.neutro_esp - f.dmin_esp
    w = ((NM >= 400) & (NM <= 700)).astype(float)

    def corantes(p):
        return np.stack([p[0] * _g(NM, p[1], p[2], p[3]) - p[12] * _g(NM, 480, 30, 30),       # ciano (com máscara)
                         p[4] * _g(NM, p[5], p[6], p[7]) - p[13] * _g(NM, 440, 30, 30),       # magenta (com máscara)
                         p[8] * _g(NM, p[9], p[10], p[11])])                                   # amarelo
    p0 = [1.0, 690, 50, 40, 0.9, 545, 35, 35, 1.0, 450, 30, 40, 0.05, 0.05]
    lo = [0.2, 640, 20, 20, 0.2, 520, 15, 15, 0.2, 420, 15, 15, 0, 0]
    hi = [2.0, 720, 90, 90, 2.0, 575, 70, 70, 2.0, 475, 70, 70, 0.4, 0.4]
    r = least_squares(lambda p: (corantes(p).sum(0) - alvo) * w, p0, bounds=(lo, hi))
    return corantes(r.x), r


# ------------------------------------------------------------------ o papel
class Papel:
    def __init__(self, dados='endura_premier'):
        d = _carrega(dados)
        c = d['caracteristica']
        self.logH = _arr(c['logH'])
        self.curva = {k: _arr(c[k]) for k in 'RGB'}
        s = d['sensibilidade']
        chaves = {'B': 'azul (forma amarelo)', 'G': 'verde (forma magenta)', 'R': 'vermelho (forma ciano)'}
        self.sens = np.stack([10 ** _na_grade(s['nm'], s[chaves[k]], fora=-9) for k in 'RGB'])
        co = d['corantes']
        # corantes do papel, normalizados para 1 no pico (a ficha já vem perto disso)
        self.corantes = np.stack([np.clip(_na_grade(co['nm'], co[n]), 0, None) for n in ('ciano', 'magenta', 'amarelo')])
        self.corantes /= self.corantes.max(1, keepdims=True)
        self.base = min(np.nanmin(self.curva[k]) for k in 'RGB')   # base do papel, plana  # APROX

    def densidade(self, k, L):
        x, y = self.logH, self.curva[k]
        ok = ~np.isnan(y)
        return np.interp(L, x[ok], y[ok])


def planck(T, x=NM):
    x = x * 1e-9
    return 1 / (x ** 5 * (np.exp(1.4388e-2 / (x * T)) - 1))


# Cores usadas para calibrar o scanner (como a cartela que o laboratório usa): ColorChecker, pele e matizes
TREINO = [(115, 82, 68), (194, 150, 130), (98, 122, 157), (87, 108, 67), (133, 128, 177), (103, 189, 170),
          (214, 126, 44), (80, 91, 166), (193, 90, 99), (94, 60, 108), (157, 188, 64), (224, 163, 46),
          (56, 61, 150), (70, 148, 73), (175, 54, 60), (231, 199, 31), (187, 86, 149), (8, 133, 161),
          (234, 218, 186), (215, 189, 150), (160, 126, 86), (130, 92, 67), (96, 65, 52),
          (217, 46, 46), (217, 131, 46), (217, 217, 46), (131, 217, 46), (46, 217, 131), (46, 217, 217),
          (46, 131, 217), (46, 46, 217), (131, 46, 217), (217, 46, 217), (217, 46, 131),
          # tons claros e pastéis (fundo claro, céu claro, pele iluminada): sem eles a correção erra nas cores claras
          (242, 158, 158), (242, 200, 158), (242, 242, 158), (200, 242, 158), (158, 242, 158), (158, 242, 200),
          (158, 242, 242), (158, 200, 242), (158, 158, 242), (200, 158, 242), (242, 158, 242), (242, 158, 200),
          (247, 205, 140), (250, 225, 190), (205, 225, 245), (225, 235, 205)]


# ------------------------------------------------------------------ o motor completo
class Motor:
    """Simula foto -> negativo -> cópia. Parâmetros:
       paradas: exposição do negativo em relação à fotometria correta (+1 = uma parada a mais de luz)
       dir:     força da interação entre camadas (acopladores DIR); 0 = camadas independentes
    """

    def __init__(self, filme='portra400', papel='endura_premier', corantes='kodak', correcao_lab=1.0, dir_calibracao=0.1,
                 paradas_base=0.0):
        self.f, self.p = Filme(filme), Papel(papel)
        self.correcao_lab, self.dir_cal = correcao_lab, dir_calibracao
        self.paradas_base = paradas_base      # fotometrar o filme fora da ISO nominal (ex.: CineStill 500T a 800)
        self.base_rgb = base_espectral()
        self.branco = self.base_rgb.sum(0)                     # luz da cena e da sala de visão (D65)
        # exposição de cada camada para a luz branca: normaliza para o cinza 18% cair no log H de referência
        self.k_cam = 1.0 / (self.f.sens @ (self.branco * 0.18))
        self.cor_neg, self.ajuste_corantes = (desmistura_corantes_kodak if corantes == 'kodak' else desmistura_corantes)(self.f)
        # quanto de cada corante corresponde a cada nível de densidade Status M, medido em cinzas
        self.M = status_m(); self.M = self.M / self.M.sum(1, keepdims=True)
        A = self.M @ self.cor_neg.T                             # Status M de cada corante (3x3)
        L = np.linspace(-4.5, 1.5, 241)
        Dn = np.stack([self.f.densidade(k, L) for k in 'RGB'])
        dmin_curvas = np.stack([np.nanmin(self.f.curva[k]) for k in 'RGB'])
        quant = np.linalg.solve(A, Dn - dmin_curvas[:, None])
        self.L_tab, self.quant_tab = L, quant                  # quantidade de cada corante (C, M, Y) por log H
        self.ampliador = planck(3200.0)
        self._calibra_copia()

    # --- negativo
    def exposicao(self, rgb_lin, paradas=0.0):
        esp = rgb_lin @ self.base_rgb                           # (..., n) espectro da luz de cada ponto
        H = (esp @ self.f.sens.T) * self.k_cam * 0.18          # exposição relativa de cada camada
        return self.f.ref + np.log10(np.maximum(H, 1e-9) / 0.18) + (paradas + self.paradas_base) * np.log10(2)

    def negativo(self, L, dir_=0.0):
        """Espectro de densidade do negativo. L: log H de cada camada (..., 3) na ordem R, G, B."""
        if dir_:
            # Acopladores DIR: cada camada é freada pela revelação das outras. Em primeira ordem isso amplia a
            # diferença entre as camadas em relação ao cinza (mais saturação), sem mexer nos neutros.
            L = L + dir_ * (L - L.mean(-1, keepdims=True))
        q = np.stack([np.interp(L[..., i], self.L_tab, self.quant_tab[i]) for i in range(3)], -1)
        return self.f.dmin_esp + q @ self.cor_neg

    # --- cópia
    def _expo_papel(self, Dneg):
        luz = self.ampliador * 10 ** (-Dneg)
        return np.log10(np.maximum(luz @ self.p.sens.T, 1e-30))

    def _copia_de_logE(self, logE):
        d = np.stack([self.p.densidade(k, logE[..., i] + self.filtro[i]) for i, k in enumerate('RGB')], -1)
        dens = self.p.base + (d - self.p.base) @ self.p.corantes
        refl = 10 ** (-dens)
        xyz = (refl * self.branco) @ CMF.T
        return xyz / self.xyz_branco_papel

    def _calibra_copia(self):
        """Acha a filtragem do ampliador (como o laboratorista faz) para o cinza 18% bem exposto sair cinza 18%."""
        refl_base = 10 ** (-self.p.base)
        self.xyz_branco_papel = (refl_base * self.branco) @ CMF.T
        logE = self._expo_papel(self.negativo(self.exposicao(np.array([0.18, 0.18, 0.18]))))
        alvo = SRGB_XYZ @ np.array([0.18, 0.18, 0.18]) / (SRGB_XYZ @ np.ones(3))

        def res(fl):
            self.filtro = fl
            return (self._copia_de_logE(logE) - alvo) * 10
        self.filtro = np.zeros(3)
        least_squares(res, np.array([-1.3, -1.3, -1.3]) - logE)

    def copia(self, rgb_lin, paradas=0.0, dir_=0.0):
        """sRGB linear de entrada -> XYZ relativo ao branco do papel."""
        neg = self.negativo(self.exposicao(rgb_lin, paradas), dir_)
        return self._copia_de_logE(self._expo_papel(neg))

    def srgb(self, rgb_lin, paradas=0.0, dir_=0.0):
        xyz = self.copia(rgb_lin, paradas, dir_) * (SRGB_XYZ @ np.ones(3))
        return xyz @ XYZ_SRGB.T

    # --- escaneamento (o caminho que dá o "visual Portra" conhecido hoje)
    def _prepara_scanner(self):
        """Scanner de laboratório: luz atravessa o negativo e três sensores (R, G, B) medem o que passa.
        # APROX: sensores estreitos, como os LEDs RGB dos Frontier; os comprimentos de onda exatos não são públicos."""
        self.sensor = np.stack([_g(NM, mu, s, s) for mu, s in ((660, 12), (535, 14), (455, 12))])
        self.sensor /= self.sensor.sum(1, keepdims=True)
        # A inversão do laboratório é linear em densidade (base + inclinação por canal), ajustada num cinza
        # de −2 a +2 paradas. Fora dessa faixa o pé e o "ombro" de cada camada aparecem como na vida real.
        L = self.f.ref + np.linspace(-2, 2, 17) * np.log10(2)
        Ds = self._densidade_scan(self.negativo(np.repeat(L[:, None], 3, 1)))
        self.inv = [np.polyfit(L, Ds[:, i], 1) for i in range(3)]   # (gama, base) por canal
        self.D_lab = np.zeros((3, 3)); self.equilibrio = np.zeros(3)
        # equilíbrio do laboratório: o cinza médio bem fotometrado sai exatamente cinza e no meio-tom
        cinza = self._lhat(self._densidade_scan(self.negativo(self.exposicao(np.array([0.18, 0.18, 0.18])), self.dir_cal)))
        self.equilibrio = self.f.ref - cinza
        self.D_lab = self._calibra_lab() * self.correcao_lab

    def _calibra_lab(self, lam=0.02):
        """Calibração do scanner para o filme, como os laboratórios fazem (Frontier e Noritsu têm ajustes por tipo
        de filme): uma correção 3×3 em escala logarítmica que desfaz a mistura linear entre os corantes, aprendida
        numa cartela de cores. Linhas somam zero, então o cinza não muda. O caráter do filme (o que cada camada
        enxerga, as curvas, o DIR, o pé e o ombro) continua; sai só o "embaralhamento" de primeira ordem."""
        rgb = srgb_decode(np.array(TREINO, float) / 255)
        Lhat = self._lhat(self._densidade_scan(self.negativo(self.exposicao(rgb), self.dir_cal))) - self.f.ref
        T = np.clip(np.log10(np.maximum(rgb, 1e-4) / 0.18), -2.2, 1.0)
        # D com linhas de soma zero: D = B @ P, P projeta fora do neutro
        P = np.eye(3) - 1 / 3
        X = Lhat @ P.T                      # parte cromática
        R = T - Lhat
        A = X.T @ X + lam * len(X) * np.eye(3)
        B = np.linalg.solve(A, X.T @ R).T
        return B @ P

    def _lhat(self, Ds):
        return np.stack([(Ds[..., i] - self.inv[i][1]) / self.inv[i][0] for i in range(3)], -1) + self.equilibrio

    def _densidade_scan(self, Dneg):
        return -np.log10(np.maximum((10 ** (-Dneg)) @ self.sensor.T, 1e-12))

    @staticmethod
    def curva_lab(x, contraste=1.15, preto=0.012, branco=0.985):
        """Curva de tons do laboratório: meio-tom fixo (0,18 -> 0,18), luzes que dobram suave para o branco,
        preto levemente aberto. contraste = inclinação no meio-tom (1 = foto digital)."""
        n = contraste / (1 - 0.18 / branco)
        s = 0.18 * (branco / 0.18 - 1) ** (1 / n)
        x = np.maximum(x, 0)
        y = branco * x ** n / (x ** n + s ** n)
        return preto + (branco - preto) * y / branco

    def escaneia(self, rgb_lin, paradas=0.0, dir_=0.0, contraste=1.15):
        """sRGB linear de entrada -> sRGB linear de saída, pelo caminho negativo -> scanner -> inversão -> curva."""
        if not hasattr(self, 'inv'):
            self._prepara_scanner()
        Ds = self._densidade_scan(self.negativo(self.exposicao(rgb_lin, paradas), dir_))
        Lhat = self._lhat(Ds)
        Lhat = Lhat + (Lhat - self.f.ref) @ self.D_lab.T   # calibração do laboratório para o filme
        x = 0.18 * 10 ** (Lhat - self.f.ref)          # exposição recuperada de cada canal (cinza médio = 0,18)
        return self.curva_lab(x, contraste)

    # --- LUT
    def lut(self, n=33, paradas=0.0, dir_=0.0, caminho='scan'):
        """LUT 3D sRGB -> sRGB (entrada tratada como luz da cena, cinza 18% = meio-tom), ordem .cube (R mais rápido)."""
        g = np.linspace(0, 1, n)
        b, gg, r = np.meshgrid(g, g, g, indexing='ij')
        rgb = srgb_decode(np.stack([r, gg, b], -1).reshape(-1, 3))
        out = self.escaneia(rgb, paradas, dir_) if caminho == 'scan' else self.srgb(rgb, paradas, dir_)
        return np.clip(srgb_encode(out), 0, 1)


def grava_cube(caminho, lut, n, titulo):
    with open(caminho, 'w') as f:
        f.write(f'TITLE "{titulo}"\nLUT_3D_SIZE {n}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        for v in lut:
            f.write(f'{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n')
