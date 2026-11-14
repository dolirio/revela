"""Gera a cartela de referência do Revela (A4, 300 ppp) em PNG e PDF, e o mapa dos quadros em JSON.

Uso: python3 referencias/gerar_cartela.py
A cartela não precisa ser colorimetricamente perfeita: o que medimos é a DIFERENÇA entre o arquivo RAW
(entrada neutra) e o JPEG de cada simulação de filme, sobre a mesma foto da mesma cartela.
"""
import colorsys
import json
import os

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
W, H = 2480, 3508          # A4 a 300 ppp
M = 130                    # margem
FUNDO = (118, 118, 118)    # cinza neutro ~L* 50: o fotômetro da câmera acerta a exposição sozinho


def lab_para_srgb(L):
    """L* -> valor sRGB 8 bits de um cinza neutro."""
    y = ((L + 16) / 116) ** 3 if L > 8 else L / 903.3
    v = 12.92 * y if y <= 0.0031308 else 1.055 * y ** (1 / 2.4) - 0.055
    return round(max(0, min(1, v)) * 255)


# ColorChecker clássico, valores sRGB aproximados (médias publicadas)
CC24 = [(115, 82, 68), (194, 150, 130), (98, 122, 157), (87, 108, 67), (133, 128, 177), (103, 189, 170),
        (214, 126, 44), (80, 91, 166), (193, 90, 99), (94, 60, 108), (157, 188, 64), (224, 163, 46),
        (56, 61, 150), (70, 148, 73), (175, 54, 60), (231, 199, 31), (187, 86, 149), (8, 133, 161),
        (243, 243, 242), (200, 200, 200), (160, 160, 160), (122, 122, 121), (85, 85, 85), (52, 52, 52)]
# Monk Skin Tone Scale (Google, CC BY 4.0), 10 tons de pele
MONK = ['f6ede4', 'f3e7db', 'f7ead0', 'eadaba', 'd7bd96', 'a07e56', '825c43', '604134', '3a312a', '292420']
MONK = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in MONK]


def hues(s, v, n=12):
    return [tuple(round(c * 255) for c in colorsys.hsv_to_rgb(i / n, s, v)) for i in range(n)]


def fonte(px):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, px)
    return ImageFont.load_default()


def main():
    im = Image.new('RGB', (W, H), FUNDO); d = ImageDraw.Draw(im)
    mapa = []
    # marcas nos cantos (para achar e endireitar a cartela na foto)
    for x, y in ((M, M), (W - M - 90, M), (M, H - M - 90), (W - M - 90, H - M - 90)):
        d.rectangle([x, y, x + 90, y + 90], fill=(0, 0, 0)); d.rectangle([x + 25, y + 25, x + 65, y + 65], fill=(255, 255, 255))
    d.text((M + 130, M + 10), 'REVELA · cartela de referência v1', fill=(235, 235, 235), font=fonte(54))
    d.text((M + 130, M + 74), 'imprimir em papel fotográfico FOSCO, sem correção automática de cor', fill=(220, 220, 220), font=fonte(30))

    def grade(nome, cores, x0, y0, cols, lado, gap):
        for i, c in enumerate(cores):
            x = x0 + (i % cols) * (lado + gap); y = y0 + (i // cols) * (lado + gap)
            d.rectangle([x, y, x + lado, y + lado], fill=c)
            mapa.append({'grupo': nome, 'i': i, 'srgb': list(c), 'caixa': [x, y, x + lado, y + lado]})
        linhas = (len(cores) + cols - 1) // cols
        return y0 + linhas * (lado + gap)

    lado, gap = 300, 26
    x0 = (W - (6 * lado + 5 * gap)) // 2
    y = grade('colorchecker', CC24, x0, 340, 6, lado, gap) + 40
    # escala de cinza: 12 passos iguais em L* (96 a 8)
    cinzas = [(v, v, v) for v in (lab_para_srgb(96 - i * 8) for i in range(12))]
    lado2 = (6 * lado + 5 * gap - 11 * 12) // 12
    y = grade('cinzas', cinzas, x0, y, 12, lado2, 12) + 40
    y = grade('pele_monk', MONK, x0, y, 10, (6 * lado + 5 * gap - 9 * 14) // 10, 14) + 40
    y = grade('matizes_fortes', hues(0.80, 0.85), x0, y, 12, lado2, 12) + 8
    y = grade('matizes_suaves', hues(0.35, 0.95), x0, y, 12, lado2, 12) + 40
    # branco e preto grandes (luzes e sombras extremas)
    d.rectangle([x0, y, x0 + 900, y + 230], fill=(255, 255, 255))
    d.rectangle([x0 + 6 * lado + 5 * gap - 900, y, x0 + 6 * lado + 5 * gap, y + 230], fill=(0, 0, 0))
    mapa += [{'grupo': 'branco', 'caixa': [x0, y, x0 + 900, y + 230]},
             {'grupo': 'preto', 'caixa': [x0 + 6 * lado + 5 * gap - 900, y, x0 + 6 * lado + 5 * gap, y + 230]}]
    d.text((M + 130, H - M - 60), 'Tons de pele: Monk Skin Tone Scale (Google, CC BY 4.0). Cores: aproximação do ColorChecker clássico.',
           fill=(215, 215, 215), font=fonte(26))
    im.save(os.path.join(AQUI, 'cartela_revela_A4.png'), dpi=(300, 300))
    im.save(os.path.join(AQUI, 'cartela_revela_A4.pdf'), resolution=300)
    with open(os.path.join(AQUI, 'cartela_mapa.json'), 'w', encoding='utf-8') as f:
        json.dump({'tamanho_px': [W, H], 'ppp': 300, 'quadros': mapa}, f, ensure_ascii=False, indent=1)
    print('cartela gerada; última linha em y =', y + 230, 'de', H)


if __name__ == '__main__':
    main()
