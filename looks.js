// Looks originais do Revela. Cada look é uma receita de parâmetros que gera uma LUT 3D.
// Nada aqui foi copiado de presets de terceiros: são curvas e tons definidos do zero.

import { LOOKS } from './looks-data.js';

export const LUT_N = 33;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function scurve(x, k, p = 0.5) {
  if (k < 0.01) return x;
  const s = (t) => 1 / (1 + Math.exp(-k * (t - p)));
  const s0 = s(0), s1 = s(1);
  return (s(x) - s0) / (s1 - s0);
}

function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx > 0 ? d / mx : 0, mx];
}

function hsv2rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Receita -> função (r,g,b) => [r,g,b]
export function makeLook(p) {
  return (r, g, b) => {
    if (p.wb) { r *= p.wb[0]; g *= p.wb[1]; b *= p.wb[2]; }

    if (p.bw) {
      let l = clamp(p.bw[0] * r + p.bw[1] * g + p.bw[2] * b);
      l = scurve(l, p.contrast ?? 0, p.pivot ?? 0.5);
      if (p.gamma) l = Math.pow(l, p.gamma[0]);
      const t = p.tone || [1, 1, 1];
      r = l * t[0]; g = l * t[1]; b = l * t[2];
    } else {
      if (p.hues) {
        let [h, s, v] = rgb2hsv(clamp(r), clamp(g), clamp(b));
        let dh = 0, sm = 1, vm = 1;
        for (const z of p.hues) {
          const w = Math.max(0, 1 - hueDist(h, z.at) / z.width);
          const ww = w * w * (3 - 2 * w);
          dh += (z.shift || 0) * ww;
          sm *= 1 + ((z.sat ?? 1) - 1) * ww;
          vm *= 1 + ((z.val ?? 1) - 1) * ww * s;
        }
        [r, g, b] = hsv2rgb((h + dh + 360) % 360, clamp(s * sm), clamp(v * vm));
      }
      // saturação global e por luminância
      const l0 = luma(r, g, b);
      const satL = (p.sat ?? 1) * (1 + ((p.satShadow ?? 1) - 1) * (1 - l0) ** 2 + ((p.satHigh ?? 1) - 1) * l0 ** 2);
      r = l0 + (r - l0) * satL; g = l0 + (g - l0) * satL; b = l0 + (b - l0) * satL;
      // curva
      const k = p.contrast ?? 0, pv = p.pivot ?? 0.5;
      r = scurve(clamp(r), k, pv); g = scurve(clamp(g), k, pv); b = scurve(clamp(b), k, pv);
      if (p.gamma) { r = Math.pow(r, p.gamma[0]); g = Math.pow(g, p.gamma[1]); b = Math.pow(b, p.gamma[2]); }
    }

    // split toning
    if (p.split) {
      const l = luma(r, g, b), a = p.split.amt;
      const ws = (1 - l) ** 2 * a, wh = l ** 2 * a;
      r += (p.split.shadow[0] - 0.5) * ws + (p.split.high[0] - 0.5) * wh;
      g += (p.split.shadow[1] - 0.5) * ws + (p.split.high[1] - 0.5) * wh;
      b += (p.split.shadow[2] - 0.5) * ws + (p.split.high[2] - 0.5) * wh;
    }
    // preto levantado e branco comprimido
    const bl = p.black || [0, 0, 0], wh = p.white || [1, 1, 1];
    r = bl[0] + clamp(r) * (wh[0] - bl[0]);
    g = bl[1] + clamp(g) * (wh[1] - bl[1]);
    b = bl[2] + clamp(b) * (wh[2] - bl[2]);
    return [clamp(r), clamp(g), clamp(b)];
  };
}

export { LOOKS };

const LS_KEY = 'revela.looks';
// Looks editados no Laboratório (salvos neste aparelho) têm prioridade sobre os do arquivo.
export function getLooks() {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) {
      const v = JSON.parse(s);
      // Looks salvos no Lab têm prioridade; looks novos do arquivo entram no fim.
      if (Array.isArray(v) && v.length) return [...v, ...LOOKS.filter((l) => !v.some((x) => x.id === l.id))];
    }
  } catch { /* sem armazenamento */ }
  return LOOKS;
}
export function saveLooks(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
export function clearSavedLooks() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ok */ }
}

// Gera dados RGBA Float32 na ordem r mais rápido (x), g (y), b (z), como .cube e textura 3D.
export function buildLutData(recipe, n = LUT_N) {
  const fn = makeLook(recipe);
  const data = new Float32Array(n * n * n * 4);
  let i = 0;
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++) {
        const o = fn(r / (n - 1), g / (n - 1), b / (n - 1));
        data[i++] = o[0]; data[i++] = o[1]; data[i++] = o[2]; data[i++] = 1;
      }
  return data;
}

export function identityLut(n = 2) {
  return buildLutData({}, n);
}

// Lê texto .cube e devolve { size, data } no mesmo formato
export function parseCube(text) {
  let size = 0, dmin = [0, 0, 0], dmax = [1, 1, 1];
  const vals = [];
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || s[0] === '#') continue;
    const u = s.toUpperCase();
    if (u.startsWith('LUT_3D_SIZE')) size = parseInt(s.split(/\s+/)[1], 10);
    else if (u.startsWith('LUT_1D_SIZE')) throw new Error('LUT 1D não é suportada');
    else if (u.startsWith('DOMAIN_MIN')) dmin = s.split(/\s+/).slice(1, 4).map(Number);
    else if (u.startsWith('DOMAIN_MAX')) dmax = s.split(/\s+/).slice(1, 4).map(Number);
    else if (/^[A-Z]/.test(u)) continue;
    else {
      const p = s.split(/\s+/);
      if (p.length >= 3) vals.push(+p[0], +p[1], +p[2]);
    }
  }
  if (!size) throw new Error('arquivo sem LUT_3D_SIZE');
  if (vals.length !== size ** 3 * 3) throw new Error(`esperava ${size ** 3} linhas, achei ${vals.length / 3}`);
  void dmin; void dmax;
  const data = new Float32Array(size ** 3 * 4);
  for (let i = 0, j = 0; i < vals.length; i += 3) {
    data[j++] = vals[i]; data[j++] = vals[i + 1]; data[j++] = vals[i + 2]; data[j++] = 1;
  }
  return { size, data };
}
