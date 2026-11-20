// Receitas dos looks. Este arquivo pode ser substituído pelo exportado no Laboratório (lab.html).
// Diretrizes do refinamento: cinzas médios com tinta leve (saturação até ~0,12 nos looks quentes),
// pele entre 20° e 30° de matiz sem estourar a saturação, altas luzes sem clipar e exposição média estável.
export const LOOKS = [
  {
    // Negativo quente, suave. Âmbar nas altas luzes, verdes puxados para oliva.
    id: 'ambar200', name: 'Âmbar 200', group: 'Cor',
    wb: [1.025, 1.0, 0.95], contrast: 4, sat: 0.95, satHigh: 0.85,
    hues: [{ at: 110, width: 50, shift: -10, sat: 0.82 }, { at: 25, width: 30, sat: 0.95 }, { at: 215, width: 45, shift: -4, sat: 0.9 }],
    split: { shadow: [0.48, 0.5, 0.52], high: [0.54, 0.515, 0.46], amt: 0.2 },
    black: [0.045, 0.038, 0.035], white: [0.985, 0.97, 0.925],
  },
  {
    // Negativo neutro-frio, pastel. Sombras ciano, pele suave.
    id: 'cais400', name: 'Cais 400', group: 'Cor',
    wb: [0.99, 1.0, 1.025], contrast: 3.6, sat: 0.86, satShadow: 0.82,
    hues: [{ at: 115, width: 55, shift: 16, sat: 0.75 }, { at: 25, width: 30, sat: 1.0, val: 1.04 }],
    split: { shadow: [0.45, 0.5, 0.545], high: [0.525, 0.51, 0.475], amt: 0.24 },
    black: [0.055, 0.06, 0.07], white: [0.975, 0.97, 0.955],
  },
  {
    // Matte e enevoado, mas sem ficar sujo: meio-tom levantado.
    id: 'neblina', name: 'Neblina', group: 'Cor',
    contrast: 2, sat: 0.74, gamma: [0.93, 0.93, 0.92],
    hues: [{ at: 25, width: 30, sat: 1.1 }],
    split: { shadow: [0.475, 0.5, 0.53], high: [0.52, 0.505, 0.48], amt: 0.15 },
    black: [0.12, 0.12, 0.13], white: [0.955, 0.95, 0.935],
  },
  {
    // Claro e arejado. Altas luzes frias, pele preservada.
    id: 'sal', name: 'Sal', group: 'Cor',
    wb: [0.995, 1.0, 1.015], contrast: 2.8, pivot: 0.42, sat: 0.84, satHigh: 0.72,
    gamma: [0.91, 0.9, 0.88],
    hues: [{ at: 25, width: 30, sat: 1.12 }, { at: 110, width: 50, shift: 10, sat: 0.85 }],
    split: { shadow: [0.48, 0.5, 0.52], high: [0.49, 0.5, 0.515], amt: 0.14 },
    black: [0.06, 0.065, 0.07], white: [1, 1, 1],
  },
  {
    // Outono terroso. Quente, verdes viram oliva, céu dessaturado (sem esverdear).
    id: 'ferrugem', name: 'Ferrugem', group: 'Cor',
    wb: [1.045, 1.0, 0.91], contrast: 4.4, sat: 0.92,
    hues: [{ at: 100, width: 60, shift: -22, sat: 0.65, val: 0.93 }, { at: 212, width: 50, sat: 0.72 }, { at: 22, width: 28, sat: 0.92 }],
    split: { shadow: [0.51, 0.485, 0.47], high: [0.545, 0.505, 0.45], amt: 0.2 },
    black: [0.065, 0.048, 0.035], white: [0.975, 0.94, 0.875],
  },
  {
    // Cinematográfico teal & laranja, contido. Verdes viram verde-água.
    id: 'lagoa', name: 'Lagoa', group: 'Cor',
    contrast: 4.6, sat: 1.0,
    hues: [{ at: 120, width: 55, shift: 32, sat: 0.85 }, { at: 25, width: 30, sat: 0.9, val: 1.03 }, { at: 210, width: 50, shift: -4, sat: 1.0 }],
    split: { shadow: [0.44, 0.515, 0.545], high: [0.535, 0.508, 0.47], amt: 0.26 },
    black: [0.025, 0.035, 0.04], white: [0.995, 0.98, 0.955],
  },
  {
    // Cromo/slide: contraste alto e cores densas, com proteção para a pele.
    id: 'cromo64', name: 'Cromo 64', group: 'Cor',
    wb: [1.0, 1.0, 1.015], contrast: 5.6, pivot: 0.49, sat: 1.12,
    hues: [{ at: 220, width: 50, shift: 4, sat: 1.12, val: 0.94 }, { at: 22, width: 26, sat: 0.82 }, { at: 0, width: 18, sat: 0.92 }],
    gamma: [1.0, 1.01, 1.04],
    black: [0.008, 0.008, 0.018], white: [0.995, 0.995, 0.99],
  },
  {
    // Instantâneo: pálido, sombras magenta, altas luzes levemente ciano.
    id: 'polar', name: 'Polar', group: 'Cor',
    wb: [1.0, 0.995, 1.02], contrast: 2.4, sat: 0.76,
    hues: [{ at: 115, width: 60, shift: 22, sat: 0.72 }, { at: 25, width: 30, sat: 1.08 }],
    split: { shadow: [0.53, 0.475, 0.535], high: [0.485, 0.51, 0.525], amt: 0.28 },
    black: [0.11, 0.095, 0.11], white: [0.955, 0.965, 0.945],
  },
  {
    // Verão saturado e quente, para luz forte e noite.
    id: 'verao800', name: 'Verão 800', group: 'Cor',
    wb: [1.035, 1.0, 0.96], contrast: 4.8, sat: 1.05, satHigh: 0.9,
    hues: [{ at: 45, width: 30, sat: 1.08 }, { at: 120, width: 50, shift: 12, sat: 0.9 }, { at: 22, width: 26, sat: 0.86 }],
    split: { shadow: [0.46, 0.525, 0.5], high: [0.54, 0.51, 0.46], amt: 0.22 },
    black: [0.03, 0.038, 0.038], white: [1, 0.975, 0.935],
  },
  {
    // Processo cruzado: altas luzes amarelo-esverdeadas, sombras azuis. Look de efeito, intencionalmente forte.
    id: 'cruzado', name: 'Cruzado', group: 'Cor',
    contrast: 5.8, sat: 1.12,
    gamma: [0.96, 0.9, 1.14],
    hues: [{ at: 22, width: 26, sat: 0.85 }],
    split: { shadow: [0.43, 0.48, 0.59], high: [0.55, 0.56, 0.42], amt: 0.32 },
    black: [0.02, 0.035, 0.07], white: [1, 1, 0.9],
  },
  {
    // Negativo de retrato: contraste baixo, pele cremosa, verdes suaves, altas luzes longas.
    id: 'retrato160', name: 'Retrato 160', group: 'Cor',
    wb: [1.01, 1.0, 0.985], contrast: 3.0, pivot: 0.46, sat: 0.84, satHigh: 0.8,
    gamma: [0.97, 0.97, 0.98],
    hues: [{ at: 25, width: 30, sat: 0.9, val: 1.03 }, { at: 115, width: 55, shift: 8, sat: 0.72 }, { at: 0, width: 18, sat: 0.9 }],
    split: { shadow: [0.49, 0.5, 0.515], high: [0.515, 0.505, 0.485], amt: 0.14 },
    black: [0.05, 0.05, 0.055], white: [0.985, 0.975, 0.955],
  },
  {
    // Filme de consumo dos anos 90: amarelos e vermelhos vivos, céu ciano, sombras levemente verdes.
    id: 'praia200', name: 'Praia 200', group: 'Cor',
    wb: [1.015, 1.0, 0.97], contrast: 4.6, sat: 1.04, satHigh: 0.86,
    hues: [{ at: 55, width: 35, shift: -4, sat: 1.12 }, { at: 205, width: 45, shift: -10, sat: 1.05 }, { at: 22, width: 26, sat: 0.88 }, { at: 120, width: 50, shift: -6, sat: 0.9 }],
    split: { shadow: [0.48, 0.515, 0.5], high: [0.53, 0.515, 0.465], amt: 0.2 },
    black: [0.035, 0.045, 0.04], white: [0.99, 0.98, 0.94],
  },
  {
    // Cinema balanceado para tungstênio, usado com luz do dia: frio, sombras verde-azuladas, pele contida.
    id: 'tungst500', name: 'Tungstênio 500', group: 'Cor',
    wb: [0.955, 0.995, 1.055], contrast: 3.8, pivot: 0.47, sat: 0.9,
    hues: [{ at: 25, width: 32, shift: 3, sat: 0.95, val: 1.02 }, { at: 120, width: 55, shift: 25, sat: 0.75 }, { at: 210, width: 50, sat: 1.05 }],
    split: { shadow: [0.44, 0.51, 0.55], high: [0.52, 0.505, 0.48], amt: 0.24 },
    black: [0.03, 0.045, 0.06], white: [0.97, 0.98, 0.985],
  },
  {
    // Noite urbana: sombras verde-ciano, luzes quentes de rua, contraste médio.
    id: 'noturno800', name: 'Noturno 800', group: 'Cor',
    contrast: 4.2, pivot: 0.45, sat: 0.95, satShadow: 0.85,
    gamma: [0.98, 0.97, 1.0],
    hues: [{ at: 35, width: 35, sat: 1.1, val: 1.03 }, { at: 120, width: 60, shift: 30, sat: 0.8 }, { at: 22, width: 26, sat: 0.92 }],
    split: { shadow: [0.43, 0.53, 0.53], high: [0.56, 0.51, 0.44], amt: 0.28 },
    black: [0.03, 0.05, 0.05], white: [0.99, 0.965, 0.92],
  },
  {
    // Slide de saturação extrema: vermelhos densos, azuis profundos, sombras puxadas.
    id: 'vivido50', name: 'Vívido 50', group: 'Cor',
    wb: [1.0, 1.0, 1.01], contrast: 6.0, sat: 1.2, satHigh: 0.95,
    gamma: [1.02, 1.03, 1.05],
    hues: [{ at: 0, width: 25, shift: -4, sat: 1.1, val: 0.94 }, { at: 220, width: 50, shift: 6, sat: 1.15, val: 0.9 }, { at: 120, width: 50, shift: 4, sat: 1.08, val: 0.93 }, { at: 25, width: 24, sat: 0.8 }],
    black: [0.005, 0.005, 0.015], white: [0.995, 0.99, 0.985],
  },
  {
    // Filme vencido: base magenta, sombras esverdeadas, pretos lavados e cor fraca.
    id: 'vencido', name: 'Vencido', group: 'Cor',
    wb: [1.02, 0.97, 1.0], contrast: 2.6, sat: 0.7,
    gamma: [0.96, 1.0, 0.98],
    hues: [{ at: 25, width: 30, sat: 1.05 }],
    split: { shadow: [0.47, 0.54, 0.5], high: [0.55, 0.48, 0.52], amt: 0.3 },
    black: [0.1, 0.11, 0.1], white: [0.96, 0.93, 0.94],
  },
  {
    // Cópia de álbum dos anos 70: amarelo-avermelhada, ciano perdido, altas luzes creme.
    id: 'arquivo70', name: 'Arquivo 70', group: 'Cor',
    wb: [1.05, 1.0, 0.9], contrast: 3.2, sat: 0.8,
    hues: [{ at: 200, width: 60, shift: -8, sat: 0.6 }, { at: 120, width: 55, shift: -18, sat: 0.7 }, { at: 22, width: 28, sat: 0.95 }],
    split: { shadow: [0.53, 0.49, 0.47], high: [0.55, 0.51, 0.43], amt: 0.24 },
    black: [0.1, 0.075, 0.06], white: [0.97, 0.93, 0.83],
  },
  {
    // P&B suave, grão fino, tons médios ricos.
    id: 'prata100', name: 'Prata 100', group: 'P&B',
    bw: [0.3, 0.59, 0.11], contrast: 4.2, tone: [1, 1, 1],
    black: [0.03, 0.03, 0.03], white: [0.98, 0.98, 0.98],
  },
  {
    // P&B duro de alta sensibilidade. Filtro laranja leve: céu escurece, pele clareia sem estourar.
    id: 'carvao3200', name: 'Carvão 3200', group: 'P&B',
    bw: [0.42, 0.48, 0.1], contrast: 6.4, pivot: 0.48, tone: [1, 1, 1],
    black: [0.01, 0.01, 0.01], white: [0.99, 0.99, 0.99],
  },
  {
    // Viragem sépia com papel envelhecido.
    id: 'sepia', name: 'Sépia Velha', group: 'P&B',
    bw: [0.33, 0.55, 0.12], contrast: 3.2, tone: [1.035, 0.96, 0.83],
    black: [0.09, 0.075, 0.06], white: [0.965, 0.935, 0.86],
  },
  {
    // P&B de reportagem: meio-tom firme, pretos profundos.
    id: 'grafite400', name: 'Grafite 400', group: 'P&B',
    bw: [0.32, 0.56, 0.12], contrast: 5.2, pivot: 0.47, tone: [1, 1, 1],
    black: [0.015, 0.015, 0.015], white: [0.985, 0.985, 0.985],
  },
  {
    // Filtro vermelho: céu quase preto, pele clara, contraste dramático.
    id: 'nitrato', name: 'Nitrato', group: 'P&B',
    bw: [0.62, 0.36, 0.02], contrast: 6.4, tone: [1.01, 1, 0.98],
    black: [0.02, 0.02, 0.02], white: [0.99, 0.985, 0.97],
  },
  {
    // Cianotipia: sombras azul-prussiano, papel claro.
    id: 'ciano', name: 'Ciano', group: 'P&B',
    bw: [0.3, 0.59, 0.11], contrast: 3.6, tone: [1, 1, 1],
    black: [0.04, 0.11, 0.24], white: [0.92, 0.95, 0.97],
  },
];
