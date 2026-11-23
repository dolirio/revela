"""Gera o ícone do Revela: a cópia em papel saindo inclinada da linha, com céu petróleo, sol âmbar e montanhas
verde-oliva (versão B refinada, 23/11/2026: menor, centrada, cantos e pontas macias).
Uso: python3 referencias/icone/gerar_icone.py   (escreve na raiz: icone.svg, icone-desenho.svg, icone-desenho-claro.svg)
Os PNG saem de testes/icones_png.js (o Chromium desenha o SVG)."""
import os
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
FUNDO = '#111111'
CEU, SOL, MONT1, MONT2 = '#2B6E8C', '#E2A257', '#7A8A3E', '#3F5226'
W, H, BORDA, GIRO, LINHA, LH, RAIO_FOTO, MACIO, SOL_R = 344, 326, 22, -8, 440, 24, 14, 22, .13

def desenho(papel):
    base = 512 + (H + LH) / 2 - LH
    x, top = 512 - W / 2, base - H
    ix, iw, iy, ih = x + BORDA, W - 2 * BORDA, top + BORDA, H - BORDA
    p = lambda pts: 'M' + ' L'.join(f'{ix + iw * a:.1f} {iy + ih * c:.1f}' for a, c in pts) + 'Z'
    fundo = p([(-.1, 1.3), (-.1, .8), (.22, .54), (.5, .74), (.74, .44), (1.1, .72), (1.1, 1.3)])
    frente = p([(-.1, 1.3), (-.1, .97), (.34, .64), (.58, .86), (.8, .7), (1.1, .92), (1.1, 1.3)])
    macio = lambda c: f' stroke="{c}" stroke-width="{MACIO}" stroke-linejoin="round"'
    return (f'<defs><clipPath id="corte"><rect width="1024" height="{base:.1f}"/></clipPath>'
            f'<clipPath id="janela"><rect x="{ix:.1f}" y="{iy:.1f}" width="{iw:.1f}" height="{ih + 60:.1f}" rx="{RAIO_FOTO}"/></clipPath></defs>'
            f'<g clip-path="url(#corte)"><g transform="rotate({GIRO} 512 {base:.1f})">'
            f'<rect x="{x:.1f}" y="{top:.1f}" width="{W}" height="{H + 60}" rx="{W * .06:.1f}" fill="{papel}"/>'
            f'<g clip-path="url(#janela)"><rect x="{ix:.1f}" y="{iy:.1f}" width="{iw:.1f}" height="{ih + 60:.1f}" fill="{CEU}"/>'
            f'<circle cx="{ix + iw * .7:.1f}" cy="{iy + ih * .3:.1f}" r="{iw * SOL_R:.1f}" fill="{SOL}"/>'
            f'<path d="{fundo}" fill="{MONT1}"{macio(MONT1)}/><path d="{frente}" fill="{MONT2}"{macio(MONT2)}/></g></g></g>'
            f'<rect x="{512 - LINHA / 2:.1f}" y="{base:.1f}" width="{LINHA}" height="{LH}" rx="{LH / 2}" fill="{papel}"/>')

cab = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">'
recorte = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="240 250 544 520">'   # sem fundo, só o desenho
esc = lambda n, s: open(os.path.join(RAIZ, n), 'w').write(s + '\n')
esc('icone.svg', f'{cab}<rect width="1024" height="1024" fill="{FUNDO}"/>{desenho("#F4F4F2")}</svg>')
esc('icone-desenho.svg', f'{recorte}{desenho("#F4F4F2")}</svg>')          # para o modo escuro (papel claro)
esc('icone-desenho-claro.svg', f'{recorte}{desenho("#1C1C1E")}</svg>')    # para o modo claro (borda e linha escuras)
print('ok')
