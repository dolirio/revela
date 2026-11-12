// Estado da edição, geometria, curvas, vazamentos de luz e leitura de arquivos.

export const HSL_NAMES = ['Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Ciano', 'Azul', 'Roxo', 'Magenta'];
export const HSL_COLORS = ['#d8453a', '#e58a32', '#e6c93a', '#4caa4a', '#3cb8c2', '#3b6fd6', '#7b4fd0', '#c94aa8'];

// Geometria: tudo o que muda o enquadramento. Receitas e copiar/colar não mexem nisso.
export const GEO_KEYS = ['rot', 'flip', 'straight', 'aspect', 'persV', 'persH', 'lens', 'crop'];
// Itens que a receita também preserva (decoração escolhida para esta foto)
export const KEEP_KEYS = [...GEO_KEYS, 'frame', 'date', 'dateText'];

export function defaults() {
  return {
    look: 'none', mix: 1, ftone: 0, fcol: 0, recipe: null, filmCh: null,
    exp: 0, bright: 0, con: 0, high: 0, shad: 0, white: 0, black: 0,
    temp: 0, tint: 0, sat: 0, vib: 0, depth: 0, clar: 0,
    sharp: 0, srad: 1, soft: 0, eblur: 0, bloom: 0, bloomR: 0.5, halo: 0, haloR: 0.5, haloT: 0.5, vlens: 0,
    grain: 0, gsize: 1.6, grough: 0.4, gcolor: 0, gfmt: 0, paper: 0, paperType: 0, paperSeed: 0,
    gfx: 0, gfxAmt: 1, gfxSize: 0.5, gfxCon: 0, gfxDuo: 0, gfxTri: 0,
    fade: 0, vig: 0, chroma: 0,
    leak: 0, leakType: 0, leakSeed: 1, dust: 0, dustType: 1, dustSeed: 0, scratch: 0, scrType: 0, scrSeed: 0, chromaType: 0, seed: 0,
    hsl: Array.from({ length: 8 }, () => ({ h: 0, s: 0, l: 0 })),
    curve: { m: [[0, 0], [1, 1]], r: [[0, 0], [1, 1]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] },
    rot: 0, flip: false, straight: 0, aspect: 'orig', persV: 0, persH: 0, lens: 0, crop: [0, 0, 1, 1],
    frame: 'none', date: false, dateText: '',
  };
}

// Mescla um estado parcial (ex.: receita salva) sobre os padrões
export function withDefaults(s) {
  const d = defaults();
  const o = { ...d, ...JSON.parse(JSON.stringify(s || {})) };
  if (!Array.isArray(o.hsl) || o.hsl.length !== 8) o.hsl = d.hsl;
  o.curve = { ...d.curve, ...(o.curve || {}) };
  if (!Array.isArray(o.crop) || o.crop.length !== 4) o.crop = d.crop;
  return o;
}

// ------------------------------------------------------------ geometria e moldura
export const ASPECTS = { livre: null, orig: null, '1:1': 1, '4:5': 0.8, '5:4': 1.25, '3:2': 1.5, '2:3': 2 / 3, '16:9': 16 / 9, '9:16': 9 / 16 };
// sides: topo, direita, baixo, esquerda (fração de base: 'w' largura da foto, 'h' altura, 'long' lado maior)
export const FRAMES = {
  none: null,
  branca: { name: 'Branca', col: [0.985, 0.98, 0.97], sides: [0.04, 0.04, 0.04, 0.04], base: 'long' },
  preta: { name: 'Preta', col: [0.04, 0.04, 0.04], sides: [0.04, 0.04, 0.04, 0.04], base: 'long' },
  instant: { name: 'Instantânea', col: [0.955, 0.945, 0.92], sides: [0.06, 0.06, 0.24, 0.06], base: 'w' },
  filme: { name: 'Filme', col: [0.035, 0.035, 0.035], sides: [0.035, 0.035, 0.035, 0.035], base: 'long', round: 0.012 },
  negativo: { name: 'Negativo 35', col: [0.03, 0.028, 0.026], sides: [0.155, 0.03, 0.155, 0.03], base: 'w', holes: true, text: 'neg' },
  medio: { name: 'Médio 120', col: [0.02, 0.02, 0.02], sides: [0.06, 0.05, 0.06, 0.05], base: 'long', rough: 1, text: 'medio' },
  cromo: { name: 'Cromo', col: [0.86, 0.85, 0.82], sides: [0.13, 0.17, 0.13, 0.17], base: 'h', round: 0.035, text: 'cromo' },
};

const mul = (a, b) => {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};
const colMajor = (M) => new Float32Array([M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]]);
const FOCAL = 1.6;           // distância focal da "câmera virtual" (em meias-diagonais)
const MAX_TILT = 0.42;       // rad para o controle no máximo (~24°)

// Perspectiva: gira o plano da foto em 3D e reprojeta (corrige linhas convergentes)
export function perspMatrix(v, h, aa, bb) {
  const a = aa ?? -v * MAX_TILT, b = bb ?? h * MAX_TILT;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const Rx = [1, 0, 0, 0, ca, -sa, 0, sa, ca];
  const Ry = [cb, 0, sb, 0, 1, 0, -sb, 0, cb];
  const K = [FOCAL, 0, 0, 0, FOCAL, 0, 0, 0, 1], Ki = [1 / FOCAL, 0, 0, 0, 1 / FOCAL, 0, 0, 0, 1];
  return mul(K, mul(mul(Rx, Ry), Ki));
}

// W0,H0: dimensões da foto original. opt.full = mostra a área toda disponível (para editar o corte), sem moldura.
// opt.zoom = [x, y, w, h] janela da foto (lupa).
export function computeView(s, W0, H0, opt = {}) {
  const k = (((s.rot || 0) % 4) + 4) % 4;
  const W = k % 2 ? H0 : W0, H = k % 2 ? W0 : H0;
  const D = 0.5 * Math.hypot(W, H);
  const limX = W / (2 * D), limY = H / (2 * D);
  const A = ASPECTS[s.aspect] ?? W / H;
  const th = ((s.straight || 0) * Math.PI) / 180, c = Math.cos(th), sn = Math.sin(th);
  const Hp = perspMatrix(s.persV || 0, s.persH || 0);
  const lens = -(s.lens || 0) * 0.32;   // positivo corrige barril

  // Maior retângulo da proporção A que cabe inteiro na foto depois das correções.
  // O centro (ox, oy) também é procurado: com perspectiva a área útil vira um trapézio deslocado.
  const ok = (qx, qy, ox, oy) => {
    const x = c * qx + sn * qy + ox, y = -sn * qx + c * qy + oy;
    const hz = Hp[6] * x + Hp[7] * y + Hp[8];
    if (hz <= 1e-4) return false;
    let px = (Hp[0] * x + Hp[1] * y + Hp[2]) / hz, py = (Hp[3] * x + Hp[4] * y + Hp[5]) / hz;
    const f = 1 + lens * (px * px + py * py); px *= f; py *= f;
    return Math.abs(px) <= limX + 1e-6 && Math.abs(py) <= limY + 1e-6;
  };
  const fitT = (ox, oy, iters = 22) => {
    const fits = (t) => {
      const N = 20;
      for (let i = 0; i <= N; i++) {
        const u = -1 + (2 * i) / N;
        if (!ok(u * A * t, -t, ox, oy) || !ok(u * A * t, t, ox, oy) || !ok(-A * t, u * t, ox, oy) || !ok(A * t, u * t, ox, oy)) return false;
      }
      return true;
    };
    let lo = 0, hi = 2 * Math.max(limX, limY);
    for (let i = 0; i < iters; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    return lo;
  };
  let t, ox = 0, oy = 0;
  if (!s.persV && !s.persH && !lens && !th) t = Math.min(limY, limX / A);
  else {
    if (s.persV || s.persH) {
      // ponto de partida: onde o centro da foto vai parar depois da perspectiva
      const ia = (s.persV || 0) * MAX_TILT, ib = -(s.persH || 0) * MAX_TILT;
      const Hi = perspMatrix(0, 0, ia, ib);
      ox = Hi[2] / Hi[8]; oy = Hi[5] / Hi[8];
      let step = 0.25 * Math.max(limX, limY);
      t = fitT(ox, oy, 14);
      for (let r = 0; r < 7; r++, step /= 2) {
        for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
          const tt = fitT(ox + dx, oy + dy, 14);
          if (tt > t) { t = tt; ox += dx; oy += dy; }
        }
      }
    }
    t = fitT(ox, oy, 26);
  }
  const cr = opt.full ? [0, 0, 1, 1] : (s.crop || [0, 0, 1, 1]);
  const x0 = -A * t + 2 * A * t * cr[0], x1 = -A * t + 2 * A * t * cr[2];
  const y0 = -t + 2 * t * cr[1], y1 = -t + 2 * t * cr[3];
  const w = (x1 - x0) * D, h = (y1 - y0) * D;

  // P: saída (0..1) -> coordenada normalizada da foto antes da lente
  const P = mul(Hp, mul([c, sn, ox, -sn, c, oy, 0, 0, 1], [x1 - x0, 0, x0, 0, y1 - y0, y0, 0, 0, 1]));
  // G: coordenada normalizada -> textura (desfaz espelho e giros de 90°)
  let G = [D, 0, 0, 0, D, 0, 0, 0, 1];
  if (s.flip) G = mul([-1, 0, 0, 0, 1, 0, 0, 0, 1], G);
  for (let i = 0; i < k; i++) G = mul([0, 1, 0, -1, 0, 0, 0, 0, 1], G);
  G = mul([1 / W0, 0, 0.5, 0, 1 / H0, 0.5, 0, 0, 1], G);

  const fr = opt.full || opt.zoom ? null : FRAMES[s.frame];
  let bt = 0, br = 0, bb = 0, bl = 0;
  if (fr) {
    const base = fr.base === 'w' ? w : fr.base === 'h' ? h : Math.max(w, h);
    [bt, br, bb, bl] = fr.sides.map((x) => x * base);
  }
  const outW = w + bl + br, outH = h + bt + bb;
  return {
    innerW: w, innerH: h, outW, outH, geo: colMajor(G), persp: colMajor(P), lens,
    inner: [bl / outW, bt / outH, (bl + w) / outW, (bt + h) / outH],
    frameCol: fr ? fr.col : [0, 0, 0], round: fr?.round || 0, rough: fr?.rough || 0, holes: !!fr?.holes,
    frameText: fr?.text || null, zoom: opt.zoom || [0, 0, 1, 1],
  };
}

// ------------------------------------------------------------ data impressa e textos da moldura
export function autoDate(d = new Date()) {
  return `'${String(d.getFullYear()).slice(2)} ${d.getMonth() + 1} ${d.getDate()}`;
}
// Dígitos de 7 segmentos desenhados à mão (a, b, c, d, e, f, g)
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
const SEG_P = {
  a: [0.12, 0, 0.88, 0], b: [1, 0.06, 1, 0.46], c: [1, 0.54, 1, 0.94], d: [0.12, 1, 0.88, 1],
  e: [0, 0.54, 0, 0.94], f: [0, 0.06, 0, 0.46], g: [0.12, 0.5, 0.88, 0.5],
};
function drawSeg(x, ch, px, py, h) {
  const w = h * 0.5, sk = h * 0.12;
  const tx = (fx, fy) => px + fx * w + (1 - fy) * sk;
  for (const s of SEG[ch] || '') {
    const [ax, ay, bx, by] = SEG_P[s];
    x.beginPath(); x.moveTo(tx(ax, ay), py + ay * h); x.lineTo(tx(bx, by), py + by * h); x.stroke();
  }
}
function drawStamp(x, text, right, bottom, h) {
  const adv = (ch) => (ch === ' ' ? h * 0.45 : ch === "'" || ch === '.' ? h * 0.32 : h * 0.8);
  const chars = [...text];
  let px = right - chars.reduce((a, ch) => a + adv(ch), 0);
  const py = bottom - h;
  x.lineWidth = h * 0.13; x.lineCap = 'round';
  for (const ch of chars) {
    if (ch === "'") { x.beginPath(); x.moveTo(px + h * 0.2, py); x.lineTo(px + h * 0.12, py + h * 0.22); x.stroke(); }
    else if (ch === '.') { x.beginPath(); x.arc(px + h * 0.1, py + h, h * 0.07, 0, 7); x.fill(); }
    else if (ch !== ' ') drawSeg(x, ch, px, py, h);
    px += adv(ch);
  }
}
const rgba = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

// Gera a camada de textos (data e marcações da moldura) do tamanho cw×ch. Devolve null se não houver nada.
export function makeOverlay(s, v, cw, ch, frameNo = 1, prev = null) {
  const hasDate = !!s.date, ft = v.frameText;
  if (!hasDate && !ft) return null;
  cw = Math.max(1, Math.round(cw)); ch = Math.max(1, Math.round(ch));
  const key = JSON.stringify([hasDate && (s.dateText || autoDate()), ft, cw, ch, v.inner, frameNo]);
  if (prev && prev.key === key) return prev;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const x = cv.getContext('2d');
  const il = v.inner[0] * cw, it = v.inner[1] * ch, ir = v.inner[2] * cw, ib = v.inner[3] * ch;
  const iw = ir - il, ih = ib - it;
  if (hasDate) {
    const h = Math.max(6, Math.max(iw, ih) * 0.028);
    const col = [1, 0.47, 0.1];
    x.strokeStyle = rgba(col); x.fillStyle = rgba(col);
    x.shadowColor = rgba(col, 0.9); x.shadowBlur = h * 0.45;
    const txt = (s.dateText || autoDate()).replace(/[^0-9 '.\-]/g, '');
    for (let i = 0; i < 2; i++) drawStamp(x, txt, ir - iw * 0.06, ib - ih * 0.06, h);
    x.shadowBlur = 0;
  }
  if (ft) {
    const n = String(frameNo);
    x.textBaseline = 'middle';
    if (ft === 'neg') {
      const bandB = ch - ib, fs = Math.max(5, iw * 0.026);
      x.fillStyle = rgba([0.95, 0.62, 0.24], 0.95);
      x.font = `600 ${fs}px system-ui, sans-serif`;
      const yT = it * 0.16, yB = ch - bandB * 0.16;
      x.fillText('PELLICULA 400', il + iw * 0.08, yT);
      x.fillText(n, il + iw * 0.55, yT);
      x.fillText(`▸ ${n}A`, il + iw * 0.8, yT);
      x.fillText(n, il + iw * 0.06, yB);
      x.fillText(`▸ ${n}A`, il + iw * 0.3, yB);
      x.fillText('PELLICULA 400', il + iw * 0.66, yB);
      // código de borda (padrão próprio, gerado pelo número do quadro)
      let bx = il + iw * 0.44; const bh = bandB * 0.12;
      for (let i = 0; i < 22; i++) {
        const wb = fs * (((i * 7 + +n) % 3) + 1) * 0.12;
        if ((i * 5 + +n) % 2) x.fillRect(bx, yB - bh / 2, wb, bh);
        bx += wb + fs * 0.12;
      }
    } else if (ft === 'medio') {
      const fs = Math.max(5, Math.min(it, ch - ib) * 0.32);
      x.fillStyle = rgba([0.82, 0.8, 0.74], 0.9);
      x.font = `600 ${fs}px system-ui, sans-serif`;
      x.fillText(`PELLICULA 120   ${n}`, il + iw * 0.05, it * 0.5);
      x.fillText(`▸ ${n}`, ir - iw * 0.12, ch - (ch - ib) * 0.5);
    } else if (ft === 'cromo') {
      const fs = Math.max(5, (ch - ib) * 0.2);
      x.fillStyle = rgba([0.42, 0.41, 0.39], 0.95);
      x.font = `600 ${fs}px system-ui, sans-serif`; x.textAlign = 'center';
      x.fillText('PELLICULA CROMO', cw / 2, ib + (ch - ib) * 0.5);
      x.save(); x.translate(il * 0.5, ch / 2); x.rotate(-Math.PI / 2); x.fillText(n, 0, 0); x.restore();
    }
  }
  return { canvas: cv, key };
}

// ------------------------------------------------------------ curvas (interpolação cúbica monotônica)
export function curveFn(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0]);
  const n = p.length;
  if (n < 2) return (x) => x;
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx.push(p[i + 1][0] - p[i][0] || 1e-6); m.push((p[i + 1][1] - p[i][1]) / dx[i]); }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const q = 3 / Math.sqrt(s); t[i] = q * a * m[i]; t[i + 1] = q * b * m[i]; }
  }
  return (x) => {
    if (x <= p[0][0]) return p[0][1];
    if (x >= p[n - 1][0]) return p[n - 1][1];
    let i = 0; while (x > p[i + 1][0]) i++;
    const h = dx[i], u = (x - p[i][0]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p[i][1] + (u3 - 2 * u2 + u) * h * t[i] + (-2 * u3 + 3 * u2) * p[i + 1][1] + (u3 - u2) * h * t[i + 1];
  };
}

export function isIdentityCurve(c) {
  return ['m', 'r', 'g', 'b'].every((k) => c[k].length === 2 && c[k][0][0] === 0 && c[k][0][1] === 0 && c[k][1][0] === 1 && c[k][1][1] === 1);
}

export function curveData(c) {
  if (isIdentityCurve(c)) return null;
  const fm = curveFn(c.m), fr = curveFn(c.r), fg = curveFn(c.g), fb = curveFn(c.b);
  const d = new Uint8Array(1024);
  const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (let i = 0; i < 256; i++) {
    const m = Math.min(1, Math.max(0, fm(i / 255)));
    d[i * 4] = q(fr(m)); d[i * 4 + 1] = q(fg(m)); d[i * 4 + 2] = q(fb(m)); d[i * 4 + 3] = 255;
  }
  return d;
}

// ------------------------------------------------------------ vazamentos de luz
// tipos pela origem do vazamento (como acontece numa câmera de filme de verdade)
export const LEAKS = [
  { name: 'Tampa', note: 'luz pela vedação da tampa: faixa laranja entrando pela borda do filme' },
  { name: 'Dobradiça', note: 'mancha forte numa lateral, com o centro queimado' },
  { name: 'Ponta do rolo', note: 'primeira foto do rolo: parte da imagem queimada' },
  { name: 'Entre fotos', note: 'faixa estreita perto da divisa entre duas fotos' },
  { name: 'Frontal', note: 'luz pela frente da câmera: véu frio e macio' },
  { name: 'Raios', note: 'furinho na vedação: feixes saindo de um ponto da borda' },
];
function rnd(seed) { let x = Math.sin(seed * 9301 + 49297) * 233280; return () => { x = Math.sin(x) * 10000; return x - Math.floor(x); }; }
// posição e forma sorteadas pelo dado: [lado (0/1), posição ao longo da borda, largura, variação]
export function leakParams(seed) {
  const r = rnd(seed + 1);
  return [r() > 0.5 ? 1 : 0, 0.15 + 0.7 * r(), r(), r()];
}

// Gráfico: paletas de duotônico (escura, clara) e tritônico (sombras, meios-tons, luzes)
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const GFX_DUO = [
  ['Noite', '#14203f', '#f8efd6'], ['Vinho', '#4a0c1e', '#ffc7cc'], ['Mata', '#0d382a', '#e6f79a'],
  ['Ameixa', '#381461', '#ffa852'], ['Limão-rosa', '#1a1418', '#ff9db4'], ['Sépia', '#2e1a0c', '#faead0'],
  ['Mar', '#0c3f73', '#ff8cbe'], ['Grafite', '#1c1d20', '#d9dde0'],
].map(([n, a, b]) => ({ n, c: [hx(a), hx(b)] }));
export const GFX_TRI = [
  ['Poente', '#260d40', '#e64d5a', '#ffe08c'], ['Oceano', '#051433', '#1a8099', '#e6f7eb'],
  ['Selênio', '#140f14', '#736166', '#f7f2eb'], ['Limão-rosa', '#1f3319', '#ed6b8c', '#fcf2b3'],
  ['Neon', '#1a054d', '#0099d9', '#f2ff80'], ['Cobre', '#1a0d08', '#99522e', '#fae6c7'],
].map(([n, a, b, c]) => ({ n, c: [hx(a), hx(b), hx(c)] }));

// Parâmetros para o renderer a partir do estado
export function renderParams(s) {
  return {
    ...s,
    hslH: new Float32Array(s.hsl.map((x) => x.h)),
    hslS: new Float32Array(s.hsl.map((x) => x.s)),
    hslL: new Float32Array(s.hsl.map((x) => x.l)),
    leakP: s.leak > 0 ? leakParams(s.leakSeed) : null,
    gfxCols: s.gfx === 3 ? (GFX_DUO[s.gfxDuo] || GFX_DUO[0]).c : s.gfx === 4 ? (GFX_TRI[s.gfxTri] || GFX_TRI[0]).c : null,
  };
}

// ------------------------------------------------------------ abrir arquivos (inclui RAW)
export const RAW_EXT = ['dng', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'raf', 'orf', 'rw2', 'pef', 'srw', 'x3f', '3fr', 'iiq', 'rwl'];
const extOf = (name) => (name.split('.').pop() || '').toLowerCase();
export const isRaw = (f) => RAW_EXT.includes(extOf(f.name));
export const isImageFile = (f) => f.type.startsWith('image/') || isRaw(f) || ['heic', 'heif'].includes(extOf(f.name));

// Muitos RAW trazem uma prévia JPEG em tamanho grande dentro do arquivo. Usamos a maior que conseguir abrir.
async function embeddedJpeg(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const starts = [];
  for (let i = 0; i < buf.length - 3 && starts.length < 40; i++) {
    if (buf[i] !== 0xff || buf[i + 1] !== 0xd8 || buf[i + 2] !== 0xff) continue;
    const m = buf[i + 3];
    if ((m & 0xf0) === 0xe0 || m === 0xdb || m === 0xc4) starts.push(i);
  }
  let best = null;
  for (const s of starts) {
    try {
      const bmp = await createImageBitmap(new Blob([buf.subarray(s)], { type: 'image/jpeg' }), { imageOrientation: 'from-image' });
      if (!best || bmp.width * bmp.height > best.width * best.height) { best?.close?.(); best = bmp; } else bmp.close?.();
    } catch { /* não era uma prévia válida */ }
  }
  return best;
}

// HEIC/HEIF: o Safari abre direto; nos outros navegadores usamos o libheif local (vendor/libheif-bundle.mjs),
// carregado só quando aparece um HEIC.
let heicLib = null;
function loadHeicLib() {
  heicLib ??= import('./vendor/libheif-bundle.mjs').then((m) => new Promise((res, rej) => {
    let mod;
    const t = setTimeout(() => rej(new Error('decodificador HEIC não iniciou')), 20000);
    mod = m.default({ onRuntimeInitialized() { clearTimeout(t); setTimeout(() => res(mod)); } });
  })).catch((e) => { heicLib = null; throw e; });
  return heicLib;
}
// Confere pelo conteúdo, não pelo nome (há JPEGs salvos com extensão .heic e vice-versa)
async function sniffHeic(file) {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  if (String.fromCharCode(...b.slice(4, 8)) !== 'ftyp') return false;
  const brand = String.fromCharCode(...b.slice(8, 12));
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'avif'].includes(brand);
}

async function decodeHeic(file) {
  const lib = await loadHeicLib();
  const imgs = new lib.HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()));
  if (!imgs.length) throw new Error('nenhuma imagem no arquivo');
  const im = imgs[0]; // a imagem principal; arquivos com sequência usam a primeira
  const w = im.get_width(), h = im.get_height();
  const out = await new Promise((res, rej) =>
    im.display({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }, (d) => (d ? res(d) : rej(new Error('falha ao decodificar')))));
  imgs.forEach((x) => x.free?.());
  return createImageBitmap(new ImageData(out.data, w, h));
}

export async function decodeFile(file) {
  if (!isRaw(file)) {
    try { return { bitmap: await createImageBitmap(file, { imageOrientation: 'from-image' }), note: '' }; } catch (e) {
      if (await sniffHeic(file)) {
        try { return { bitmap: await decodeHeic(file), note: 'HEIC convertido no aparelho' }; } catch (err) {
          console.error(err);
          throw new Error('Não consegui abrir esse HEIC. Tente exportá-lo como JPEG no aparelho de origem.');
        }
      }
    }
  }
  const bmp = await embeddedJpeg(file);
  if (!bmp) throw new Error('Não encontrei uma imagem que este navegador consiga abrir nesse arquivo.');
  return { bitmap: bmp, note: isRaw(file) ? `RAW aberto pela prévia embutida (${bmp.width}×${bmp.height})` : '' };
}
