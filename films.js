// Filmes do Pellicula. Cada um tem um código curto e a descrição do filme que inspirou o look.
// As curvas e cores são definidas do zero aqui (nada copiado de presets de terceiros); o nome do filme
// original aparece só como referência de estilo ("inspirado no ...").
//
// look: parâmetros da LUT (ver makeLook em looks.js)
// ch:   caráter do filme, aplicado junto com a cor (grão de acordo com o ISO, halação, desbotado...)

import { FILM_LOOKS } from './film-looks.js';

// grão por faixa de ISO: [intensidade, tamanho, aspereza, cor]
const G = {
  50: [0.08, 0.9, 0.18, 0.2], 100: [0.13, 1.05, 0.25, 0.3], 160: [0.17, 1.15, 0.3, 0.32], 200: [0.25, 1.4, 0.38, 0.36],
  400: [0.33, 1.65, 0.45, 0.4], 800: [0.42, 1.95, 0.55, 0.45], 1600: [0.55, 2.35, 0.65, 0.55], 3200: [0.72, 2.8, 0.75, 0.6],
};
const grain = (iso, { bw = false, mul = 1, cmul = 1 } = {}) => {
  const [g, s, r, c] = G[iso];
  return { grain: g * mul, gsize: s, grough: r, gcolor: bw ? 0 : c * cmul };
};

export const FILM_CATS = [
  { id: 'clima', n: 'Climas' }, { id: 'neg', n: 'Dia a dia' }, { id: 'ret', n: 'Retrato' }, { id: 'cine', n: 'Cinema e noite' },
  { id: 'slide', n: 'Slide' }, { id: 'pb', n: 'P&B' }, { id: 'pbg', n: 'P&B granulado' }, { id: 'old', n: 'Vencido' },
  { id: 'mine', n: 'Minhas' },
];

export const FILMS = [
  // ---------------------------------------------------------------- negativo cor 35mm
  { id: 'f_kg200', code: 'KG 200', cat: 'neg', ref: 'Kodak Gold 200', kind: 'negativo cor · ISO 200 · quente e dourado',
    look: { wb: [1.035, 1, 0.94], contrast: 4.2, sat: 1.08, satHigh: 0.9,
      hues: [{ at: 55, width: 35, shift: -3, sat: 1.15 }, { at: 5, width: 30, sat: 1.08 }, { at: 110, width: 50, shift: -12, sat: 0.85 }, { at: 220, width: 45, shift: -5, sat: 0.9 }],
      split: { shadow: [0.49, 0.49, 0.52], high: [0.545, 0.515, 0.465], amt: 0.2 }, black: [0.04, 0.035, 0.03], white: [0.99, 0.975, 0.93] },
    ch: { ...grain(200), halo: 0.08 } },
  { id: 'f_ku400', code: 'KU 400', cat: 'neg', ref: 'Kodak Ultramax 400', kind: 'negativo cor · ISO 400 · quente e vivo',
    look: { wb: [1.03, 1, 0.945], contrast: 4.8, sat: 1.15,
      hues: [{ at: 5, width: 30, sat: 1.12 }, { at: 55, width: 35, sat: 1.12 }, { at: 110, width: 50, shift: -8, sat: 0.92 }],
      split: { shadow: [0.49, 0.5, 0.515], high: [0.535, 0.51, 0.47], amt: 0.15 }, black: [0.03, 0.028, 0.03], white: [0.985, 0.975, 0.94] },
    ch: { ...grain(400), halo: 0.1 } },
  { id: 'f_kp160', code: 'KP 160', cat: 'ret', ref: 'Kodak Portra 160', kind: 'negativo cor · ISO 160 · natural, pele suave',
    look: { wb: [1.01, 1, 0.98], contrast: 2.8, sat: 0.88, satHigh: 0.85,
      hues: [{ at: 25, width: 30, sat: 0.95, val: 1.03 }, { at: 110, width: 50, shift: 8, sat: 0.82 }, { at: 215, width: 45, sat: 0.88 }],
      split: { shadow: [0.48, 0.5, 0.52], high: [0.53, 0.51, 0.48], amt: 0.15 }, black: [0.05, 0.05, 0.055], white: [0.975, 0.97, 0.955] },
    ch: { ...grain(160) } },
  { id: 'f_kp400', code: 'KP 400', cat: 'ret', ref: 'Kodak Portra 400', kind: 'negativo cor · ISO 400 · tons de pele suaves',
    look: { wb: [1.02, 1, 0.97], contrast: 3.2, sat: 0.92,
      hues: [{ at: 25, width: 30, sat: 0.98, val: 1.03 }, { at: 110, width: 50, shift: 6, sat: 0.85 }, { at: 210, width: 45, shift: -8, sat: 0.9 }],
      split: { shadow: [0.475, 0.5, 0.525], high: [0.54, 0.515, 0.47], amt: 0.18 }, black: [0.055, 0.052, 0.055], white: [0.98, 0.97, 0.95] },
    ch: { ...grain(400) } },
  { id: 'f_kp400p2', code: 'KP 400 +2', cat: 'ret', ref: 'Kodak Portra 400 superexposto 2 pontos', kind: 'negativo cor · superexposto · claro, pastel, pele luminosa',
    look: { wb: [1.025, 1, 0.965], contrast: 2.6, pivot: 0.42, sat: 0.86, gamma: [0.9, 0.9, 0.92],
      hues: [{ at: 25, width: 30, sat: 0.97, val: 1.05 }, { at: 110, width: 50, shift: 8, sat: 0.82 }, { at: 210, width: 45, shift: -8, sat: 0.86 }],
      split: { shadow: [0.48, 0.5, 0.52], high: [0.54, 0.515, 0.475], amt: 0.16 }, black: [0.08, 0.075, 0.075], white: [0.985, 0.975, 0.96] },
    ch: { ...grain(400, { mul: 0.75 }) } },
  { id: 'f_kp800', code: 'KP 800', cat: 'ret', ref: 'Kodak Portra 800', kind: 'negativo cor · ISO 800 · quente, mais grão',
    look: { wb: [1.035, 1, 0.95], contrast: 3.6, sat: 1.0,
      hues: [{ at: 5, width: 30, sat: 1.05 }, { at: 110, width: 50, shift: 2, sat: 0.9 }],
      split: { shadow: [0.48, 0.5, 0.52], high: [0.55, 0.515, 0.46], amt: 0.2 }, black: [0.06, 0.055, 0.055], white: [0.975, 0.965, 0.935] },
    ch: { ...grain(800), halo: 0.1 } },
  { id: 'f_ke100', code: 'KE 100', cat: 'neg', ref: 'Kodak Ektar 100', kind: 'negativo cor · ISO 100 · saturado e nítido',
    look: { contrast: 5.2, sat: 1.28, satShadow: 1.1,
      hues: [{ at: 0, width: 30, shift: 2, sat: 1.2 }, { at: 25, width: 25, shift: -3, sat: 1.08 }, { at: 220, width: 45, shift: 4, sat: 1.25 }, { at: 115, width: 50, sat: 1.15 }],
      split: { shadow: [0.49, 0.5, 0.52], high: [0.5, 0.5, 0.5], amt: 0.1 }, black: [0.02, 0.02, 0.025], white: [0.99, 0.985, 0.975] },
    ch: { ...grain(100) } },
  { id: 'f_fs400', code: 'FS 400', cat: 'neg', ref: 'Fujifilm Superia 400', kind: 'negativo cor · ISO 400 · verdes fortes, sombras frias',
    look: { wb: [0.985, 1, 1.01], contrast: 4.2, sat: 1.05,
      hues: [{ at: 110, width: 50, shift: 12, sat: 1.12 }, { at: 220, width: 45, shift: -8, sat: 1.05 }, { at: 0, width: 25, shift: 4, sat: 0.95 }, { at: 25, width: 25, sat: 0.95 }],
      split: { shadow: [0.47, 0.51, 0.52], high: [0.52, 0.51, 0.48], amt: 0.2 }, black: [0.035, 0.045, 0.045], white: [0.98, 0.985, 0.965] },
    ch: { ...grain(400) } },
  { id: 'f_fc200', code: 'FC 200', cat: 'neg', ref: 'Fujifilm C200', kind: 'negativo cor · ISO 200 · frio e simples',
    look: { wb: [0.99, 1.01, 1], contrast: 3.6, sat: 0.9, satHigh: 0.85,
      hues: [{ at: 110, width: 50, shift: 10, sat: 1 }, { at: 215, width: 45, shift: -6, sat: 0.9 }, { at: 25, width: 30, sat: 0.92 }],
      split: { shadow: [0.48, 0.51, 0.515], high: [0.51, 0.51, 0.49], amt: 0.18 }, black: [0.06, 0.07, 0.07], white: [0.97, 0.975, 0.955] },
    ch: { ...grain(200), fade: 0.05 } },
  { id: 'f_fh400', code: 'FH 400', cat: 'ret', ref: 'Fujifilm Pro 400H', kind: 'negativo cor · ISO 400 · claro, verdes menta',
    look: { wb: [0.985, 1, 1.02], contrast: 2.6, pivot: 0.45, sat: 0.82, gamma: [0.95, 0.94, 0.94],
      hues: [{ at: 110, width: 50, shift: 20, sat: 0.8 }, { at: 215, width: 45, shift: -10, sat: 0.8 }, { at: 25, width: 30, sat: 1, val: 1.04 }],
      split: { shadow: [0.47, 0.505, 0.53], high: [0.51, 0.51, 0.49], amt: 0.16 }, black: [0.07, 0.075, 0.08], white: [0.98, 0.98, 0.975] },
    ch: { ...grain(400) } },
  { id: 'f_av200', code: 'AV 200', cat: 'neg', ref: 'Agfa Vista 200', kind: 'negativo cor · ISO 200 · vermelhos intensos',
    look: { wb: [1.03, 0.99, 0.96], contrast: 4.6, sat: 1.2,
      hues: [{ at: 0, width: 30, shift: -3, sat: 1.2 }, { at: 320, width: 35, sat: 1.1 }, { at: 115, width: 50, shift: 4, sat: 1.05 }, { at: 225, width: 45, shift: 6, sat: 1.15 }],
      split: { shadow: [0.5, 0.5, 0.51], high: [0.54, 0.5, 0.48], amt: 0.15 }, black: [0.035, 0.03, 0.035], white: [0.985, 0.965, 0.95] },
    ch: { ...grain(200) } },
  { id: 'f_ao100', code: 'AO 100', cat: 'neg', ref: 'Agfa Optima 100', kind: 'negativo cor · ISO 100 · natural e fino',
    look: { wb: [0.995, 1, 1], contrast: 4, sat: 1,
      hues: [{ at: 0, width: 30, sat: 1.05 }, { at: 110, width: 50, shift: -4, sat: 0.95 }, { at: 25, width: 30, val: 1.02 }],
      split: { shadow: [0.49, 0.5, 0.515], high: [0.5, 0.5, 0.5], amt: 0.1 }, black: [0.03, 0.03, 0.035], white: [0.99, 0.99, 0.98] },
    ch: { ...grain(100) } },
  { id: 'f_fn1600', code: 'FN 1600', cat: 'cine', ref: 'Fujifilm Natura 1600', kind: 'negativo cor · ISO 1600 · noite e luz baixa',
    look: { wb: [1.02, 1, 0.97], contrast: 3, sat: 0.95,
      hues: [{ at: 110, width: 50, shift: 6, sat: 0.95 }],
      split: { shadow: [0.48, 0.5, 0.52], high: [0.54, 0.515, 0.47], amt: 0.2 }, black: [0.07, 0.065, 0.065], white: [0.97, 0.96, 0.94] },
    ch: { ...grain(1600) } },
  { id: 'f_cs800', code: 'CS 800T', cat: 'cine', ref: 'CineStill 800T', kind: 'negativo de cinema · ISO 800 · tungstênio, halação vermelha',
    look: { wb: [0.9, 0.98, 1.12], contrast: 3.8, sat: 1,
      hues: [{ at: 0, width: 30, sat: 1.15 }, { at: 30, width: 25, shift: -4 }, { at: 190, width: 35, sat: 1.1 }, { at: 220, width: 40, shift: -8, sat: 1.1 }],
      split: { shadow: [0.46, 0.5, 0.55], high: [0.53, 0.5, 0.48], amt: 0.22 }, black: [0.03, 0.04, 0.055], white: [0.98, 0.975, 0.98] },
    ch: { ...grain(800), halo: 0.55, haloR: 0.55, haloT: 0.45 } },

  { id: 'f_fpn160', code: 'FPN 160', cat: 'ret', ref: 'Fujifilm Pro 160NS', kind: 'negativo cor · ISO 160 · frio e suave, verdes naturais',
    look: { wb: [0.99, 1, 1.015], contrast: 3, pivot: 0.47, sat: 0.9, satHigh: 0.85,
      hues: [{ at: 110, width: 50, shift: 12, sat: 0.88 }, { at: 215, width: 45, shift: -6, sat: 0.88 }, { at: 25, width: 30, sat: 0.95, val: 1.03 }],
      split: { shadow: [0.475, 0.505, 0.525], high: [0.515, 0.51, 0.49], amt: 0.15 }, black: [0.055, 0.06, 0.065], white: [0.98, 0.98, 0.975] },
    ch: { ...grain(160, { mul: 0.9 }) } },
  { id: 'f_fr100', code: 'FR 100', cat: 'neg', ref: 'Fujifilm Reala 100', kind: 'negativo cor · ISO 100 · cor fiel, contraste suave, grão fino',
    look: { wb: [1, 1, 1.005], contrast: 3.4, sat: 0.98,
      hues: [{ at: 110, width: 50, shift: 6, sat: 0.95 }, { at: 0, width: 30, sat: 1.02 }, { at: 215, width: 45, sat: 0.95 }],
      split: { shadow: [0.485, 0.5, 0.515], high: [0.515, 0.505, 0.48], amt: 0.1 }, black: [0.045, 0.048, 0.05], white: [0.98, 0.978, 0.97] },
    ch: { ...grain(100, { mul: 0.85 }) } },
  { id: 'f_kc200', code: 'KC 200', cat: 'neg', ref: 'Kodak ColorPlus 200', kind: 'negativo cor · ISO 200 · quente e suave, cor contida',
    look: { wb: [1.025, 1, 0.955], contrast: 3.4, sat: 0.86, satHigh: 0.85,
      hues: [{ at: 55, width: 35, sat: 1.05 }, { at: 110, width: 50, shift: -6, sat: 0.8 }, { at: 220, width: 45, sat: 0.82 }],
      split: { shadow: [0.5, 0.49, 0.5], high: [0.54, 0.515, 0.47], amt: 0.18 }, black: [0.06, 0.055, 0.05], white: [0.975, 0.965, 0.93] },
    ch: { ...grain(200, { mul: 1.1 }) } },
  { id: 'f_kv250', code: 'KV 250D', cat: 'cine', ref: 'Kodak Vision3 250D', kind: 'negativo de cinema · ISO 250 · luz do dia, contraste baixo, latitude enorme',
    look: { wb: [1, 1, 0.99], contrast: 2.4, pivot: 0.45, sat: 0.9,
      hues: [{ at: 25, width: 30, val: 1.02 }, { at: 190, width: 35, sat: 1.05 }, { at: 110, width: 50, shift: 4, sat: 0.85 }],
      split: { shadow: [0.48, 0.5, 0.52], high: [0.525, 0.51, 0.48], amt: 0.14 }, black: [0.06, 0.062, 0.068], white: [0.975, 0.97, 0.96] },
    ch: { ...grain(200, { mul: 0.9 }), halo: 0.08 } },
  { id: 'f_kv500', code: 'KV 500T', cat: 'cine', ref: 'Kodak Vision3 500T', kind: 'negativo de cinema · ISO 500 · tungstênio, sombras azuladas, sem a halação forte',
    look: { wb: [0.92, 0.985, 1.1], contrast: 3, sat: 0.92,
      hues: [{ at: 0, width: 30, sat: 1.05 }, { at: 220, width: 40, shift: -6, sat: 1.05 }],
      split: { shadow: [0.465, 0.5, 0.54], high: [0.53, 0.505, 0.48], amt: 0.2 }, black: [0.04, 0.05, 0.065], white: [0.975, 0.97, 0.975] },
    ch: { ...grain(400, { mul: 1.15 }), halo: 0.12 } },

  // ---------------------------------------------------------------- preto e branco
  { id: 'f_kt400', code: 'KT 400', cat: 'pbg', ref: 'Kodak Tri-X 400', kind: 'P&B · ISO 400 · contraste forte, grão marcado',
    look: { bw: [0.32, 0.56, 0.12], contrast: 5.2, pivot: 0.48, gamma: [0.97], tone: [1, 0.995, 0.985], black: [0.03, 0.03, 0.03], white: [0.97, 0.97, 0.96] },
    ch: { ...grain(400, { bw: true, mul: 1.1 }) } },
  { id: 'f_kt1600', code: 'KT 1600', cat: 'pbg', ref: 'Kodak Tri-X 400 puxado para 1600', kind: 'P&B · push 2 pontos · preto fechado, grão grosso',
    look: { bw: [0.32, 0.56, 0.12], contrast: 7.5, pivot: 0.52, gamma: [1.05], tone: [1, 0.995, 0.985], black: [0.015, 0.015, 0.015], white: [0.985, 0.985, 0.975] },
    ch: { ...grain(1600, { bw: true, mul: 1.0 }) } },
  { id: 'f_ih400', code: 'IH 400', cat: 'pbg', ref: 'Ilford HP5 Plus 400', kind: 'P&B · ISO 400 · contraste médio, versátil',
    look: { bw: [0.3, 0.58, 0.12], contrast: 4, black: [0.05, 0.05, 0.05], white: [0.965, 0.965, 0.965] },
    ch: { ...grain(400, { bw: true, mul: 1.05 }) } },
  { id: 'f_ih1600', code: 'IH 1600', cat: 'pbg', ref: 'Ilford HP5 Plus puxado para 1600', kind: 'P&B · push 2 pontos · granulado e dramático',
    look: { bw: [0.3, 0.58, 0.12], contrast: 6.2, pivot: 0.5, black: [0.03, 0.03, 0.03], white: [0.975, 0.975, 0.975] },
    ch: { ...grain(1600, { bw: true, mul: 0.95 }) } },
  { id: 'f_km100', code: 'KM 100', cat: 'pb', ref: 'Kodak T-Max 100', kind: 'P&B · ISO 100 · limpo, grão finíssimo',
    look: { bw: [0.28, 0.6, 0.12], contrast: 4.4, tone: [0.99, 1, 1.01], black: [0.025, 0.025, 0.025], white: [0.98, 0.98, 0.98] },
    ch: { ...grain(100, { bw: true }) } },
  { id: 'f_fa100', code: 'FA 100', cat: 'pb', ref: 'Fujifilm Acros 100', kind: 'P&B · ISO 100 · pretos profundos, céu escuro',
    look: { bw: [0.42, 0.53, 0.05], contrast: 4.8, pivot: 0.5, tone: [0.995, 1, 1.005], black: [0.015, 0.015, 0.015], white: [0.975, 0.975, 0.975] },
    ch: { ...grain(100, { bw: true, mul: 0.85 }) } },
  { id: 'f_ip50', code: 'IP 50', cat: 'pb', ref: 'Ilford Pan F Plus 50', kind: 'P&B · ISO 50 · contraste alto, sem grão aparente',
    look: { bw: [0.3, 0.6, 0.1], contrast: 5.6, black: [0.01, 0.01, 0.01], white: [0.985, 0.985, 0.985] },
    ch: { ...grain(50, { bw: true }) } },
  { id: 'f_id3200', code: 'ID 3200', cat: 'pbg', ref: 'Ilford Delta 3200', kind: 'P&B · ISO 3200 · grão muito grosso, tons suaves',
    look: { bw: [0.3, 0.58, 0.12], contrast: 3.4, gamma: [0.95], black: [0.07, 0.07, 0.07], white: [0.95, 0.95, 0.95] },
    ch: { ...grain(3200, { bw: true, mul: 0.9 }) } },

  { id: 'f_km400', code: 'KM 400', cat: 'pb', ref: 'Kodak T-Max 400', kind: 'P&B · ISO 400 · nítido, grão fino, tons limpos',
    look: { bw: [0.29, 0.59, 0.12], contrast: 4.6, tone: [0.995, 1, 1.005], black: [0.025, 0.025, 0.025], white: [0.975, 0.975, 0.975] },
    ch: { ...grain(400, { bw: true, mul: 0.7 }) } },
  { id: 'f_fnp400', code: 'FNP 400', cat: 'pbg', ref: 'Fujifilm Neopan 400', kind: 'P&B · ISO 400 · tons ricos, grão definido',
    look: { bw: [0.31, 0.57, 0.12], contrast: 4.4, pivot: 0.49, black: [0.035, 0.035, 0.035], white: [0.97, 0.97, 0.97] },
    ch: { ...grain(400, { bw: true, mul: 0.9 }) } },
  { id: 'f_if125', code: 'IF 125', cat: 'pb', ref: 'Ilford FP4 Plus 125', kind: 'P&B · ISO 125 · clássico, meios-tons longos',
    look: { bw: [0.3, 0.58, 0.12], contrast: 3.8, gamma: [0.98], tone: [1, 0.998, 0.992], black: [0.04, 0.04, 0.04], white: [0.97, 0.97, 0.97] },
    ch: { ...grain(160, { bw: true, mul: 0.85 }) } },
  { id: 'f_ix400', code: 'IX 400', cat: 'pb', ref: 'Ilford XP2 Super 400', kind: 'P&B cromogênico · ISO 400 · suave, grão macio, luzes amplas',
    look: { bw: [0.3, 0.59, 0.11], contrast: 3.2, pivot: 0.46, gamma: [0.96], tone: [1, 0.995, 0.985], black: [0.05, 0.05, 0.05], white: [0.975, 0.975, 0.975] },
    // cromogênico: o grão é de nuvens de corante (macias), não de prata; quase sem cor
    ch: { ...grain(400, { bw: true, mul: 0.6 }), gcolor: 0.02 } },
  { id: 'f_ax100', code: 'AX 100', cat: 'pb', ref: 'Agfa APX 100', kind: 'P&B · ISO 100 · contraste médio, tons prateados',
    look: { bw: [0.31, 0.57, 0.12], contrast: 4.2, tone: [0.995, 1, 1.008], black: [0.03, 0.03, 0.03], white: [0.975, 0.975, 0.975] },
    ch: { ...grain(100, { bw: true }) } },

  // ---------------------------------------------------------------- slide (cromo)
  { id: 'f_fv50', code: 'FV 50', cat: 'slide', ref: 'Fujifilm Velvia 50', kind: 'slide · ISO 50 · saturação extrema, paisagem',
    look: { contrast: 6, pivot: 0.52, sat: 1.45, satShadow: 1.2,
      hues: [{ at: 110, width: 50, shift: 6, sat: 1.3 }, { at: 220, width: 45, shift: 4, sat: 1.3 }, { at: 0, width: 30, shift: -2, sat: 1.25 }, { at: 300, width: 40, sat: 1.2 }, { at: 25, width: 25, shift: -3, sat: 1.1 }],
      split: { shadow: [0.49, 0.49, 0.53], high: [0.5, 0.5, 0.5], amt: 0.12 }, black: [0, 0, 0.01], white: [0.98, 0.98, 0.975] },
    ch: { ...grain(50), vig: 0.1 } },
  { id: 'f_fp100', code: 'FP 100', cat: 'slide', ref: 'Fujifilm Provia 100F', kind: 'slide · ISO 100 · fiel e equilibrado',
    look: { contrast: 5.2, sat: 1.15,
      hues: [{ at: 220, width: 45, sat: 1.1 }, { at: 110, width: 50, sat: 1.05 }],
      black: [0.01, 0.01, 0.012], white: [0.985, 0.985, 0.985] },
    ch: { ...grain(100, { mul: 0.7 }) } },
  { id: 'f_fas100', code: 'FAS 100', cat: 'slide', ref: 'Fujifilm Astia 100F', kind: 'slide · ISO 100 · contraste suave, pele natural',
    look: { contrast: 4.2, sat: 1.05,
      hues: [{ at: 25, width: 30, val: 1.02 }, { at: 220, width: 45, sat: 1.05 }],
      split: { shadow: [0.49, 0.5, 0.51], high: [0.51, 0.505, 0.49], amt: 0.06 }, black: [0.015, 0.015, 0.018], white: [0.985, 0.985, 0.985] },
    ch: { ...grain(100, { mul: 0.6 }) } },
  { id: 'f_kx100', code: 'KX 100', cat: 'slide', ref: 'Kodak Ektachrome E100', kind: 'slide · ISO 100 · limpo, azuis ricos',
    look: { wb: [0.985, 1, 1.03], contrast: 5, sat: 1.18,
      hues: [{ at: 220, width: 45, shift: -3, sat: 1.2 }, { at: 190, width: 35, sat: 1.15 }, { at: 0, width: 30, sat: 1.05 }],
      split: { shadow: [0.48, 0.5, 0.53], high: [0.5, 0.5, 0.5], amt: 0.12 }, black: [0.01, 0.012, 0.02], white: [0.98, 0.985, 0.99] },
    ch: { ...grain(100, { mul: 0.75 }) } },
  { id: 'f_kd64', code: 'KD 64', cat: 'slide', ref: 'Kodachrome 64', kind: 'slide · ISO 64 · vermelhos e amarelos clássicos, sombras densas',
    look: { wb: [1.02, 1, 0.97], contrast: 5.6, pivot: 0.5, sat: 1.2,
      hues: [{ at: 0, width: 30, shift: 2, sat: 1.25 }, { at: 50, width: 35, shift: -4, sat: 1.2 }, { at: 220, width: 45, shift: 6, sat: 1.15 }, { at: 110, width: 50, shift: -8, sat: 0.95 }, { at: 25, width: 25, sat: 1.05 }],
      split: { shadow: [0.49, 0.49, 0.5], high: [0.53, 0.51, 0.47], amt: 0.12 }, black: [0.02, 0.015, 0.015], white: [0.98, 0.97, 0.94] },
    ch: { ...grain(100, { mul: 0.8 }) } },
  { id: 'f_ar100', code: 'AR 100', cat: 'slide', ref: 'Agfa RSX II 100', kind: 'slide · ISO 100 · quente e dourado',
    look: { wb: [1.025, 1, 0.96], contrast: 4.6, sat: 1.1,
      hues: [{ at: 55, width: 35, sat: 1.1 }, { at: 25, width: 30, val: 1.02 }, { at: 110, width: 50, shift: -5 }],
      split: { shadow: [0.5, 0.5, 0.5], high: [0.54, 0.515, 0.47], amt: 0.15 }, black: [0.02, 0.02, 0.02], white: [0.98, 0.97, 0.94] },
    ch: { ...grain(100, { mul: 0.8 }) } },

  // ---------------------------------------------------------------- vencido e vintage
  { id: 'f_kg200v', code: 'KG 200 V', cat: 'old', ref: 'Kodak Gold 200 vencido', kind: 'filme vencido · cor desviada, sombras magenta',
    look: { wb: [1.05, 0.98, 0.91], contrast: 3.1, sat: 0.85,
      hues: [{ at: 110, width: 50, shift: -18, sat: 0.7 }, { at: 215, width: 45, shift: 10, sat: 0.65 }],
      split: { shadow: [0.53, 0.47, 0.5], high: [0.555, 0.53, 0.43], amt: 0.28 }, black: [0.085, 0.07, 0.078], white: [0.96, 0.94, 0.86] },
    ch: { ...grain(800, { mul: 1.2, cmul: 1.6 }), fade: 0.12, vig: 0.15 } },
  { id: 'f_fs400v', code: 'FS 400 V', cat: 'old', ref: 'Fujifilm Superia 400 vencido', kind: 'filme vencido · tom ciano-esverdeado, desbotado',
    look: { wb: [0.95, 1.02, 1], contrast: 2.6, sat: 0.78,
      hues: [{ at: 0, width: 30, shift: 8, sat: 0.8 }, { at: 110, width: 50, shift: 15, sat: 0.85 }],
      split: { shadow: [0.45, 0.53, 0.52], high: [0.52, 0.52, 0.46], amt: 0.32 }, black: [0.1, 0.12, 0.12], white: [0.94, 0.95, 0.9] },
    ch: { ...grain(800, { mul: 1.2, cmul: 1.6 }), fade: 0.12 } },
  { id: 'f_av200v', code: 'AV 200 V', cat: 'old', ref: 'Agfa Vista 200 vencido', kind: 'filme vencido · rosado e enevoado',
    look: { wb: [1.03, 0.975, 0.98], contrast: 3, sat: 0.88,
      split: { shadow: [0.52, 0.47, 0.515], high: [0.545, 0.505, 0.49], amt: 0.22 }, black: [0.1, 0.075, 0.09], white: [0.965, 0.925, 0.925] },
    ch: { ...grain(800, { mul: 1.1, cmul: 1.6 }), fade: 0.1 } },
  { id: 'f_c70', code: 'C 70', cat: 'old', ref: 'cópia de álbum dos anos 70', kind: 'vintage · amarelada e desbotada pelo tempo',
    look: { wb: [1.05, 1, 0.85], contrast: 2.4, sat: 0.7,
      hues: [{ at: 220, width: 45, shift: 15, sat: 0.5 }, { at: 0, width: 30, shift: 6, sat: 0.9 }],
      split: { shadow: [0.52, 0.48, 0.47], high: [0.57, 0.53, 0.4], amt: 0.3 }, black: [0.13, 0.1, 0.08], white: [0.94, 0.9, 0.76] },
    ch: { ...grain(200, { mul: 1.1 }), fade: 0.2, vig: 0.2 } },
  { id: 'f_c80', code: 'C 80', cat: 'old', ref: 'cópia de álbum dos anos 80', kind: 'vintage · rosada, contraste baixo',
    look: { contrast: 3, sat: 0.85,
      split: { shadow: [0.5, 0.48, 0.53], high: [0.54, 0.5, 0.49], amt: 0.25 }, black: [0.09, 0.07, 0.09], white: [0.96, 0.92, 0.92] },
    ch: { ...grain(200), fade: 0.12, vig: 0.12 } },
  { id: 'f_inst', code: 'INST', cat: 'old', ref: 'filme instantâneo', kind: 'instantânea · sombras ciano, luzes quentes, suave',
    look: { contrast: 2.6, pivot: 0.45, sat: 0.8, gamma: [0.94, 0.95, 0.97],
      hues: [{ at: 110, width: 50, shift: 14, sat: 0.8 }],
      split: { shadow: [0.45, 0.51, 0.54], high: [0.55, 0.53, 0.46], amt: 0.3 }, black: [0.1, 0.12, 0.13], white: [0.96, 0.95, 0.88] },
    ch: { ...grain(160), fade: 0.1, vig: 0.22, bloom: 0.15 } },
  { id: 'f_desc', code: 'DESC', cat: 'old', ref: 'câmera descartável', kind: 'descartável · cor forte, lente simples, vinheta',
    look: { wb: [1.03, 1, 0.94], contrast: 4.6, sat: 1.15,
      split: { shadow: [0.5, 0.5, 0.5], high: [0.55, 0.52, 0.45], amt: 0.2 }, black: [0.05, 0.04, 0.04], white: [0.97, 0.96, 0.9] },
    ch: { ...grain(400, { mul: 1.1 }), vig: 0.35, vlens: 0.3 } },

];

// Chaves de caráter que um filme pode definir. Ao trocar de filme, o caráter do anterior sai
// (se você não mexeu nele) e o do novo entra; luz, cor, corte e moldura ficam como estão.
export const CH_KEYS = ['grain', 'gsize', 'grough', 'gcolor', 'halo', 'haloR', 'haloT', 'bloom', 'bloomR', 'fade', 'vig', 'vlens'];

// ---------------------------------------------------------------- ajustes do Laboratório
const copy = (o) => JSON.parse(JSON.stringify(o));
// look de cada filme como está escrito acima (antes de qualquer ajuste)
export const FILM_SRC = Object.fromEntries(FILMS.map((f) => [f.id, copy(f.look)]));
// 1) ajustes publicados (film-looks.js)
for (const f of FILMS) if (FILM_LOOKS[f.id]) f.look = copy(FILM_LOOKS[f.id]);
// look "de fábrica" desta versão do app: o que o botão Desfazer edições do Laboratório restaura
export const FILM_FILE = Object.fromEntries(FILMS.map((f) => [f.id, copy(f.look)]));
// 2) ajustes feitos no Laboratório deste aparelho
const LS = 'revela.filmLooks';
export function savedFilmLooks() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { return {}; } }
export function saveFilmLooks(o) { try { localStorage.setItem(LS, JSON.stringify(o)); return true; } catch { return false; } }
export function clearFilmLooks() { try { localStorage.removeItem(LS); } catch { /* ok */ } }
for (const [id, l] of Object.entries(savedFilmLooks())) { const f = FILMS.find((x) => x.id === id); if (f && l) f.look = copy(l); }
