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
from motor import FILTROS_PB, LABS, Motor, MotorCromo, MotorPB, srgb_encode  # noqa: E402
import vencido  # noqa: E402

# Receita P&B do usuário (pesquisa em referencias/lindbergh/): mistura de canais e curva medidas na C1 dele
# (X-T50, X RAW Studio), Shadow −1 e Highlight −1 como na v6. O retrato (rosto) é feito no app, com o rosto marcado.
LB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'referencias', 'lindbergh')


class ReceitaLindbergh:
    nome = 'Receita PB Peter Lindbergh (C1 do usuário, v6)'

    def __init__(self):
        c = np.load(os.path.join(LB_DIR, 'curve_v1.npz'))
        self.W = c['w'].astype(float); e = c['edges']; mu = c['mu']; ok = ~np.isnan(mu)
        self.XC = ((e[:-1] + e[1:]) / 2)[ok]; self.MU = mu[ok]
        self.X0 = float(np.interp(0.46, self.MU, self.XC))     # cinza médio 0,18 -> cinza médio da curva (≈0,46)

    @staticmethod
    def _tom(L, H=-1, S0=-1, passo=0.035, offset=1.8 / 255):
        bump = lambda x, c, w: np.exp(-0.5 * ((x - c) / w) ** 2)
        L = L + offset
        L = L - (S0 + 1) * passo * bump(L, 0.22, 0.10) * (1 - L)
        return L + H * passo * bump(L, 0.80, 0.10) * L

    def escaneia(self, rgb_lin, paradas=0.0, dir_=0.0, **kw):
        y = np.maximum(rgb_lin @ self.W, 1e-7) * 2.0 ** paradas
        L = self._tom(np.interp(np.log2(y) + (self.X0 - np.log2(0.18)), self.XC, self.MU))
        v = np.clip(L, 0, 1)
        lin = np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)   # a tabela guarda luz linear
        return np.repeat(lin[..., None], 3, -1)

    def entrada_para(self, alvo):
        # luz de entrada (cinza) que sai com o valor alvo (0–1, codificado): usado para expor a pele
        t = np.linspace(-9, 7, 3201); x = 0.18 * 2.0 ** t
        v = srgb_encode(self.escaneia(np.repeat(x[:, None], 3, 1))[:, 0])
        return float(np.interp(alvo, v, x))

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


def F(id_, motor, nome, inspirado, nota, pgi, tam, dir_, halacao=0.04, nit=None, paradas=0.0, cat='negativo', lab=1.0, venc=None):
    return {'id': id_, 'motor': {'filme': motor}, 'nome': nome, 'inspirado': inspirado, 'cat': cat, 'nota': nota,
            'paradas': paradas, 'dir': dir_, 'lab': lab, 'venc': venc,
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
    # Preto e branco: Tri-X 400 em D-76 (8 min). Uma tabela por filtro de cor na lente (ficha F-4017).
    F('kx400', 'trix400', 'KX 400', 'Kodak Tri-X 400', 'preto e branco · ISO 400 · contraste firme, vermelhos e pele mais escuros', 40, 1.1, 0.0,
      halacao=0.0, nit=[1.0, 1.0, 1.0], cat='pb'),
    # Receita do usuário: retrato P&B à maneira de Peter Lindbergh (referencias/lindbergh/README.md)
    F('lb', 'lindbergh', 'Lindbergh', 'receita PB Peter Lindbergh (C1 do usuário)', 'retrato P&B · filtro verde · pele no cinza médio, rosto destacado · marque o rosto em Ajustes',
      30, 1.0, 0.0, halacao=0.0, nit=[0.85, 0.85, 0.85], cat='pb'),
    # Cromo: Ektachrome E100 (ficha E-4000). O slide é a imagem final: contraste alto, pouca margem nas luzes.
    F('ka100', 'ektachrome_e100', 'KA 100', 'Kodak Ektachrome E100', 'cromo (slide) · ISO 100 · cor limpa, sombras profundas, luzes estouram cedo', 18, 0.8, 0.0,
      halacao=0.0, cat='cromo'),
    # Vencidos (pesquisa/vencido.md): véu da radiação + cada camada envelhecendo no seu ritmo. Tamanhos # APROX.
    F('kg200v', 'gold200', 'KG 200 · 10 anos', 'Kodak Gold 200 vencido', 'vencido · 10 anos numa gaveta · mais escuro, menos cor, sombras com véu', 52, 1.05, 0.28,
      cat='vencido', venc=(10, 200, 'ambiente', 1)),
    F('ku400v', 'ultramax400', 'KU 400 · 20 anos', 'Kodak UltraMax 400 vencido', 'vencido · 20 anos em temperatura ambiente · véu forte, cor desbotada', 60, 1.2, 0.32,
      cat='vencido', venc=(20, 400, 'ambiente', 2)),
    F('kp400v', 'portra400', 'KP 400 · calor', 'Kodak Portra 400 vencido no calor', 'vencido · 10 anos guardado no calor · dominante que muda de rolo para rolo', 50, 1.15, 0.18,
      cat='vencido', venc=(10, 400, 'calor', 3)),
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
    # correção do laboratório: desfaz a mistura dos corantes por completo (lab=1). O caráter de cor do filme vem da
    # sensibilidade de cada camada a espectros reais (pesquisa/espectros_naturais.md). Até 16/11/2026 era 0,7/0,9,
    # porque a correção antiga apagava também esse caráter (pesquisa/conferencia_assinatura.md).
    g = np.linspace(0, 1, N)
    b, gg, r = np.meshgrid(g, g, g, indexing='ij')
    t = np.stack([r, gg, b], -1).reshape(-1, 3)
    x = 0.18 * 2.0 ** (MIN + t * (MAX - MIN))
    os.makedirs(DESTINO, exist_ok=True)

    def grava(motor, sufixo, **kw):
        out = np.clip(srgb_encode(motor.escaneia(x, 0.0, f['dir'], **kw)), 0, 1)
        (np.round(out * 65535).astype('<u2')).tofile(os.path.join(DESTINO, f['id'] + sufixo + '.bin'))
    extra = {}
    if f['cat'] == 'pb' and f['motor']['filme'] != 'lindbergh':
        # uma tabela por filtro: <id>.bin (sem filtro) e <id>.<filtro>.bin
        for filtro in FILTROS_PB:
            m = MotorPB(f['motor']['filme'], filtro=filtro)
            grava(m, '' if filtro == 'nenhum' else '.' + filtro)
        extra['filtros'] = list(FILTROS_PB); extra['labs'] = ['neutro']
    elif f['motor']['filme'] == 'lindbergh':
        m = ReceitaLindbergh(); grava(m, ''); extra['labs'] = ['neutro']
        # retrato (v6 padrão; v3 e v5 nos extremos do controle "separação do rosto"): pele alvo de cada ponta
        extra['retrato'] = {'pele_v6': round(m.entrada_para(155 / 255), 5), 'pele_v5': round(m.entrada_para(135 / 255), 5)}
    elif f['cat'] == 'cromo':
        m = MotorCromo(f['motor']['filme'])
        grava(m, ''); extra['labs'] = ['neutro']
    else:
        m = Motor(**f['motor'], corantes='kodak', correcao_lab=f['lab'], dir_calibracao=0.0, paradas_base=f['paradas'])
        m._prepara_scanner()
        if f['venc']:
            anos, iso, arm, sem = f['venc']
            vencido.aplica(m, vencido.parametros(anos, iso, arm, sem))
        # uma tabela por laboratório: <id>.bin (neutro) e <id>.<lab>.bin
        for lab in LABS:
            grava(m, '' if lab == 'neutro' else '.' + lab, lab=lab)
        extra['labs'] = list(LABS)
    nit = None if f['motor']['filme'] == 'lindbergh' else nitidez_da_ficha(f['motor']['filme'])
    if nit:
        f['analogico']['nitidez_canal'] = nit
    meta = {k: f[k] for k in ('id', 'nome', 'inspirado', 'cat', 'nota', 'analogico')}
    meta.update(extra)
    meta['ficha'] = m.f.nome if hasattr(m, 'f') else m.nome
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
