"""Gera o ícone do Revela (a cópia inclinada, céu petróleo, paleta Kodachrome) em SVG.
Uso: python3 referencias/icone/gerar_icone.py   (escreve icone.svg e icone-desenho.svg na raiz)
Os PNG saem de testes/icones_png.js (o Chromium desenha o SVG)."""
import os
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
FUNDO, PAPEL = '#141210', '#EEE7DC'
CEU, SOL, MONT1, MONT2 = '#2B6E8C', '#E2A257', '#7A8A3E', '#3F5226'

def desenho():
    x, w, top, base, b, giro = 290, 444, 196, 664, 30, -6
    ix, iw, iy, ih = x + b, w - 2 * b, top + b, base - top - b
    p = lambda pts: 'M' + ' L'.join(f'{ix + iw * a:.1f} {iy + ih * c:.1f}' for a, c in pts) + 'Z'
    fundo = p([(0, 1.2), (0, .78), (.22, .56), (.5, .74), (.74, .46), (1, .7), (1, 1.2)])
    frente = p([(0, 1.2), (0, .95), (.34, .66), (.58, .88), (.8, .72), (1, .92), (1, 1.2)])
    return (f'<defs><clipPath id="corte"><rect width="1024" height="{base}"/></clipPath></defs>'
            f'<g clip-path="url(#corte)"><g transform="rotate({giro} 512 {base})">'
            f'<rect x="{x}" y="{top}" width="{w}" height="{base - top + 80}" rx="20" fill="{PAPEL}"/>'
            f'<rect x="{ix}" y="{iy}" width="{iw}" height="{ih + 60}" fill="{CEU}"/>'
            f'<circle cx="{ix + iw * .7:.1f}" cy="{iy + ih * .3:.1f}" r="{iw * .11:.1f}" fill="{SOL}"/>'
            f'<path d="{fundo}" fill="{MONT1}"/><path d="{frente}" fill="{MONT2}"/></g></g>'
            f'<rect x="196" y="664" width="632" height="38" rx="19" fill="{PAPEL}"/>')

cab = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">'
open(os.path.join(RAIZ, 'icone.svg'), 'w').write(f'{cab}<rect width="1024" height="1024" fill="{FUNDO}"/>{desenho()}</svg>\n')
# sem fundo e recortado no desenho: para o cabeçalho e a tela inicial
open(os.path.join(RAIZ, 'icone-desenho.svg'), 'w').write(desenho_svg := f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="180 150 664 568">{desenho()}</svg>\n')
print('ok')
