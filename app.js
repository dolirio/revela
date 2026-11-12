import { getLooks, LUT_N, buildLutData, identityLut, parseCube } from './looks.js';
import { Renderer } from './renderer.js';
import { icon } from './icons.js';
import {
  defaults, withDefaults, GFX_DUO, GFX_TRI, GEO_KEYS, KEEP_KEYS, computeView, curveData, curveFn, renderParams, decodeFile, isImageFile,
  HSL_NAMES, HSL_COLORS, ASPECTS, FRAMES, LEAKS, makeOverlay, autoDate,
} from './core.js';
import { specToState } from './recipes.js';
import { CLIMAS } from './climas.js';
import { FILMS, FILM_CATS } from './films.js';

// looks antigos continuam disponíveis para os filmes salvos em Minhas; os filmes novos entram junto
const LOOKS = [...getLooks(), ...FILMS.map((f) => ({ id: f.id, name: f.code, ...f.look }))];
const $ = (id) => document.getElementById(id);
const view = $('view');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ------------------------------------------------------------ ícones da interface
const setIcon = (id, name) => { $(id).innerHTML = icon(name); };
setIcon('btnOpen', 'open'); setIcon('btnOpen2', 'open'); setIcon('btnLut', 'lut'); setIcon('btnMenu', 'menu');
setIcon('btnUndo', 'undo'); setIcon('btnRedo', 'redo'); setIcon('btnCompare', 'compare');
for (const id of ['sCancel', 'fCancel', 'hCancel', 'cCancel', 'lCancel', 'dCancel', 'uCancel', 'pCancel', 'ppCancel', 'gCancel', 'gfxCancel', 'askCancel', 'scCancel', 'chCancel']) setIcon(id, 'cancel');
for (const id of ['sOk', 'fOk', 'hOk', 'cOk', 'lOk', 'dOk', 'rOk', 'uOk', 'pOk', 'ppOk', 'gOk', 'gfxOk', 'askOk', 'scOk', 'chOk']) setIcon(id, 'ok');
const NAV = { films: 'Pellicula', adjust: 'Ajustes', tex: 'Textura', fx: 'Efeitos', crop: 'Corte' };
document.querySelectorAll('#nav button').forEach((b) => { b.innerHTML = icon(b.dataset.m) + `<span>${NAV[b.dataset.m]}</span>`; });

// erros guardados para o Diagnóstico (⋯ › Diagnóstico)
const diagErrs = [];
addEventListener('error', (e) => diagErrs.push(String(e.message || e.error)));
addEventListener('unhandledrejection', (e) => diagErrs.push('promessa: ' + String(e.reason?.message || e.reason)));

let preview, aux;
// guardado com a versão: a cada versão nova o app tenta de novo o caminho normal
const BUILD = 'v38';
// "inspirado no Kodak…", mas "inspirado na câmera descartável" / "na cópia de álbum"
const insp = (ref) => `inspirado ${/^(câmera|cópia)/i.test(ref) ? 'na' : 'no'} ${ref}`;
// ------------------------------------------------------------ placa de vídeo: escada de segurança
// Alguns aparelhos (ex.: Galaxy S23 no Android 17) derrubam a placa de vídeo no primeiro desenho. O app desce
// degraus até achar um que funcione e guarda o degrau no aparelho: primeiro o modo seguro (texturas de 8 bits,
// mesmos efeitos), depois desenhos com menos efeitos (níveis do shader, ver renderer.js). Quando o Android devolve
// a placa, o app já redesenha no degrau seguinte, sem reabrir; se não devolver, pede para reabrir.
// GL_REV sobe quando o shader mudar a ponto de valer tentar do começo de novo.
const GL_REV = 2, LV_NAMES = ['só tom e cor', 'leve', 'sem sujeira e gráficos', 'completo'];
const GL_STEPS = [[3, false], [3, true], [2, true], [1, true], [0, true]];   // [nível, modo seguro]
let glStep = 0;
try { const v = (localStorage.getItem('revela.gl.step') || '').split(':'); if (+v[0] === GL_REV) glStep = Math.max(0, Math.min(GL_STEPS.length - 1, +v[1] | 0)); } catch {}
let [glLevel, safeMode] = GL_STEPS[glStep];
Renderer.level = glLevel;
let glFailed = false, glReady = false, glWait = 0;
function glFail(why) {
  if (glFailed) return;
  glFailed = true; glReady = false;
  diagErrs.push(`placa de vídeo travou (${why}) no degrau ${glStep + 1}: nível ${glLevel}${safeMode ? ', modo seguro' : ''}`);
  if (glStep >= GL_STEPS.length - 1) return;
  glStep++; [glLevel, safeMode] = GL_STEPS[glStep];
  try { localStorage.setItem('revela.gl.step', `${GL_REV}:${glStep}`); } catch {}
  Renderer.level = glLevel;
  if (preview) preview.safe = safeMode;
  if (aux) aux.safe = safeMode;
  // se o Android não devolver a placa em alguns segundos, só reabrindo o app
  clearTimeout(glWait); glWait = setTimeout(() => { if (preview?.lost) askRestart(); }, 5000);
}
// a placa voltou: o Renderer já recompilou no degrau novo; envia a foto e redesenha
function glBack() {
  clearTimeout(glWait); glFailed = false;
  lutOnPreview = curveOnPreview = null;
  if (photo) { preview.setImage(scaled(photo.bitmap, 2048), 'preview'); draw(); setTimeout(selfCheck, 1200); }
}
// miniaturas e exportação usam um segundo desenho; ele só nasce depois que a foto principal apareceu
function ensureAux() {
  if (aux) return aux;
  aux = new Renderer(document.createElement('canvas'), safeMode);
  aux.canvas.addEventListener('webglcontextlost', () => glFail('miniaturas'));
  aux.onRestore = () => { aux.imgKey = null; paintThumbs(); };
  return aux;
}
try {
  preview = new Renderer(view, safeMode);
  view.addEventListener('webglcontextlost', () => glFail('desenho'));
  if (glLevel < 3) setTimeout(() => toast(`Desenho ${LV_NAMES[glLevel]} neste aparelho: alguns efeitos não aparecem`), 1500);
  preview.onRestore = glBack;
} catch (e) {
  diagErrs.push('iniciar: ' + e.message);
  $('empty').textContent = 'Não foi possível iniciar: ' + e.message;
}
const CAP = () => Math.min(preview.maxTex, 8192);

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

// ------------------------------------------------------------ estado
let state = defaults();
let photo = null;
let bypass = false;
let zoom = null;          // zoom: { cx, cy, s } — centro da janela em coordenadas da foto (0..1) e escala (1 = foto inteira)
const lutCache = new Map();
const userLuts = [];

function lutFor(id) {
  if (id === 'none') return { data: identityLut(2), n: 2 };
  if (lutCache.has(id)) return lutCache.get(id);
  const u = userLuts.find((x) => x.id === id);
  if (u) return u;
  const recipe = LOOKS.find((l) => l.id === id);
  if (!recipe) return { data: identityLut(2), n: 2 };
  const v = { data: buildLutData(recipe, LUT_N), n: LUT_N };
  lutCache.set(id, v);
  return v;
}
const lookName = (id) => (id === 'none' ? 'Original' : LOOKS.find((l) => l.id === id)?.name || userLuts.find((u) => u.id === id)?.name || id);
let lutOnPreview = null, curveOnPreview = null;
function syncTextures() {
  if (lutOnPreview !== state.look) { const l = lutFor(state.look); preview.setLut(l.data, l.n); lutOnPreview = state.look; }
  const ck = JSON.stringify(state.curve);
  if (curveOnPreview !== ck) { preview.setCurve(curveData(state.curve)); curveOnPreview = ck; }
}
const keepNow = () => Object.fromEntries(KEEP_KEYS.map((k) => [k, JSON.parse(JSON.stringify(state[k]))]));
const frameNo = (name = '') => 1 + ([...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 36);

// ------------------------------------------------------------ histórico
let hist = [JSON.stringify(state)], hi = 0;
function commit() {
  const j = JSON.stringify(state);
  if (j === hist[hi]) return;
  hist = hist.slice(0, hi + 1); hist.push(j);
  if (hist.length > 100) hist.shift();
  hi = hist.length - 1; updUndo();
}
function updUndo() { $('btnUndo').disabled = hi <= 0; $('btnRedo').disabled = hi >= hist.length - 1; }
function goHist(d) {
  closeSheet(true);
  const n = hi + d;
  if (n < 0 || n >= hist.length) return;
  hi = n; state = withDefaults(JSON.parse(hist[hi])); syncUI(); draw(); updUndo();
}
$('btnUndo').onclick = () => goHist(-1);
$('btnRedo').onclick = () => goHist(1);
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if (!(e.ctrlKey || e.metaKey)) {
    if (e.key === 'Escape') { if (openSheetId) closeSheet(false); else if (zoom) setZoom(false); closeMenu(); }
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); goHist(-1); }
  else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); goHist(1); }
});

// ------------------------------------------------------------ desenho
let raf = 0, last = null, overlayPrev = null;
function exportScale(v) { return Math.min(1, CAP() / Math.max(v.outW, v.outH)); }
const cropEditing = () => mode === 'crop' && !zoom;
function stagePx() {
  const st = $('stage'), dpr = Math.min(devicePixelRatio || 1, 2);
  return { SW: Math.max(1, (st.clientWidth - 24) * dpr), SH: Math.max(1, (st.clientHeight - 18) * dpr), dpr };
}
function draw() {
  if (!photo || raf) return;
  raf = requestAnimationFrame(() => { raf = 0; drawNow(); });
}
// geometria do zoom: k = pixels de tela por pixel da foto; 100% = tamanho final da exportação; vai até 200%
function zoomGeom(s) {
  const v0 = computeView(state, photo.w, photo.h, { zoom: [0, 0, 1, 1] });
  const es = exportScale(v0), FW = v0.innerW * es, FH = v0.innerH * es, { SW, SH } = stagePx();
  const fitK = Math.min(SW / v0.innerW, SH / v0.innerH), maxK = Math.max(es * 2, fitK);
  const k = clamp(fitK * s, fitK, maxK), DW = v0.innerW * k, DH = v0.innerH * k;
  const w = Math.max(1, Math.round(Math.min(SW, DW))), h = Math.max(1, Math.round(Math.min(SH, DH)));
  return { k, es, fitK, maxS: maxK / fitK, s100: es / fitK, FW, FH, DW, DH, w, h, zw: w / DW, zh: h / DH };
}
function drawNow() {
  syncTextures();
  const { SW, SH, dpr } = stagePx();
  const src = Math.max(photo.w, photo.h);
  let v, w, h, full, ov = null;
  let zg = null;
  if (zoom) {
    zg = zoomGeom(zoom.s);
    const { FW, FH, zw, zh } = zg; w = zg.w; h = zg.h;
    // ampliou além da prévia (2048 px): carrega uma versão maior da foto, uma vez só
    if (preview.imgKey === 'preview' && zg.k > (preview.texW / photo.w) * 1.05) preview.setImage(scaled(photo.bitmap, Math.min(CAP(), 4096)), 'hi');
    zoom.cx = clamp(zoom.cx, zw / 2, 1 - zw / 2); zoom.cy = clamp(zoom.cy, zh / 2, 1 - zh / 2);
    v = computeView(state, photo.w, photo.h, { zoom: [zoom.cx - zw / 2, zoom.cy - zh / 2, zw, zh] });
    full = { w: FW, h: FH, src };
    if (state.date) ov = makeOverlay(state, { inner: [0, 0, 1, 1], frameText: null }, ...fit(FW, FH, 4096), 1, overlayPrev);
  } else {
    v = computeView(state, photo.w, photo.h, { full: cropEditing() });
    const es = exportScale(v);
    const sc = Math.min(SW / v.outW, SH / v.outH, es);
    w = Math.max(1, Math.round(v.outW * sc)); h = Math.max(1, Math.round(v.outH * sc));
    full = { w: v.innerW * es, h: v.innerH * es, src };
    ov = makeOverlay(state, v, w, h, frameNo(photo.name), overlayPrev);
  }
  // tamanho na tela em pontos inteiros: meio ponto sobrando vira uma linha clara na borda no Safari do iPhone (3x)
  const cw = Math.max(1, Math.floor(w / dpr)), chh = Math.max(1, Math.floor(h / dpr));
  w = Math.max(1, Math.round(cw * dpr)); h = Math.max(1, Math.round(chh * dpr));
  overlayPrev = ov;
  try { preview.render(w, h, renderParams(state), full, bypass, { ...v, overlay: ov?.canvas, overlayKey: ov?.key }); }
  catch (e) { diagErrs.push('desenho: ' + e.message); throw e; }
  view.style.width = cw + 'px'; view.style.height = chh + 'px';
  last = { v, w, h, full, dpr, zg };
  if (zg) $('zoomTag').textContent = `${Math.round((zg.k / zg.es) * 100)}% · dois toques para a foto inteira`;
  positionOverlays();
}
const fit = (W, H, M) => { const s = Math.min(1, M / Math.max(W, H)); return [W * s, H * s]; };
new ResizeObserver(() => draw()).observe($('stage'));

function scaled(bitmap, maxSide) {
  const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (s === 1) return bitmap;
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * s); c.height = Math.round(bitmap.height * s);
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return c;
}

// ------------------------------------------------------------ modos (barra inferior) e folhas
let mode = 'films', openSheetId = null, sheetSnap = null;
function setMode(m) {
  closeSheet(true);
  if (m === 'crop' && zoom) setZoom(false);
  mode = m;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
  document.querySelectorAll('.mode').forEach((x) => x.classList.toggle('on', x.id === 'm-' + m));
  draw(); positionOverlays();
}
document.querySelectorAll('#nav button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));

function openSheet(id) {
  closeSheet(true);
  sheetSnap = JSON.stringify(state);
  openSheetId = id;
  document.querySelectorAll('.mode').forEach((x) => x.classList.remove('on'));
  $(id).classList.add('on');
  positionOverlays();
}
// keep=true confirma; keep=false desfaz o que foi mexido na folha
function closeSheet(keep) {
  if (!openSheetId) return;
  if (!keep && sheetSnap) { state = withDefaults(JSON.parse(sheetSnap)); draw(); }
  $(openSheetId).classList.remove('on');
  $('dock').classList.remove('tall', 'med');
  openSheetId = null; sheetSnap = null; curTool = null; curPanel = null;
  $('m-' + mode).classList.add('on');
  commit(); syncUI(); draw();
}

// ------------------------------------------------------------ ferramentas com controle deslizante
const TOOL_FMT = {
  exp: (v) => (v / 100).toFixed(1), gsize: (v) => (v / 10).toFixed(1), srad: (v) => (v / 10).toFixed(1) + ' px',
  straight: (v) => (v / 10).toFixed(1) + '°',
  sharp: (v) => (v > 0 ? `Nitidez ${v}` : v < 0 ? `Desfoque ${-v}` : '0'),
};
// controles com zero no meio: texto das pontas
const ENDS = { sharp: ['◂ desfoque', 'nitidez ▸'] };
// luzes e sombras: quantidade, faixa de tons, raio (máscara pela vizinhança) e cor; raio e cor valem para as duas
const P_HIGH = { p: 'high', n: 'Luzes', i: 'high', rows: [
  { k: 'high', n: 'Quantidade' }, { k: 'highT', n: 'Faixa', min: 0 }, { k: 'lsRad', n: 'Raio', min: 0 }, { k: 'lsCol', n: 'Cor' },
] };
const P_SHAD = { p: 'shad', n: 'Sombras', i: 'shad', rows: [
  { k: 'shad', n: 'Quantidade' }, { k: 'shadT', n: 'Faixa', min: 0 }, { k: 'lsRad', n: 'Raio', min: 0 }, { k: 'lsCol', n: 'Cor' },
] };
const ADJ = [
  { k: 'exp', n: 'Exposição', min: -200, max: 200 },
  { k: 'bright', n: 'Brilho' },
  { k: 'con', n: 'Contraste' }, P_HIGH, P_SHAD,
  { k: 'temp', n: 'Temperatura' }, { k: 'tint', n: 'Matiz' }, { k: 'vib', n: 'Vibração' }, { k: 'sat', n: 'Saturação' },
  { k: 'clar', n: 'Claridade' }, { k: 'depth', n: 'Cor profunda', min: 0 },
  { s: 'hsl', n: 'Cor', i: 'hsl' }, { s: 'curve', n: 'Curvas', i: 'curve' },
  { k: 'white', n: 'Brancos' }, { k: 'black', n: 'Pretos' },
];
// painéis com vários controles. chips: grupos de botões (opções prontas); rows: controles deslizantes
const near = (a, b, t = 0.02) => Math.abs(a - b) <= t;
const P_SHARP = { p: 'sharp', n: 'Nitidez', i: 'sharp', rows: [
  { k: 'sharp', n: 'Quantidade' },
  { k: 'srad', n: 'Raio', min: 5, max: 30, scale: 10, fmt: (v) => (v / 10).toFixed(1), off: (s) => s.sharp <= 0 },   // raio só vale para a nitidez
] };
const P_GRAIN = { p: 'grain', n: 'Grão', i: 'grain', on: { grain: 0.35 },
  chips: [
    { n: 'Tamanho', opts: [['Fino', { gsize: 1.1 }], ['Médio', { gsize: 1.7 }], ['Grosso', { gsize: 2.8 }]],
      pick: (s) => (s.gsize < 1.4 ? 0 : s.gsize < 2.25 ? 1 : 2) },
    { n: 'Tipo', opts: [['Prata', { gcolor: 0, grough: 0.3 }], ['Negativo', { gcolor: 0.35, grough: 0.45 }], ['Colorido', { gcolor: 1, grough: 0.7 }]],
      pick: (s) => (s.gcolor < 0.15 ? 0 : s.gcolor < 0.7 ? 1 : 2) },
    // formato do quadro: o mesmo filme num quadro maior (120) mostra grão menor na foto; meio-quadro, maior
    { n: 'Formato', opts: [['35 mm', { gfmt: 0 }], ['120', { gfmt: 1 }], ['Meio-quadro', { gfmt: 2 }]],
      pick: (s) => s.gfmt | 0 },
  ],
  rows: [
    { k: 'grain', n: 'Intensidade', min: 0 },
    { k: 'gsize', n: 'Escala', min: 8, max: 40, scale: 10, fmt: (v) => (v / 10).toFixed(1) },
  ] };
const P_GLOW = { p: 'bloom', n: 'Difusão', i: 'bloom', rows: [
  { k: 'bloom', n: 'Quantidade' },
  { k: 'bloomR', n: 'Área', min: 0 },
] };
const P_HALO = { p: 'halo', n: 'Halação', i: 'halo', rows: [
  { k: 'halo', n: 'Intensidade', min: 0 },
  { k: 'haloR', n: 'Raio', min: 0 },
  { k: 'haloT', n: 'Limiar', min: 0 },
] };
const TEX = [
  P_SHARP, P_GRAIN, P_GLOW, P_HALO,
  { k: 'vlens', n: 'Lente antiga', min: 0 },
  { k: 'eblur', n: 'Borda suave', min: 0 },
  { s: 'paper', n: 'Papel', i: 'paper' },
];
const FX = [
  { k: 'fade', n: 'Desbotado', min: 0 }, { k: 'vig', n: 'Vinheta' },
  { s: 'leak', n: 'Light leak', i: 'leak' }, { s: 'marks', n: 'Poeira e riscos', i: 'scratch' },
  { s: 'chroma', n: 'Aberração', i: 'chroma' }, { s: 'date', n: 'Data', i: 'date' },
];
const GEO = [
  { k: 'straight', n: 'Endireitar', min: -450, max: 450, scale: 10, geo: true },
  { k: 'persV', n: 'Vertical', geo: true, i: 'persV' }, { k: 'persH', n: 'Horizontal', geo: true, i: 'persH' },
  { k: 'lens', n: 'Lente', geo: true, i: 'lens' },
  { a: 'rotL', n: 'Girar', i: 'rotL' }, { a: 'rotR', n: 'Girar', i: 'rotR' }, { a: 'flip', n: 'Espelhar', i: 'flip', k: 'flip' },
  { a: 'cropReset', n: 'Redefinir', i: 'cropReset' },
];
const ACTIONS = {
  zoom: () => setZoom(!zoom),
  rotL: () => { state.rot = (state.rot + 3) % 4; state.crop = [0, 0, 1, 1]; draw(); commit(); },
  rotR: () => { state.rot = (state.rot + 1) % 4; state.crop = [0, 0, 1, 1]; draw(); commit(); },
  flip: () => { state.flip = !state.flip; syncUI(); draw(); commit(); },
  cropReset: () => { Object.assign(state, { straight: 0, persV: 0, persH: 0, lens: 0, crop: [0, 0, 1, 1] }); syncUI(); draw(); commit(); toast('Corte e correções redefinidos'); },
};
function buildTools(box, list) {
  for (const t of list) {
    const b = document.createElement('button'); b.className = 'tool'; b.dataset.k = t.p ? 'p_' + t.p : t.k || t.s || 'act_' + t.a;
    if (t.p) b.dataset.keys = [...t.rows.map((r) => r.k), ...(t.chips ? ['gcolor', 'grough', 'gfmt'] : [])].join(',');
    b.innerHTML = `<div class="ring">${icon(t.i || t.k)}</div><span>${t.n}</span>`;
    b.onclick = () => (t.a ? ACTIONS[t.a]() : t.s ? openSpecial(t.s) : t.p ? openPanel(t) : t.geo ? openGeo(t.k) : openSlider(t));
    box.append(b);
  }
}

// ------------------------------------------------------------ número grande sobre a foto enquanto arrasta
let bigTimer = 0;
function flashVal(label, text) {
  const el = $('bigVal');
  el.querySelector('small').textContent = label || '';
  el.querySelector('b').textContent = text;
  el.classList.add('on');
  clearTimeout(bigTimer);
  bigTimer = setTimeout(() => el.classList.remove('on'), 650);
}
const signed = (v) => (v > 0 ? '+' + v : String(v));

// ------------------------------------------------------------ painel com vários controles
let curPanel = null;
function openPanel(t) {
  openSheet('panelSheet');
  curPanel = t;
  $('pTitle').textContent = t.n;
  const body = $('pBody'); body.innerHTML = '';
  for (const g of t.chips || []) {
    const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', g.n);
    g.opts.forEach(([label, set], i) => {
      const b = document.createElement('button'); b.textContent = label; b.dataset.i = i;
      b.onclick = () => {
        Object.assign(state, set);
        if (t.on) for (const [k, v] of Object.entries(t.on)) if (!state[k]) state[k] = v;
        syncPanel(); draw();
      };
      seg.append(b);
    });
    body.append(seg);
  }
  for (const r of t.rows) {
    const row = document.createElement('div'); row.className = 'prow';
    const sc = r.scale ?? 100, min = r.min ?? -100, max = r.max ?? 100;
    row.innerHTML = `<span>${r.n}</span><div class="rw${min < 0 ? ' bi' : ''}"><input type="range" min="${min}" max="${max}" step="1" aria-label="${r.n}"></div><output></output>`;
    const inp = row.querySelector('input');
    inp.addEventListener('input', () => {
      const d = defaults()[r.k] * sc;
      let v = +inp.value;
      if (Math.abs(v - d) <= (max - min) * 0.012) { v = d; inp.value = d; }
      state[r.k] = v / sc; syncPanel(); draw();
      flashVal(r.n, r.fmt ? r.fmt(v) : min < 0 ? signed(v) : String(v));
    });
    inp.addEventListener('dblclick', () => { state[r.k] = defaults()[r.k]; syncPanel(); draw(); });
    row.dataset.k = r.k;
    body.append(row);
  }
  const tall = (t.chips?.length || 0) * 40 + t.rows.length * 34 + 56 > 158;
  $('dock').classList.toggle('med', tall);
  syncPanel(); positionOverlays();
}
function syncPanel() {
  const t = curPanel; if (!t) return;
  const body = $('pBody');
  (t.chips || []).forEach((g, gi) => {
    const k = g.pick(state);
    body.querySelectorAll('.seg')[gi].querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.i === k));
  });
  for (const r of t.rows) {
    const row = body.querySelector(`.prow[data-k="${r.k}"]`), inp = row.querySelector('input'), sc = r.scale ?? 100;
    const v = Math.round(state[r.k] * sc);
    inp.value = v; fillRange(inp, defaults()[r.k] * sc);
    row.querySelector('output').textContent = r.fmt ? r.fmt(v) : String(v);
    const off = !!r.off?.(state); row.classList.toggle('off', off); inp.disabled = off;
  }
}
$('pOk').onclick = () => closeSheet(true);
$('pCancel').onclick = () => closeSheet(false);
buildTools($('t-adjust'), ADJ); buildTools($('t-tex'), TEX); buildTools($('t-fx'), FX); buildTools($('t-crop'), GEO);

let curTool = null;
function openSlider(t) {
  const sc = t.scale ?? 100, r = $('sRange');
  r.min = t.min ?? -100; r.max = t.max ?? 100; r.step = 1;
  $('sTitle').textContent = t.n;
  openSheet('sliderSheet');
  curTool = t;
  r.value = Math.round(state[t.k] * sc);
  const bi = +r.min < 0;
  $('sWrap').classList.toggle('bi', bi);
  const ends = ENDS[t.k];
  $('sEnds').classList.toggle('on', !!ends);
  if (ends) [$('sEnds').children[0].textContent, $('sEnds').children[1].textContent] = ends;
  showSliderVal(); positionOverlays();
}
// pinta o trilho do valor padrão até o valor atual
function fillRange(r, from) {
  const lo = +r.min, span = +r.max - lo, p = (x) => ((x - lo) / span) * 100;
  const a = p(Math.min(from, +r.value)), b = p(Math.max(from, +r.value));
  r.style.setProperty('--a', a + '%'); r.style.setProperty('--b', b + '%');
}
function showSliderVal() {
  const v = +$('sRange').value; $('sVal').textContent = (TOOL_FMT[curTool.k] || String)(v);
  fillRange($('sRange'), defaults()[curTool.k] * (curTool.scale ?? 100));
}
$('sRange').addEventListener('input', () => {
  const sc = curTool.scale ?? 100, d = defaults()[curTool.k] * sc;
  let v = +$('sRange').value;
  if (Math.abs(v - d) <= (+$('sRange').max - +$('sRange').min) * 0.012) { v = d; $('sRange').value = d; } // encaixa no padrão
  state[curTool.k] = v / sc; showSliderVal(); draw();
  const fmt = TOOL_FMT[curTool.k];
  flashVal(curTool.n, fmt && curTool.k !== 'sharp' ? fmt(v) : +$('sRange').min < 0 ? signed(v) : String(v));
});
$('sReset').onclick = () => { state[curTool.k] = defaults()[curTool.k]; $('sRange').value = Math.round(state[curTool.k] * (curTool.scale ?? 100)); showSliderVal(); draw(); };
$('sOk').onclick = () => closeSheet(true);
$('sCancel').onclick = () => closeSheet(false);
$('sRange').addEventListener('dblclick', () => $('sReset').click());

function markTools() {
  const d = defaults();
  document.querySelectorAll('.tool').forEach((b) => {
    const k = b.dataset.k;
    let set = false;
    if (k === 'hsl') set = state.hsl.some((x) => x.h || x.s || x.l);
    else if (k === 'curve') set = !!curveData(state.curve);
    else if (k === 'leak') set = state.leak > 0;
    else if (k === 'date') set = !!state.date;
    else if (k === 'marks') set = !!state.dust || !!state.scratch;
    else if (b.dataset.keys) { const main = b.dataset.keys.split(',')[0]; set = state[main] !== d[main]; } // marcado quando o efeito está ligado
    else if (!k.startsWith('act_')) set = JSON.stringify(state[k]) !== JSON.stringify(d[k]);
    b.classList.toggle('set', set);
  });
  document.querySelector('.tool[data-k="act_zoom"]')?.classList.toggle('on', !!zoom);
}

// ------------------------------------------------------------ Pellicula: filmes e "Minhas"
let cat = store.get('revela.cat', 'neg');
if (!FILM_CATS.some((c) => c.id === cat)) cat = 'clima';   // categoria que deixou de existir (ex.: Filtros)
let thumbSrc = null;
let userRecipes = store.get('revela.recipes', []).map((r, i) => (r.id ? r : { id: `u_old${i}_${Date.now().toString(36)}`, ...r }));
const saveUserRecipes = () => { if (!store.set('revela.recipes', userRecipes)) toast('Não foi possível salvar neste navegador'); };
const findRecipe = (id) => userRecipes.find((r) => r.id === id) || CLIMAS.find((r) => r.id === id);
const isClima = (r) => !!r && CLIMAS.includes(r);
const filmById = (id) => FILMS.find((f) => f.id === id);

// pergunta dentro do app (nome ou confirmação), no lugar das janelas do navegador
let askDone = null;
function ask({ title, note = '', value = null }) {
  return new Promise((resolve) => {
    openSheet('askSheet');
    $('askTitle').textContent = title; $('askNote').textContent = note;
    $('askRow').style.display = value === null ? 'none' : '';
    if (value !== null) { $('askInput').value = value; setTimeout(() => { $('askInput').focus(); $('askInput').select(); }, 50); }
    askDone = (ok) => { askDone = null; const v = $('askInput').value.trim(); closeSheet(true); resolve(value === null ? ok : ok ? v : null); };
  });
}
$('askOk').onclick = () => askDone?.(true);
$('askCancel').onclick = () => (askDone ? askDone(false) : closeSheet(false));
$('askInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); askDone?.(true); } });

// ------------------------------------------------------------ filtro como camada
// Filme, Clima e "Minhas" são uma camada por cima da foto (como presets no Lightroom e filtros no VSCO).
// Trocar de filtro tira o que o filtro anterior tinha colocado e põe o do novo, mas tudo o que você ajustou
// à mão (luz, cor, textura, efeitos, corte, moldura) continua. A intensidade e o "afinar" (Tom e Cor) são
// do filtro e voltam ao padrão de cada um. Foto nova começa do zero (ver openPhoto).
const LOOK_KEYS = ['look', 'mix', 'ftone', 'fcol', 'recipe', 'filmCh'];
const SEED_KEYS = ['seed', 'leakSeed', 'dustSeed', 'scrSeed', 'paperSeed'];
const sameVal = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : JSON.stringify(a) === JSON.stringify(b));
// o que difere do que o filtro atual colocou (ou do padrão, onde ele não mexe) foi ajustado à mão
function handEdits() {
  const d = defaults(), layer = state.filmCh || {}, out = {};
  for (const k of Object.keys(d)) {
    if (LOOK_KEYS.includes(k) || SEED_KEYS.includes(k) || KEEP_KEYS.includes(k)) continue;
    if (!sameVal(state[k], k in layer ? layer[k] : d[k])) out[k] = JSON.parse(JSON.stringify(state[k]));
  }
  return out;
}
function applyLayer(layer, look) {
  const mine = handEdits(), seeds = Object.fromEntries(SEED_KEYS.map((k) => [k, state[k]]));
  state = withDefaults({ ...layer, ...mine, ...keepNow(), ...seeds, ...look });
  state.filmCh = Object.keys(layer).length ? layer : null;
  syncUI(); draw(); commit();
}
function applyFilm(id) {
  const d = defaults(), f = filmById(id), ch = f ? JSON.parse(JSON.stringify(f.ch)) : {};
  // um filme sempre define o grão (mesmo que seja "sem grão")
  if (f) for (const k of ['grain', 'gsize', 'grough', 'gcolor']) if (!(k in ch)) ch[k] = d[k];
  applyLayer(ch, { look: id, mix: 1, ftone: 0, fcol: 0, recipe: null });
}
function recipeParams(r) {
  if (r.spec) return specToState(r.spec);
  const o = JSON.parse(JSON.stringify(r.s || {}));
  for (const k of KEEP_KEYS) delete o[k];
  return o;
}
function applyRecipe(r) {
  const p = recipeParams(r), d = defaults(), layer = {};
  // a camada do Clima (ou do seu filme salvo) é o que ele muda em relação ao padrão
  for (const [k, v] of Object.entries(p)) {
    if (LOOK_KEYS.includes(k) || SEED_KEYS.includes(k) || KEEP_KEYS.includes(k) || !(k in d)) continue;
    if (!sameVal(v, d[k])) layer[k] = JSON.parse(JSON.stringify(v));
  }
  applyLayer(layer, { look: p.look ?? 'none', mix: p.mix ?? 1, ftone: p.ftone ?? 0, fcol: p.fcol ?? 0, recipe: r.id });
}
function editSnapshot() {
  const s = JSON.parse(JSON.stringify(state));
  for (const k of [...KEEP_KEYS, 'recipe', 'filmCh']) delete s[k];
  return s;
}
async function saveAsMine() {
  const base = filmById(state.look)?.code;
  const name = await ask({ title: 'Salvar como meu', note: 'Guarda a edição atual (menos corte, moldura e data) em Minhas.', value: base ? `${base} meu` : `Meu ${userRecipes.length + 1}` });
  if (!name) return false;
  const rec = { id: 'u' + Date.now().toString(36), name, s: editSnapshot() };
  userRecipes.push(rec); saveUserRecipes();
  state.recipe = rec.id; commit();
  cat = 'mine'; store.set('revela.cat', cat); buildStrip();
  toast(`“${name}” salvo em Minhas`);
  return true;
}

function buildCats() {
  const box = $('cats'); box.innerHTML = '';
  for (const c of FILM_CATS) {
    const b = document.createElement('button'); b.dataset.f = c.id; b.textContent = c.n;
    b.onclick = () => { cat = c.id; store.set('revela.cat', cat); buildStrip(); };
    box.append(b);
  }
}
function tile(cls, name) {
  const b = document.createElement('button');
  b.className = ('film ' + cls).trim();
  b.innerHTML = `<canvas width="152" height="152"></canvas><div class="knob">${icon('dial')}</div><span class="nm"></span>`;
  b.querySelector('.nm').textContent = name;
  return b;
}
function buildStrip() {
  const strip = $('strip'); strip.innerHTML = '';
  const orig = tile('', 'Original'); orig.dataset.id = 'none'; orig.title = 'Sem filme';
  orig.onclick = () => applyFilm('none');
  strip.append(orig);
  if (cat === 'mine') {
    for (const r of userRecipes) {
      const b = tile('rec', r.name); b.dataset.rid = r.id; b.title = r.name;
      b.onclick = () => (state.recipe === r.id ? openRecSheet(r) : applyRecipe(r));
      strip.append(b);
    }
    for (const u of userLuts) {
      const b = tile('', u.name); b.dataset.id = u.id; b.title = u.name;
      b.onclick = () => (state.look === u.id && !state.recipe ? openFilmSheet(u.name) : applyFilm(u.id));
      strip.append(b);
    }
    const add = document.createElement('button');
    add.className = 'film add'; add.title = 'Salvar a edição atual como um filme seu';
    add.innerHTML = '<div class="ph">+</div><span class="nm">Salvar atual</span>';
    add.onclick = () => { if (photo) saveAsMine(); else toast('Abra uma foto primeiro'); };
    const imp = document.createElement('button');
    imp.className = 'film add'; imp.title = 'Importar LUT .cube';
    imp.innerHTML = `<div class="ph">${icon('lut')}</div><span class="nm">Importar LUT</span>`;
    imp.onclick = () => $('fileLut').click();
    strip.append(add, imp);
  } else if (cat === 'clima') {
    // climas: tocar aplica a receita inteira; tocar de novo abre intensidade, Tom e Cor (e "+ salvar como meu")
    for (const c of CLIMAS) {
      const b = tile('rec', c.name); b.dataset.rid = c.id; b.title = `${c.name} · ${c.note}`;
      b.onclick = () => (state.recipe === c.id ? openFilmSheet(c.name) : applyRecipe(c));
      strip.append(b);
    }
  } else {
    for (const f of FILMS.filter((x) => x.cat === cat)) {
      const b = tile('', f.code); b.dataset.id = f.id; b.title = `${f.code} · ${insp(f.ref)}`;
      b.onclick = () => (state.look === f.id && !state.recipe ? openFilmSheet(f.code) : applyFilm(f.id));
      strip.append(b);
    }
  }
  syncFilms(); paintThumbs();
}
function syncFilms() {
  document.querySelectorAll('#strip .film').forEach((b) => {
    const on = b.dataset.rid ? b.dataset.rid === state.recipe : b.dataset.id != null && b.dataset.id === state.look && !state.recipe;
    b.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('#cats button').forEach((b) => b.classList.toggle('on', b.dataset.f === cat));
  const r = state.recipe && findRecipe(state.recipe), f = filmById(state.look);
  let title, text;
  if (r && isClima(r)) { title = r.name; text = f ? `${r.note} · a partir do ${f.code}` : r.note; }
  else if (r) { title = r.name; text = f ? `seu filme · feito a partir do ${f.code}` : 'seu filme'; }
  else if (f) { title = f.code; text = `${insp(f.ref)} · ${f.kind}`; }
  else if (state.look !== 'none') { title = lookName(state.look); text = 'LUT importada'; }
  else { title = 'Original'; text = 'toque num filme para aplicar; toque de novo para a intensidade'; }
  const info = $('filmInfo'); info.innerHTML = '<b></b><span></span>';
  info.querySelector('b').textContent = title; info.querySelector('span').textContent = text;
}

function openFilmSheet(name) {
  $('fTitle').textContent = name;
  $('fRange').value = Math.round(state.mix * 100); $('fVal').textContent = $('fRange').value;
  syncTune();
  openSheet('filmSheet'); $('dock').classList.add('med');
}
// afinar o filme: Tom e Cor, com o zero no meio (dois toques zeram)
function syncTune() {
  for (const [id, k] of [['fTone', 'ftone'], ['fCol', 'fcol']]) {
    const r = $(id), v = Math.round((state[k] || 0) * 100);
    r.value = v; fillRange(r, 0); $(id + 'V').textContent = signed(v);
  }
}
for (const [id, k, n] of [['fTone', 'ftone', 'Tom'], ['fCol', 'fcol', 'Cor']]) {
  $(id).addEventListener('input', () => {
    let v = +$(id).value; if (Math.abs(v) <= 3) v = 0;
    state[k] = v / 100; syncTune(); draw(); flashVal(n, signed(v));
  });
  $(id).addEventListener('dblclick', () => { state[k] = 0; syncTune(); draw(); });
}
$('fRange').addEventListener('input', () => { state.mix = +$('fRange').value / 100; $('fVal').textContent = $('fRange').value; draw(); flashVal('Filme', $('fRange').value); });
$('fSave').onclick = () => { closeSheet(true); saveAsMine(); };
$('fOk').onclick = () => closeSheet(true);
$('fCancel').onclick = () => closeSheet(false);

let paintGen = 0;
async function paintThumbs() {
  const gen = ++paintGen;
  if (photo && !glReady) return;   // espera a foto principal aparecer (selfCheck chama de novo)
  if (photo) ensureAux();
  const cs = [...document.querySelectorAll('#strip .film canvas')];
  if (!thumbSrc || !photo) {
    for (const c of cs) { const x = c.getContext('2d'); x.fillStyle = '#26221e'; x.fillRect(0, 0, c.width, c.height); }
    return;
  }
  for (const c of cs) {
    if (gen !== paintGen) return;
    const el = c.parentElement;
    if (aux.imgKey !== 'thumb') aux.setImage(thumbSrc, 'thumb');
    if (el.dataset.rid) {
      const r = findRecipe(el.dataset.rid); if (!r) continue;
      const p = withDefaults(recipeParams(r));
      const l = lutFor(p.look); aux.setLut(l.data, l.n); aux.setCurve(curveData(p.curve));
      aux.render(thumbSrc.width, thumbSrc.height, renderParams(p), { w: photo.w, h: photo.h, src: Math.max(photo.w, photo.h) });
    } else {
      aux.setCurve(null);
      const l = lutFor(el.dataset.id); aux.setLut(l.data, l.n);
      aux.render(thumbSrc.width, thumbSrc.height, {}, { w: thumbSrc.width, h: thumbSrc.height });
    }
    blitThumb(c);
    await new Promise((res) => setTimeout(res));
  }
}
function blitThumb(c) {
  const s = Math.min(thumbSrc.width, thumbSrc.height);
  c.getContext('2d').drawImage(aux.canvas, (thumbSrc.width - s) / 2, (thumbSrc.height - s) / 2, s, s, 0, 0, c.width, c.height);
}

// folha de um filme seu
let sheetRecipe = null;
function openRecSheet(r) {
  sheetRecipe = r;
  $('rTitle').textContent = r.name;
  const f = filmById(r.spec ? r.spec.film : r.s?.look);
  $('rNote').textContent = f ? `Feito a partir do ${f.code} (${insp(f.ref)}).` : 'Seu filme, com todos os ajustes salvos.';
  openSheet('recSheet');
}
$('rRen').onclick = async () => {
  const r = sheetRecipe, name = await ask({ title: 'Renomear', value: r.name });
  if (!name) return;
  r.name = name; saveUserRecipes(); buildStrip(); syncFilms();
};
$('rUpd').onclick = async () => {
  const r = sheetRecipe;
  if (!(await ask({ title: 'Atualizar', note: `Substituir “${r.name}” pela edição atual?` }))) return;
  const s = JSON.parse(JSON.stringify(state)); for (const k of [...KEEP_KEYS, 'recipe', 'filmCh']) delete s[k];
  delete r.spec; r.s = s; saveUserRecipes(); buildStrip(); toast(`“${r.name}” atualizado`);
};
$('rDel').onclick = async () => {
  const r = sheetRecipe;
  if (!(await ask({ title: 'Excluir', note: `Excluir “${r.name}”? Não dá para desfazer.` }))) return;
  userRecipes = userRecipes.filter((x) => x.id !== r.id); saveUserRecipes();
  if (state.recipe === r.id) state.recipe = null;
  buildStrip(); syncFilms(); toast('Excluído');
};
$('rOk').onclick = () => closeSheet(true);

// ------------------------------------------------------------ folhas especiais: cor (HSL), curvas, luz, data
function openSpecial(s) {
  if (s === 'hsl') { syncHsl(); openSheet('hslSheet'); }
  if (s === 'curve') { openSheet('curveSheet'); drawCurve(); }
  if (s === 'leak') { syncLeak(); openSheet('leakSheet'); }
  if (s === 'scratch') { syncScr(); openSheet('scrSheet'); }
  if (s === 'chroma') { syncChr(); openSheet('chrSheet'); }
  if (s === 'date') { openSheet('dateSheet'); if (!state.date) { state.date = true; draw(); } syncDate(); }
  if (s === 'dust' || (s === 'marks' && (state.dust || !state.scratch))) { openSheet('dustSheet'); syncDust(); }
  else if (s === 'marks') { syncScr(); openSheet('scrSheet'); }
  if (s === 'paper') { openSheet('paperSheet'); syncPaper(); }
}
let hslSel = 0;
HSL_NAMES.forEach((n, i) => {
  const b = document.createElement('button'); b.title = n; b.setAttribute('aria-label', n); b.style.background = HSL_COLORS[i];
  b.onclick = () => { hslSel = i; syncHsl(); };
  $('hslDots').append(b);
});
for (const k of ['h', 's', 'l']) {
  const inp = $('hsl-' + k), out = inp.parentElement.querySelector('output');
  inp.addEventListener('input', () => { state.hsl[hslSel][k] = +inp.value / 100; out.textContent = inp.value; draw(); });
  inp.addEventListener('dblclick', () => { state.hsl[hslSel][k] = 0; syncHsl(); draw(); });
}
function syncHsl() {
  [...$('hslDots').children].forEach((b, i) => b.classList.toggle('on', i === hslSel));
  for (const k of ['h', 's', 'l']) {
    const inp = $('hsl-' + k); inp.value = Math.round(state.hsl[hslSel][k] * 100);
    inp.parentElement.querySelector('output').textContent = inp.value;
  }
}
$('hOk').onclick = () => closeSheet(true);
$('hCancel').onclick = () => closeSheet(false);

const cv = $('curve'), cx = cv.getContext('2d');
let curCh = 'm';
const CH_COL = { m: '#efe9de', r: '#e0574b', g: '#58b85a', b: '#4f86e0' };
function drawCurve() {
  const W = cv.width;
  cx.clearRect(0, 0, W, W);
  cx.strokeStyle = '#38332d'; cx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) { const p = (i * W) / 4; cx.beginPath(); cx.moveTo(p, 0); cx.lineTo(p, W); cx.moveTo(0, p); cx.lineTo(W, p); cx.stroke(); }
  for (const ch of ['m', 'r', 'g', 'b']) {
    const pts = state.curve[ch], active = ch === curCh;
    if (!active && pts.length === 2 && pts[0][1] === 0 && pts[1][1] === 1) continue;
    const f = curveFn(pts);
    cx.strokeStyle = CH_COL[ch]; cx.globalAlpha = active ? 1 : 0.35; cx.lineWidth = active ? 4 : 2;
    cx.beginPath();
    for (let i = 0; i <= 100; i++) { const x = i / 100, y = clamp(f(x), 0, 1); i ? cx.lineTo(x * W, (1 - y) * W) : cx.moveTo(x * W, (1 - y) * W); }
    cx.stroke();
  }
  cx.globalAlpha = 1;
  for (const [x, y] of state.curve[curCh]) {
    cx.beginPath(); cx.arc(x * W, (1 - y) * W, 10, 0, Math.PI * 2);
    cx.fillStyle = '#201d1a'; cx.fill(); cx.lineWidth = 4; cx.strokeStyle = CH_COL[curCh]; cx.stroke();
  }
}
function curvePos(e) {
  const r = cv.getBoundingClientRect();
  return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp(1 - (e.clientY - r.top) / r.height, 0, 1)];
}
let drag = -1, lastTap = { t: 0, i: -1 };
cv.addEventListener('pointerdown', (e) => {
  const [x, y] = curvePos(e), pts = state.curve[curCh];
  let idx = pts.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 0.07);
  const now = performance.now();
  if (idx >= 0 && lastTap.i === idx && now - lastTap.t < 350 && idx !== 0 && idx !== pts.length - 1) {
    pts.splice(idx, 1); lastTap = { t: 0, i: -1 }; drawCurve(); draw(); return;
  }
  if (idx < 0) {
    const f = curveFn(pts);
    pts.push([x, clamp(f(x), 0, 1)]); pts.sort((a, b) => a[0] - b[0]);
    idx = pts.findIndex((p) => p[0] === x);
  }
  lastTap = { t: now, i: idx };
  drag = idx; cv.setPointerCapture(e.pointerId); drawCurve(); draw();
});
cv.addEventListener('pointermove', (e) => {
  if (drag < 0) return;
  const [x, y] = curvePos(e), pts = state.curve[curCh];
  if (drag === 0) pts[0] = [0, y];
  else if (drag === pts.length - 1) pts[drag] = [1, y];
  else pts[drag] = [clamp(x, pts[drag - 1][0] + 0.01, pts[drag + 1][0] - 0.01), y];
  drawCurve(); draw();
});
cv.addEventListener('pointerup', () => { drag = -1; });
document.querySelectorAll('#curveCh [data-c]').forEach((b) => b.addEventListener('click', () => {
  curCh = b.dataset.c;
  document.querySelectorAll('#curveCh [data-c]').forEach((x) => x.classList.toggle('on', x === b));
  drawCurve();
}));
$('curveReset').onclick = () => { state.curve[curCh] = [[0, 0], [1, 1]]; drawCurve(); draw(); };
$('cOk').onclick = () => closeSheet(true);
$('cCancel').onclick = () => closeSheet(false);

// light leak: tipo (de onde a luz entrou) + dado (forma e posição) + força
LEAKS.forEach((L, i) => {
  const b = document.createElement('button'); b.textContent = L.name; b.dataset.i = i;
  b.onclick = () => { state.leakType = i; if (!state.leak) state.leak = 0.6; syncLeak(); draw(); };
  $('leakTypes').append(b);
});
function syncLeak() {
  document.querySelectorAll('#leakTypes button').forEach((b) => b.classList.toggle('on', +b.dataset.i === state.leakType && state.leak > 0));
  const r = $('leakRange'); r.value = Math.round(state.leak * 100); fillRange(r, 0);
  $('leakVal').textContent = r.value; $('leakNote').textContent = (LEAKS[state.leakType] || LEAKS[0]).note;
}
$('leakSeed').innerHTML = icon('dice');
$('leakRange').addEventListener('input', () => { state.leak = +$('leakRange').value / 100; syncLeak(); draw(); flashVal('Light leak', $('leakRange').value); });
$('leakSeed').onclick = () => { state.leakSeed = (state.leakSeed + 1 + Math.floor(Math.random() * 9973)) % 99991; if (!state.leak) state.leak = 0.6; syncLeak(); draw(); };

// arranhões: tipo + dado + intensidade (esquerda escuros, direita claros)
const SCR_TYPES = [
  ['Câmera', 'riscos longos no sentido em que o filme corre, com falhas, às vezes em pares'],
  ['Projeção', 'riscos atravessados que tremem e aparecem em trechos, como filme de cinema'],
  ['Manuseio', 'microarranhões curtos em várias direções, de negativo guardado sem capa'],
  ['Vinco', 'dobra curva com rachadura fina na emulsão'],
  ['Emulsão', 'poucos riscos largos que arrancam camada de cor (como em slide)'],
  ['Digital', 'marca de dedo leve e oleosa'],
];
SCR_TYPES.forEach(([n], i) => {
  const b = document.createElement('button'); b.textContent = n; b.dataset.i = i;
  b.onclick = () => { state.scrType = i; if (!state.scratch) state.scratch = 0.5; syncScr(); draw(); };
  $('scrTypes').append(b);
});
function syncScr() {
  document.querySelectorAll('#scrTypes button').forEach((b) => b.classList.toggle('on', +b.dataset.i === state.scrType && state.scratch !== 0));
  const r = $('scrRange'), v = Math.round(state.scratch * 100); r.value = v; fillRange(r, 0);
  $('scrVal').textContent = v > 0 ? `Claros ${v}` : v < 0 ? `Escuros ${-v}` : '0';
  $('scrNote').textContent = (SCR_TYPES[state.scrType] || SCR_TYPES[0])[1];
}
$('scrSeed').innerHTML = icon('dice');
$('scrRange').addEventListener('input', () => {
  let v = +$('scrRange').value; if (Math.abs(v) <= 2) { v = 0; $('scrRange').value = 0; }
  state.scratch = v / 100; syncScr(); draw(); flashVal('Arranhões', signed(v));
});
$('scrRange').addEventListener('dblclick', () => { state.scratch = 0; syncScr(); draw(); });
$('scrSeed').onclick = () => { state.scrSeed = (state.scrSeed + 1 + Math.floor(Math.random() * 97)) % 997; if (!state.scratch) state.scratch = 0.5; syncScr(); draw(); };
$('scOk').onclick = () => closeSheet(true);
$('scCancel').onclick = () => closeSheet(false);

// aberração: tipo + intensidade
const CHR_TYPES = [
  ['Lateral', 'centro limpo; franjas vermelho/ciano crescendo para as bordas, como lente grande-angular antiga'],
  ['Franja roxa', 'halo roxo nos contornos escuros colados a luzes fortes, em qualquer parte da foto'],
  ['Lente barata', 'lateral forte e descentrada, com um pouco de franja roxa'],
];
CHR_TYPES.forEach(([n], i) => {
  const b = document.createElement('button'); b.textContent = n; b.dataset.i = i;
  b.onclick = () => { state.chromaType = i; if (!state.chroma) state.chroma = 0.5; syncChr(); draw(); };
  $('chrTypes').append(b);
});
function syncChr() {
  document.querySelectorAll('#chrTypes button').forEach((b) => b.classList.toggle('on', +b.dataset.i === state.chromaType && state.chroma > 0));
  const r = $('chrRange'); r.value = Math.round(state.chroma * 100); fillRange(r, 0);
  r.parentElement.querySelector('output').textContent = r.value;
  $('chrNote').textContent = (CHR_TYPES[state.chromaType] || CHR_TYPES[0])[1];
}
$('chrRange').addEventListener('input', () => { state.chroma = +$('chrRange').value / 100; syncChr(); draw(); flashVal('Aberração', $('chrRange').value); });
$('chOk').onclick = () => closeSheet(true);
$('chCancel').onclick = () => closeSheet(false);
$('lOk').onclick = () => closeSheet(true);
$('lCancel').onclick = () => closeSheet(false);

function syncDate() {
  $('dOn').textContent = state.date ? 'Data ligada' : 'Data desligada';
  $('dOn').classList.toggle('on', state.date);
  $('dText').value = state.dateText; $('dText').placeholder = autoDate();
}
$('dOn').onclick = () => { state.date = !state.date; syncDate(); draw(); };
$('dText').addEventListener('input', () => { state.dateText = $('dText').value; state.date = true; syncDate(); draw(); });
$('dToday').onclick = () => { state.dateText = ''; state.date = true; syncDate(); draw(); };
$('dOk').onclick = () => closeSheet(true);

// poeira: modelo (fixo) + quantidade com zero no meio (esquerda escura, direita clara)
const DUST_TYPES = ['Fina', 'Média', 'Fiapos', 'Manchas', 'Mista', 'Pesada'];
DUST_TYPES.forEach((n, i) => {
  const b = document.createElement('button'); b.textContent = n; b.dataset.i = i;
  b.onclick = () => { state.dustType = i; if (!state.dust) state.dust = 0.5; syncDust(); draw(); };
  $('dustTypes').append(b);
});
function syncDust() {
  document.querySelectorAll('#dustTypes button').forEach((b) => b.classList.toggle('on', +b.dataset.i === state.dustType));
  const r = $('uRange'), v = Math.round(state.dust * 100); r.value = v; fillRange(r, 0);
  $('uVal').textContent = v > 0 ? `Clara ${v}` : v < 0 ? `Escura ${-v}` : '0';
}
$('uSeed').innerHTML = icon('dice');
$('uRange').addEventListener('input', () => {
  let v = +$('uRange').value; if (Math.abs(v) <= 2) { v = 0; $('uRange').value = 0; }
  state.dust = v / 100; syncDust(); draw();
  flashVal('Poeira', signed(v));
});
$('uRange').addEventListener('dblclick', () => { state.dust = 0; syncDust(); draw(); });
$('uSeed').onclick = () => { state.dustSeed = (state.dustSeed + 1 + Math.floor(Math.random() * 97)) % 997; if (!state.dust) state.dust = 0.5; syncDust(); draw(); };
$('uOk').onclick = () => closeSheet(true);
// Poeira e riscos: troca de folha sem fechar (o Cancelar desfaz as duas)
function swapSheet(id) {
  if (!openSheetId || openSheetId === id) return;
  $(openSheetId).classList.remove('on'); openSheetId = id; $(id).classList.add('on');
  if (id === 'dustSheet') syncDust(); else syncScr();
}
document.querySelectorAll('.markseg button').forEach((b) => { b.onclick = () => swapSheet(b.dataset.to); });
$('uCancel').onclick = () => closeSheet(false);
$('dCancel').onclick = () => closeSheet(false);

// papel: tipo, variação (dado) e intensidade
// t = tipo no renderer (a ordem na tela é outra, para não mudar receitas salvas); on = intensidade ao escolher
const PAPER_TYPES = [
  { n: 'Nenhum', t: -1, note: 'Como a foto fica impressa e passada no scanner: macia mas nítida, com o preto e o branco do papel.' },
  { n: 'Brilhante', t: 5, on: 0.6, note: 'Papel brilhante liso: pretos fundos, quase sem textura.' },
  { n: 'Lustre', t: 0, on: 0.6, note: 'Papel lustre, a "casca de laranja": relevo suave que aparece mais nos escuros.' },
  { n: 'Fosco', t: 6, on: 0.6, note: 'Papel fosco: preto mais aberto, mais luz espalhada, textura fina.' },
  { n: 'Jato de tinta', t: 8, on: 0.5, note: 'Medido numa cópia real: impressora jato de tinta em papel brilhante, passada no scanner. Preto aberto e frio, meios com mais cor, brancos neutros, pontinhos da tinta.' },
  { n: 'Instantânea', t: 7, on: 0.5, note: 'Medido em instax mini reais, passadas no scanner: preto que nunca fecha, branco contido, sombras azuladas, verdes e amarelos apagados, azuis vivos e imagem macia.' },
  { n: 'Marfim', t: 1, on: 0.7, note: 'Papel de algodão fosco, branco creme.' },
  { n: 'Tela', t: 2, on: 0.6, note: 'Impressão em tela, com a trama do tecido.' },
  { n: 'Revista', t: 3, on: 1, note: 'Retícula de gráfica em papel couché.' },
  { n: 'Fotocópia', t: 4, on: 1, note: 'Xerox em preto e branco.' },
];
PAPER_TYPES.forEach((p, i) => {
  const b = document.createElement('button'); b.textContent = p.n; b.dataset.t = p.t;
  b.onclick = () => {
    if (p.t < 0) state.paper = 0;
    else { if (!state.paper || state.paperType !== p.t) state.paper = p.on; state.paperType = p.t; }
    syncPaper(); draw();
  };
  $('paperTypes').append(b);
});
function syncPaper() {
  const on = state.paper > 0 ? state.paperType : -1;
  document.querySelectorAll('#paperTypes button').forEach((b) => b.classList.toggle('on', +b.dataset.t === on));
  $('ppNote').textContent = (PAPER_TYPES.find((p) => p.t === on) || PAPER_TYPES[0]).note;
  const r = $('ppRange'), v = Math.round(state.paper * 100); r.value = v; fillRange(r, 0);
  $('ppVal').textContent = String(v);
  $('ppSeed').disabled = !state.paper;
  // tom, cor e temperatura: só nos papéis de cópia fotográfica (brilhante, lustre, fosco, jato de tinta, instantânea)
  const more = state.paper > 0 && [0, 5, 6, 7, 8].includes(state.paperType);
  $('ppMore').style.display = more ? '' : 'none';
  for (const [id, v] of [['ppTone', state.paperTone - 1], ['ppCol', state.paperCol - 1], ['ppWarm', state.paperWarm]]) {
    const r = $(id), x = Math.round(v * 100); r.value = x; fillRange(r, 0);
    r.nextElementSibling.textContent = (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x);
  }
}
// cada controle vai de −100 a +100; 0 é o papel como foi medido. Tom e Cor multiplicam (0 a 2x), Temperatura soma.
for (const [id, k, n, base] of [['ppTone', 'paperTone', 'Tom do papel', 1], ['ppCol', 'paperCol', 'Cor do papel', 1], ['ppWarm', 'paperWarm', 'Temperatura', 0]]) {
  const r = $(id);
  r.addEventListener('input', () => { state[k] = base + +r.value / 100; syncPaper(); draw(); flashVal(n, r.nextElementSibling.textContent); });
  r.addEventListener('dblclick', () => { state[k] = base; syncPaper(); draw(); });
}
$('ppSeed').innerHTML = icon('dice');
$('ppRange').addEventListener('input', () => {
  const v = +$('ppRange').value; state.paper = v / 100; syncPaper(); draw(); flashVal('Papel', String(v));
});
$('ppRange').addEventListener('dblclick', () => { state.paper = 0; syncPaper(); draw(); });
$('ppSeed').onclick = () => { state.paperSeed = (state.paperSeed + 1 + Math.floor(Math.random() * 89)) % 991; syncPaper(); draw(); };
$('ppOk').onclick = () => closeSheet(true);
$('ppCancel').onclick = () => closeSheet(false);

// ------------------------------------------------------------ ajustar (endireitar, perspectiva, lente) com régua
const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '');
const GEO_RULER = {
  straight: { n: 'Endireitar', min: -45, max: 45, ppu: 12, step: 0.1, minor: 1, mid: 5, major: 10, val: (v) => v, set: (x) => x,
    fmt: (x) => sgn(x) + Math.abs(x).toFixed(1).replace('.', ',') + '°', lab: (x) => (x < 0 ? '−' : '') + Math.abs(x) + '°' },
  persV: { n: 'Vertical', min: -100, max: 100, ppu: 4, step: 1, minor: 5, mid: 25, major: 50, val: (v) => v * 100, set: (x) => x / 100,
    fmt: (x) => sgn(x) + Math.abs(x), lab: (x) => (x < 0 ? '−' : '') + Math.abs(x) },
};
GEO_RULER.persH = { ...GEO_RULER.persV, n: 'Horizontal' };
GEO_RULER.lens = { ...GEO_RULER.persV, n: 'Lente' };
let geoKey = 'straight';
for (const k of Object.keys(GEO_RULER)) {
  const b = document.createElement('button'); b.textContent = GEO_RULER[k].n; b.dataset.g = k; b.setAttribute('role', 'tab');
  b.onclick = () => { geoKey = k; syncGeo(); };
  $('geoTabs').append(b);
}
function openGeo(k) {
  if (!photo) { toast('Abra uma foto primeiro'); return; }
  geoKey = k; openSheet('geoSheet'); $('dock').classList.add('med');
  syncGeo(); positionOverlays();
}
const geoVal = () => GEO_RULER[geoKey].val(state[geoKey]);
function setGeoVal(x) {
  const R = GEO_RULER[geoKey];
  x = clamp(Math.round(x / R.step) * R.step, R.min, R.max);
  if (Math.abs(x) < R.step * 0.5) x = 0;
  const nv = R.set(+x.toFixed(2));
  if (nv === state[geoKey]) return;
  state[geoKey] = nv; syncGeo(); draw();
}
function syncGeo() {
  document.querySelectorAll('#geoTabs button').forEach((b) => {
    const on = b.dataset.g === geoKey;
    b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
    b.classList.toggle('set', !!state[b.dataset.g]);
  });
  const R = GEO_RULER[geoKey], x = geoVal();
  $('gVal').textContent = R.fmt(x);
  $('rulerBox').setAttribute('aria-valuetext', R.n + ' ' + R.fmt(x));
  drawRuler();
}
function drawRuler() {
  const cvs = $('ruler'), box = $('rulerBox'), dpr = devicePixelRatio || 1;
  const W = box.clientWidth, H = box.clientHeight; if (!W) return;
  if (cvs.width !== Math.round(W * dpr)) cvs.width = Math.round(W * dpr);
  if (cvs.height !== Math.round(H * dpr)) cvs.height = Math.round(H * dpr);
  const g = cvs.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const R = GEO_RULER[geoKey], x = geoVal(), cx = W / 2, X = (u) => cx + (u - x) * R.ppu;
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#93c45e', muted = css.getPropertyValue('--muted').trim() || '#998f80';
  // trecho entre o zero e o valor
  const a = X(Math.min(0, x)), b = X(Math.max(0, x));
  g.fillStyle = accent; g.fillRect(a, 30, Math.max(0, b - a), 2);
  const lo = Math.max(R.min, Math.ceil((x - cx / R.ppu) / R.minor) * R.minor), hi = Math.min(R.max, x + cx / R.ppu);
  g.font = '10px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
  for (let i = 0, u = lo; u <= hi + 1e-6; i++, u = lo + i * R.minor) {
    const uu = Math.round(u / R.minor) * R.minor, px = Math.round(X(uu)) + 0.5;
    const isMaj = Math.abs(uu % R.major) < 1e-6, isMid = Math.abs(uu % R.mid) < 1e-6;
    const fade = 1 - Math.min(1, Math.abs(px - cx) / (cx + 1)) * 0.75;
    g.strokeStyle = uu === 0 ? '#fff' : muted; g.globalAlpha = (isMaj ? 1 : isMid ? 0.85 : 0.55) * fade;
    g.lineWidth = uu === 0 ? 2 : 1;
    const h = uu === 0 ? 18 : isMaj ? 14 : isMid ? 10 : 6;
    g.beginPath(); g.moveTo(px, 30 - h); g.lineTo(px, 30); g.stroke();
    if (isMaj) { g.fillStyle = muted; g.fillText(R.lab(uu), px, 36); }
  }
  g.globalAlpha = 1;
  // indicador fixo no centro
  g.fillStyle = accent; g.fillRect(cx - 1, 6, 2, 28);
  g.beginPath(); g.moveTo(cx - 5, 1); g.lineTo(cx + 5, 1); g.lineTo(cx, 7); g.closePath(); g.fill();
}
{
  const box = $('rulerBox'); let rd = null, lastTapT = 0;
  box.addEventListener('pointerdown', (e) => {
    e.preventDefault(); box.setPointerCapture(e.pointerId); box.focus({ preventScroll: true });
    const now = performance.now();
    if (now - lastTapT < 300) { setGeoVal(0); lastTapT = 0; rd = null; return; }   // dois toques: zera
    lastTapT = now;
    rd = { x: e.clientX, v: geoVal() };
  });
  box.addEventListener('pointermove', (e) => {
    if (!rd) return;
    const R = GEO_RULER[geoKey];
    let v = rd.v - (e.clientX - rd.x) / R.ppu;
    if (Math.abs(v) < R.step * 4 && Math.abs(rd.v) >= R.step * 4) v = 0;    // encaixa no zero ao passar por ele
    setGeoVal(v);
  });
  const end = () => { rd = null; };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  box.addEventListener('wheel', (e) => { e.preventDefault(); const R = GEO_RULER[geoKey]; setGeoVal(geoVal() + ((e.deltaX || e.deltaY) / R.ppu) * 0.5); }, { passive: false });
  box.addEventListener('keydown', (e) => {
    const R = GEO_RULER[geoKey], d = (e.shiftKey ? 10 : 1) * R.step;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setGeoVal(geoVal() - d); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setGeoVal(geoVal() + d); e.preventDefault(); }
    if (e.key === 'Home' || e.key === '0') { setGeoVal(0); e.preventDefault(); }
  });
  addEventListener('resize', () => { if (openSheetId === 'geoSheet') drawRuler(); });
}
$('gReset').onclick = () => setGeoVal(0);
$('gOk').onclick = () => closeSheet(true);
$('gCancel').onclick = () => closeSheet(false);

// ------------------------------------------------------------ gráfico (só pelo menu ⋯): meio-tom, cores, duotônico, tritônico
const GFX_TYPES = ['Nenhum', 'Meio-tom', 'Meio-tom em cores', 'Duotônico', 'Tritônico'];
const GFX_ROWS = {
  size: { k: 'gfxSize', n: 'Ponto', min: 0, max: 100 },
  con: { k: 'gfxCon', n: 'Contraste', min: -100, max: 100 },
  amt: { k: 'gfxAmt', n: 'Intensidade', min: 0, max: 100 },
};
GFX_TYPES.forEach((n, i) => {
  const b = document.createElement('button'); b.textContent = n; b.dataset.i = i;
  b.onclick = () => { state.gfx = i; if (i && !state.gfxAmt) state.gfxAmt = 1; buildGfx(); draw(); };
  $('gfxTypes').append(b);
});
const css3 = (c) => `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`;
function openGfx() {
  if (!photo) { toast('Abra uma foto primeiro'); return; }
  openSheet('gfxSheet'); $('dock').classList.add('med'); buildGfx();
}
function buildGfx() {
  document.querySelectorAll('#gfxTypes button').forEach((b) => b.classList.toggle('on', +b.dataset.i === state.gfx));
  const sw = $('gfxSw'); sw.innerHTML = '';
  const pal = state.gfx === 3 ? GFX_DUO : state.gfx === 4 ? GFX_TRI : null;
  sw.style.display = pal ? '' : 'none';
  if (pal) pal.forEach((p, i) => {
    const b = document.createElement('button'); b.className = 'sw'; b.title = p.n; b.setAttribute('aria-label', p.n);
    b.style.background = `linear-gradient(90deg, ${p.c.map(css3).join(', ')})`;
    b.classList.toggle('on', i === (state.gfx === 3 ? state.gfxDuo : state.gfxTri));
    b.onclick = () => { if (state.gfx === 3) state.gfxDuo = i; else state.gfxTri = i; buildGfx(); draw(); flashVal(state.gfx === 3 ? 'Duotônico' : 'Tritônico', p.n); };
    sw.append(b);
  });
  const rows = $('gfxRows'); rows.innerHTML = '';
  const keys = state.gfx === 1 || state.gfx === 2 ? ['size', 'con', 'amt'] : state.gfx ? ['con', 'amt'] : [];
  for (const key of keys) {
    const r = GFX_ROWS[key], row = document.createElement('div'); row.className = 'prow';
    row.innerHTML = `<span>${r.n}</span><div class="rw${r.min < 0 ? ' bi' : ''}"><input type="range" min="${r.min}" max="${r.max}" step="1" aria-label="${r.n}"></div><output></output>`;
    const inp = row.querySelector('input'), out = row.querySelector('output'), d = defaults()[r.k] * 100;
    const show = () => { const v = Math.round(state[r.k] * 100); inp.value = v; out.textContent = r.min < 0 ? signed(v) : String(v); fillRange(inp, r.min < 0 ? 0 : r.min); };
    inp.addEventListener('input', () => {
      let v = +inp.value; if (r.min < 0 && Math.abs(v) <= 2) v = 0;
      state[r.k] = v / 100; show(); draw(); flashVal(r.n, r.min < 0 ? signed(v) : String(v));
    });
    inp.addEventListener('dblclick', () => { state[r.k] = d / 100; show(); draw(); });
    show(); rows.append(row);
  }
  $('gfxNote').style.display = state.gfx ? 'none' : '';
}
$('btnGfx').onclick = () => openGfx();
$('gfxOk').onclick = () => closeSheet(true);
$('gfxCancel').onclick = () => closeSheet(false);
function syncGfxMenu() { $('btnGfx').textContent = state.gfx ? `Gráfico: ${GFX_TYPES[state.gfx]}` : 'Gráfico…'; }

// ------------------------------------------------------------ corte: proporção, moldura, corte livre, grade
const ASPECT_NAMES = { livre: 'Livre', orig: 'Original', '1:1': '1:1', '4:5': '4:5', '5:4': '5:4', '3:2': '3:2', '2:3': '2:3', '16:9': '16:9', '9:16': '9:16' };
for (const a of Object.keys(ASPECTS)) {
  const b = document.createElement('button'); b.textContent = ASPECT_NAMES[a]; b.dataset.a = a;
  b.onclick = () => { state.aspect = a; state.crop = [0, 0, 1, 1]; syncUI(); draw(); commit(); };
  $('aspects').append(b);
}
// sem moldura de instantânea (pedido do usuário): fica só o efeito do papel Instantânea; edições antigas ainda abrem
for (const k of Object.keys(FRAMES).filter((k) => k !== 'instant')) {
  const b = document.createElement('button'); b.textContent = FRAMES[k]?.name || 'Nenhuma'; b.dataset.fr = k;
  b.onclick = () => { state.frame = k; syncUI(); draw(); commit(); if (k !== 'none' && mode === 'crop') toast('A moldura aparece ao sair do Corte'); };
  $('frames').append(b);
}

function viewBox() {
  const sr = $('stage').getBoundingClientRect(), vr = view.getBoundingClientRect();
  return { L: vr.left - sr.left, T: vr.top - sr.top, W: vr.width, H: vr.height };
}
function positionOverlays() {
  const cb = $('cropBox'), go = $('gridOv');
  const geoSheet = !!(photo && openSheetId === 'geoSheet');
  const showCrop = !!(photo && cropEditing() && !openSheetId);
  cb.classList.toggle('on', showCrop);
  go.classList.toggle('on', geoSheet);
  $('zoomTag').style.display = zoom ? 'block' : 'none';
  if (!photo || (!showCrop && !geoSheet)) return;
  const { L, T, W, H } = viewBox();
  if (showCrop) {
    const c = state.crop;
    Object.assign(cb.style, { left: L + c[0] * W + 'px', top: T + c[1] * H + 'px', width: (c[2] - c[0]) * W + 'px', height: (c[3] - c[1]) * H + 'px' });
  }
  if (geoSheet) {
    Object.assign(go.style, { left: L + 'px', top: T + 'px', width: W + 'px', height: H + 'px' });
    const dpr = devicePixelRatio || 1;
    go.width = Math.round(W * dpr); go.height = Math.round(H * dpr);
    const g = go.getContext('2d'); g.clearRect(0, 0, go.width, go.height);
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1;
    const n = 8, step = Math.min(go.width, go.height) / n;
    g.beginPath();
    for (let x = (go.width % step) / 2; x < go.width; x += step) { g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, go.height); }
    for (let y = (go.height % step) / 2; y < go.height; y += step) { g.moveTo(0, Math.round(y) + 0.5); g.lineTo(go.width, Math.round(y) + 0.5); }
    g.stroke();
  }
}
// arrastar alças (cantos) ou mover o retângulo
let cdrag = null;
const cbox = $('cropBox');
cbox.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  const c = e.target.dataset.c;
  const { W, H } = viewBox();
  cdrag = { c: c === undefined ? 'move' : +c, x: e.clientX, y: e.clientY, crop: [...state.crop], W, H };
  cbox.setPointerCapture(e.pointerId);
});
cbox.addEventListener('pointermove', (e) => {
  if (!cdrag) return;
  const dx = (e.clientX - cdrag.x) / cdrag.W, dy = (e.clientY - cdrag.y) / cdrag.H;
  let [x0, y0, x1, y1] = cdrag.crop;
  if (cdrag.c === 'move') {
    const w = x1 - x0, h = y1 - y0;
    x0 = clamp(x0 + dx, 0, 1 - w); y0 = clamp(y0 + dy, 0, 1 - h); x1 = x0 + w; y1 = y0 + h;
  } else {
    const c = cdrag.c, left = c === 0 || c === 2, top = c < 2;
    const ax = left ? x1 : x0, ay = top ? y1 : y0;               // canto oposto fica parado
    const px = clamp((left ? x0 : x1) + dx, 0, 1), py = clamp((top ? y0 : y1) + dy, 0, 1);
    const maxW = left ? ax : 1 - ax, maxH = top ? ay : 1 - ay, MIN = 0.08;
    let w = clamp(Math.abs(px - ax), MIN, maxW), h = clamp(Math.abs(py - ay), MIN, maxH);
    if (state.aspect !== 'livre') { const s = Math.min(Math.max(w, h), maxW, maxH); w = h = s; } // mantém a proporção
    x0 = left ? ax - w : ax; x1 = x0 + w; y0 = top ? ay - h : ay; y1 = y0 + h;
  }
  state.crop = [x0, y0, x1, y1].map((n) => Math.round(n * 1e4) / 1e4);
  positionOverlays();
});
const endCrop = () => { if (cdrag) { cdrag = null; commit(); markTools(); } };
cbox.addEventListener('pointerup', endCrop);
cbox.addEventListener('pointercancel', endCrop);

// ------------------------------------------------------------ lupa 100%
// on = true: vai para 100% (lupa); a pinça usa setZoomScale
function setZoom(on, cx = 0.5, cy = 0.5) {
  if (on) {
    if (!photo) return;
    if (mode === 'crop') setMode('films');
    const g = zoomGeom(1);
    if (g.s100 <= 1.02) { toast('A foto inteira já aparece em 100%'); return; }
    zoom = { cx, cy, s: g.s100 };
  } else zoom = null;
  markTools(); draw();
}
function setZoomScale(s, cx, cy) {
  if (!photo) return;
  const g = zoomGeom(1);
  s = clamp(s, 1, g.maxS);
  const was = !!zoom;
  zoom = s <= 1.01 ? null : { cx, cy, s };
  if (was !== !!zoom) markTools();
  draw();
}

// ------------------------------------------------------------ sincronizar interface
function syncUI() {
  syncFilms(); markTools(); syncGfxMenu();
  document.querySelectorAll('#aspects button').forEach((b) => b.classList.toggle('on', b.dataset.a === state.aspect));
  document.querySelectorAll('#frames button').forEach((b) => b.classList.toggle('on', b.dataset.fr === state.frame));
  positionOverlays();
}

// ------------------------------------------------------------ abrir foto
async function openPhoto(file) {
  try {
    toast('Abrindo…');
    const { bitmap, note } = await decodeFile(file);
    const s = Math.min(1, CAP() / Math.max(bitmap.width, bitmap.height));
    photo = { bitmap, w: Math.round(bitmap.width * s), h: Math.round(bitmap.height * s), name: file.name.replace(/\.[^.]+$/, '') };
    preview.setImage(scaled(bitmap, 2048), 'preview');
    thumbSrc = scaled(bitmap, 240);
    if (aux) aux.imgKey = null; zoom = null; glReady = false;
    // foto nova começa do zero (como no Lightroom, VSCO e Snapseed). A edição anterior fica guardada em
    // ⋯ › Colar ajustes, para quem quiser repetir o mesmo estilo.
    const edited = JSON.stringify(withoutGeo(state)) !== JSON.stringify(withoutGeo(defaults()));
    if (edited) store.set('revela.clip', withoutGeo(state));
    state = defaults(); hist = [JSON.stringify(state)]; hi = 0; updUndo(); syncUI();
    $('empty').style.display = 'none';
    view.style.display = 'block';
    $('btnExport').disabled = false;
    draw(); paintThumbs();
    toast(note || (edited ? 'Foto aberta. A edição anterior está em ⋯ › Colar ajustes' : 'Foto aberta'));
    last = null; setTimeout(selfCheck, 1200);
  } catch (e) {
    toast(e.message || 'Não consegui abrir essa imagem.');
    console.error(e);
  }
}
$('btnOpen').onclick = $('btnOpen2').onclick = () => $('fileImg').click();
$('btnLut').onclick = () => $('fileLut').click();
$('fileImg').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) openPhoto(f); e.target.value = ''; });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault();
  const files = [...e.dataTransfer.files];
  for (const f of files) if (f.name.toLowerCase().endsWith('.cube')) importLut(f);
  const imgs = files.filter(isImageFile);
  if (imgs.length) openPhoto(imgs[0]);
});

// ------------------------------------------------------------ toques na foto: segurar compara, dois toques = lupa, arrastar move a lupa
const holdOn = () => { if (!photo) return; bypass = true; $('badge').style.display = 'block'; draw(); };
const holdOff = () => { if (!bypass) return; bypass = false; $('badge').style.display = 'none'; draw(); };
let tap = { t: 0, x: 0, y: 0 }, holdTimer = 0, pan = null;
view.addEventListener('pointerdown', (e) => {
  if (!photo || cropEditing()) return;
  e.preventDefault();
  if (pinch) return;
  const now = performance.now();
  if (now - tap.t < 320 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) {
    tap.t = 0; clearTimeout(holdTimer); holdOff();
    if (zoom) return setZoom(false);
    const r = view.getBoundingClientRect(), v = last.v;
    const ux = ((e.clientX - r.left) / r.width - v.inner[0]) / (v.inner[2] - v.inner[0]);
    const uy = ((e.clientY - r.top) / r.height - v.inner[1]) / (v.inner[3] - v.inner[1]);
    return setZoom(true, clamp(ux, 0, 1), clamp(uy, 0, 1));
  }
  tap = { t: now, x: e.clientX, y: e.clientY };
  if (zoom) { pan = { x: e.clientX, y: e.clientY, cx: zoom.cx, cy: zoom.cy }; try { view.setPointerCapture(e.pointerId); } catch { /* ok */ } return; }
  holdTimer = setTimeout(holdOn, 170);
});
view.addEventListener('pointermove', (e) => {
  if (!pan || !zoom || !last) return;
  if (pinch) return;
  const g = last.zg || zoomGeom(zoom.s);
  zoom.cx = pan.cx - ((e.clientX - pan.x) * last.dpr) / g.DW;
  zoom.cy = pan.cy - ((e.clientY - pan.y) * last.dpr) / g.DH;
  draw();
});

// ------------------------------------------------------------ pinça (dois dedos) em qualquer aba, menos no Corte; ctrl+roda no computador
const touches = new Map();
let pinch = null;
// ponto da tela -> coordenada da foto (0..1), com ou sem zoom
function photoUv(px, py) {
  const r = view.getBoundingClientRect(), v = last.v;
  if (zoom) {
    const g = last.zg || zoomGeom(zoom.s);
    return [zoom.cx + ((px - (r.left + r.width / 2)) * last.dpr) / g.DW, zoom.cy + ((py - (r.top + r.height / 2)) * last.dpr) / g.DH];
  }
  return [((px - r.left) / r.width - v.inner[0]) / (v.inner[2] - v.inner[0]), ((py - r.top) / r.height - v.inner[1]) / (v.inner[3] - v.inner[1])];
}
// escala s mantendo o ponto da foto `uv` debaixo do ponto da tela (px, py)
function zoomAround(s, uv, px, py) {
  const g = zoomGeom(clamp(s, 1, zoomGeom(1).maxS)), r = view.getBoundingClientRect();
  const cxs = r.left + r.width / 2, cys = r.top + r.height / 2;
  setZoomScale(s, uv[0] - ((px - cxs) * last.dpr) / g.DW, uv[1] - ((py - cys) * last.dpr) / g.DH);
}
$('stage').addEventListener('pointerdown', (e) => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2 && photo && last && mode !== 'crop') {
    clearTimeout(holdTimer); holdOff(); pan = null; tap.t = 0;
    const [a, b] = [...touches.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: zoom ? zoom.s : 1, uv: photoUv(mx, my) };
  }
}, true);
addEventListener('pointermove', (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!pinch || touches.size < 2) return;
  const [a, b] = [...touches.values()];
  zoomAround(pinch.s0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0, pinch.uv, (a.x + b.x) / 2, (a.y + b.y) / 2);
});
const touchEnd = (e) => {
  touches.delete(e.pointerId);
  if (touches.size < 2 && pinch) { pinch = null; pan = null; if (zoom && zoom.s < 1.05) setZoomScale(1); }
};
addEventListener('pointerup', touchEnd);
addEventListener('pointercancel', touchEnd);
// iPhone: impede o zoom da página inteira com dois dedos
document.addEventListener('gesturestart', (e) => e.preventDefault());
$('stage').addEventListener('wheel', (e) => {
  if (!photo || !last || mode === 'crop' || !(e.ctrlKey || zoom)) return;
  e.preventDefault();
  zoomAround((zoom ? zoom.s : 1) * Math.exp(-e.deltaY * 0.01), photoUv(e.clientX, e.clientY), e.clientX, e.clientY);
}, { passive: false });
const release = () => { clearTimeout(holdTimer); pan = null; holdOff(); };
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
$('btnCompare').addEventListener('pointerdown', (e) => { e.preventDefault(); holdOn(); });
view.addEventListener('contextmenu', (e) => e.preventDefault());
$('btnCompare').addEventListener('contextmenu', (e) => e.preventDefault());

// ------------------------------------------------------------ menu do topo
const closeMenu = () => $('menu').classList.remove('on');
$('btnMenu').onclick = (e) => { e.stopPropagation(); $('menu').classList.toggle('on'); };
addEventListener('click', (e) => { if (!$('menu').contains(e.target)) closeMenu(); });
$('menu').addEventListener('click', (e) => { if (e.target.closest('button')) closeMenu(); });

// ------------------------------------------------------------ exportar
async function renderToBlob(bitmap, w0, h0, s, name) {
  ensureAux();
  const v = computeView(s, w0, h0);
  const es = exportScale(v);
  const ow = Math.round(v.outW * es), oh = Math.round(v.outH * es);
  aux.setImage(scaled(bitmap, Math.max(w0, h0)), 'full');
  const l = lutFor(s.look); aux.setLut(l.data, l.n);
  aux.setCurve(curveData(s.curve));
  const ov = makeOverlay(s, v, ...fit(ow, oh, 4096), frameNo(name));
  aux.render(ow, oh, renderParams(s), { w: v.innerW * es, h: v.innerH * es, src: Math.max(w0, h0) }, false,
    { ...v, overlay: ov?.canvas, overlayKey: ov ? 'export' + Math.random() : null });
  const blob = await new Promise((r) => aux.canvas.toBlob(r, 'image/jpeg', 0.94));
  aux.imgKey = null;
  aux.canvas.width = aux.canvas.height = 1;
  return { blob, w: ow, h: oh };
}
const isMobile = () => /Android|iPhone|iPad/i.test(navigator.userAgent);
// app instalado pelo APK (Capacitor): o WebView não baixa nem compartilha arquivos sozinho
const isNative = () => !!window.Capacitor?.isNativePlatform?.();
const toBase64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
async function deliverNative(files, dir = 'Pictures', label = 'Imagens') {
  const C = window.Capacitor, P = C.Plugins || {};
  const Filesystem = P.Filesystem || C.registerPlugin('Filesystem'), Share = P.Share || C.registerPlugin('Share');
  let saved = 0;
  for (const f of files) {
    const data = await toBase64(f);
    try {   // Android 11+: grava direto em Imagens/Pellicula, e a Galeria encontra
      await Filesystem.writeFile({ path: `${dir}/Pellicula/${f.name}`, data, directory: 'EXTERNAL_STORAGE', recursive: true });
      saved++;
    } catch {   // sem acesso: abre o compartilhar do Android
      const w = await Filesystem.writeFile({ path: f.name, data, directory: 'CACHE' });
      try { await Share.share({ title: f.name, files: [w.uri] }); } catch { /* cancelado */ }
    }
  }
  if (saved) toast(saved === 1 ? `Salvo em ${label} › Pellicula` : `${saved} fotos salvas em ${label} › Pellicula`);
  return saved;
}
async function deliver(files, nativeDir) {
  if (isNative()) return nativeDir ? deliverNative(files, ...nativeDir) : deliverNative(files);
  if (isMobile() && navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files }); return; } catch { /* cancelado */ }
  }
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f); a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    await new Promise((r) => setTimeout(r, 350));
  }
}
$('btnExport').addEventListener('click', async () => {
  if (!photo) return;
  closeSheet(true);
  const btn = $('btnExport'); btn.disabled = true; btn.textContent = 'Gerando…';
  try {
    await new Promise((r) => setTimeout(r, 30));
    const { blob, w, h } = await renderToBlob(photo.bitmap, photo.w, photo.h, state, photo.name);
    const n = await deliver([new File([blob], `${photo.name}_pellicula.jpg`, { type: 'image/jpeg' })]);
    if (!isNative()) toast(`Foto exportada (${w}×${h})`);
    else if (n) toast(`Salva em Imagens › Pellicula (${w}×${h})`);
  } catch (e) {
    console.error(e); toast('Falha ao exportar: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Exportar'; if (thumbSrc) paintThumbs();
  }
});

// ------------------------------------------------------------ exportar para o Instagram
// O feed mostra até 1080 px de largura e aceita de 4:5 (em pé) a 1,91:1 (deitada); fora disso ele recorta sozinho
// e recomprime pior. Aqui a foto já sai em 1080 px, reduzida com qualidade, e quem escolhe o que fazer com a sobra é
// você: bordas brancas (a foto inteira aparece) ou recorte do centro.
const IG_W = 1080, IG_MIN = 4 / 5, IG_MAX = 1.91;
let igPick = null;
function igChoice(tall) {
  return new Promise((resolve) => {
    $('igNote').textContent = tall
      ? 'A foto é mais alta que 4:5, o máximo que o feed do Instagram mostra em pé. Escolha como ajustar:'
      : 'A foto é mais larga que 1,91:1, o máximo que o feed do Instagram mostra deitada. Escolha como ajustar:';
    igPick = (v) => { igPick = null; closeSheet(true); resolve(v); };
    openSheet('igSheet');
  });
}
$('igPad').onclick = () => igPick?.('pad');
$('igCrop').onclick = () => igPick?.('crop');
$('igCancel').onclick = () => (igPick ? igPick(null) : closeSheet(false));
// reduz pela metade enquanto der (cada passo com suavização boa) e faz o último passo no tamanho exato
function shrinkTo(src, sx, sy, sw, sh, w, h) {
  let cur = src, cx = sx, cy = sy, cw = sw, ch = sh;
  while (cw / 2 >= w && ch / 2 >= h) {
    const c = document.createElement('canvas'); c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, cx, cy, cw, ch, 0, 0, c.width, c.height);
    cur = c; cx = cy = 0; cw = c.width; ch = c.height;
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, cx, cy, cw, ch, 0, 0, w, h);
  return c;
}
$('btnIg').onclick = async () => {
  if (!photo) { toast('Abra uma foto primeiro'); return; }
  closeSheet(true);
  const v = computeView(state, photo.w, photo.h), r = v.outW / v.outH;
  let how = null;
  if (r < IG_MIN - 0.005 || r > IG_MAX + 0.005) { how = await igChoice(r < IG_MIN); if (!how) return; }
  const btn = $('btnExport'); btn.disabled = true; btn.textContent = 'Gerando…';
  try {
    await new Promise((res) => setTimeout(res, 30));
    const { blob } = await renderToBlob(photo.bitmap, photo.w, photo.h, state, photo.name);
    const bmp = await createImageBitmap(blob), W = bmp.width, H = bmp.height;
    const R = how ? (r < IG_MIN ? IG_MIN : IG_MAX) : W / H;   // proporção final
    const ow = IG_W, oh = Math.round(IG_W / R);
    let out;
    if (how === 'crop') {   // recorta o centro na proporção limite
      const cw = r < IG_MIN ? W : Math.round(H * R), ch = r < IG_MIN ? Math.round(W / R) : H;
      out = shrinkTo(bmp, (W - cw) / 2, (H - ch) / 2, cw, ch, ow, oh);
    } else if (how === 'pad') {   // a foto inteira, centrada em branco
      const s = Math.min(ow / W, oh / H), fw = Math.round(W * s), fh = Math.round(H * s);
      const img = shrinkTo(bmp, 0, 0, W, H, fw, fh);
      out = document.createElement('canvas'); out.width = ow; out.height = oh;
      const x = out.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, ow, oh);
      x.drawImage(img, Math.round((ow - fw) / 2), Math.round((oh - fh) / 2));
    } else out = W <= ow ? shrinkTo(bmp, 0, 0, W, H, W, H) : shrinkTo(bmp, 0, 0, W, H, ow, oh);
    bmp.close?.();
    const jb = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.92));
    const n = await deliver([new File([jb], `${photo.name}_instagram.jpg`, { type: 'image/jpeg' })]);
    if (!isNative()) toast(`Pronta para o Instagram (${out.width}×${out.height})`);
    else if (n) toast(`Salva em Imagens › Pellicula (${out.width}×${out.height})`);
  } catch (e) {
    console.error(e); toast('Falha ao exportar: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Exportar'; if (thumbSrc) paintThumbs();
  }
};

// ------------------------------------------------------------ lote
$('btnBatch').onclick = () => $('fileBatch').click();
$('fileBatch').addEventListener('change', async (e) => {
  const files = [...e.target.files].filter(isImageFile); e.target.value = '';
  if (!files.length) return;
  const out = [];
  const s0 = { ...JSON.parse(JSON.stringify(state)), rot: 0, flip: false, straight: 0, persV: 0, persH: 0, lens: 0, crop: [0, 0, 1, 1] };
  for (let i = 0; i < files.length; i++) {
    toast(`Processando ${i + 1} de ${files.length}…`);
    try {
      const { bitmap } = await decodeFile(files[i]);
      const s = Math.min(1, CAP() / Math.max(bitmap.width, bitmap.height));
      const nm = files[i].name.replace(/\.[^.]+$/, '');
      const { blob } = await renderToBlob(bitmap, Math.round(bitmap.width * s), Math.round(bitmap.height * s), s0, nm);
      bitmap.close?.();
      out.push(new File([blob], nm + '_pellicula.jpg', { type: 'image/jpeg' }));
    } catch (err) { console.error(err); toast(`${files[i].name}: ${err.message}`); await new Promise((r) => setTimeout(r, 1500)); }
  }
  if (out.length) { await deliver(out); toast(`${out.length} foto(s) exportada(s)`); }
  if (thumbSrc) paintThumbs();
});

// ------------------------------------------------------------ copiar e colar, redefinir
const withoutGeo = (s) => { const o = JSON.parse(JSON.stringify(s)); for (const k of GEO_KEYS) delete o[k]; return o; };
const keepGeo = () => Object.fromEntries(GEO_KEYS.map((k) => [k, state[k]]));
$('btnCopy').onclick = () => { store.set('revela.clip', withoutGeo(state)); toast('Ajustes copiados'); };
$('btnPaste').onclick = () => {
  const c = store.get('revela.clip', null);
  if (!c) return toast('Nada copiado ainda');
  state = withDefaults({ ...c, ...keepGeo() }); syncUI(); draw(); commit(); toast('Ajustes colados');
};
$('btnResetAll').onclick = () => { state = defaults(); zoom = null; syncUI(); draw(); commit(); toast('Tudo redefinido'); };

// ------------------------------------------------------------ LUTs do usuário (ficam só neste aparelho)
const DB = 'revela', STORE = 'luts';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function saveLut(rec) {
  try { const db = await idb(); db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec); } catch (e) { console.warn(e); }
}
async function loadLuts() {
  try {
    const db = await idb();
    const all = await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    for (const r of all) { const { size, data } = parseCube(r.text); userLuts.push({ id: r.id, name: r.name, data, n: size }); }
  } catch (e) { console.warn(e); }
}
async function importLut(file) {
  try {
    const text = await file.text();
    const { size, data } = parseCube(text);
    const id = 'u_' + file.name, name = file.name.replace(/\.cube$/i, '');
    const i = userLuts.findIndex((x) => x.id === id);
    const rec = { id, name, data, n: size };
    if (i >= 0) userLuts[i] = rec; else userLuts.push(rec);
    lutOnPreview = null;
    await saveLut({ id, name, text });
    cat = 'mine'; store.set('revela.cat', cat); setMode('films'); buildStrip(); applyFilm(id);
    toast(`LUT "${name}" importada`);
  } catch (e) { toast(`${file.name}: ${e.message}`); }
}
$('fileLut').addEventListener('change', async (e) => { for (const f of e.target.files) await importLut(f); e.target.value = ''; });

// ------------------------------------------------------------ backup: receitas, filmes do Lab e LUTs num arquivo só
const BACKUP_KEYS = ['revela.recipes', 'revela.filmLooks', 'revela.looks'];
async function allLutRecs() {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
$('btnBackup').onclick = async () => {
  try {
    const ls = {};
    for (const k of BACKUP_KEYS) { const v = store.get(k, null); if (v != null) ls[k] = v; }
    let luts = [];
    try { luts = (await allLutRecs()).map(({ id, name, text }) => ({ id, name, text })); } catch { /* sem IndexedDB */ }
    const nRec = (ls['revela.recipes'] || []).length, nFilm = Object.keys(ls['revela.filmLooks'] || {}).length;
    if (!nRec && !nFilm && !luts.length && !ls['revela.looks']) return toast('Nada para salvar: sem receitas, LUTs ou filmes ajustados');
    const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const json = JSON.stringify({ app: 'pellicula', backup: 1, date: d.toISOString(), ls, luts });
    const file = new File([json], `pellicula-backup-${day}.json`, { type: 'application/json' });
    const n = await deliver([file], ['Documents', 'Documentos']);
    if (!isNative()) toast(`Backup: ${nRec} receitas, ${luts.length} LUTs, ${nFilm} filmes do Lab`);
    else if (n) toast(`Backup salvo em Documentos › Pellicula`);
  } catch (e) { console.error(e); toast('Falha no backup: ' + e.message); }
};
$('btnRestore').onclick = () => $('fileBackup').click();
$('fileBackup').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let b;
  try { b = JSON.parse(await f.text()); } catch { return toast('Esse arquivo não é um backup do Pellicula'); }
  if (!b || b.app !== 'pellicula' || typeof b.ls !== 'object') return toast('Esse arquivo não é um backup do Pellicula');
  const recs = Array.isArray(b.ls['revela.recipes']) ? b.ls['revela.recipes'] : [];
  const films = b.ls['revela.filmLooks'] && typeof b.ls['revela.filmLooks'] === 'object' ? b.ls['revela.filmLooks'] : {};
  const luts = Array.isArray(b.luts) ? b.luts.filter((l) => l && l.id && typeof l.text === 'string') : [];
  const when = b.date ? new Date(b.date).toLocaleDateString('pt-BR') : '';
  const ok = await ask({ title: 'Restaurar backup', note: `Backup${when ? ' de ' + when : ''}: ${recs.length} receitas, ${luts.length} LUTs, ${Object.keys(films).length} filmes do Lab. Junta com o que já está aqui; itens com o mesmo nome são substituídos pelos do backup.` });
  if (!ok) return;
  try {
    const mine = store.get('revela.recipes', []);
    for (const r of recs) { const i = mine.findIndex((x) => x.id && x.id === r.id); if (i >= 0) mine[i] = r; else mine.push(r); }
    if (recs.length && !store.set('revela.recipes', mine)) throw new Error('sem espaço para as receitas');
    if (Object.keys(films).length) store.set('revela.filmLooks', { ...store.get('revela.filmLooks', {}), ...films });
    if (Array.isArray(b.ls['revela.looks'])) store.set('revela.looks', b.ls['revela.looks']);
    for (const l of luts) { parseCube(l.text); await saveLut({ id: l.id, name: l.name || l.id, text: l.text }); }
    toast('Backup restaurado');
    setTimeout(() => location.reload(), 900);
  } catch (err) { console.error(err); toast('Falha ao restaurar: ' + err.message); }
});

// ------------------------------------------------------------ diagnóstico: mostra na tela por que a foto não aparece
function centerPixel() {
  if (!preview || !last) return null;
  const g = preview.gl, px = new Uint8Array(4);
  g.readPixels(Math.floor(last.w / 2), Math.floor(last.h / 2), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  return [...px.slice(0, 3)];
}
// a foto não apareceu: tenta o modo seguro uma vez; se ainda assim falhar, abre o Diagnóstico sozinho
// desenho que nunca chegou à tela fica transparente (o shader sempre escreve alfa 1); foto escura não conta
function blank() {
  if (preview.lost || !last) return true;
  const g = preview.gl, px = new Uint8Array(4);
  g.readPixels(Math.floor(last.w / 2), Math.floor(last.h / 2), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  return px[3] === 0;
}
function selfCheck(n = 0) {
  if (!photo) return;
  // app em segundo plano: o desenho fica pausado; espera voltar sem contar o tempo
  if (document.visibilityState !== 'visible') { setTimeout(() => selfCheck(n), 1000); return; }
  // placa caída: o glFail já desceu o degrau; espera o Android devolver (glBack) ou pedir para reabrir
  if (preview.lost) { if (n < 8) setTimeout(() => selfCheck(n + 1), 1000); return; }
  // ainda não desenhou (aparelho lento, placa preparando o desenho): espera até ~8 s antes de concluir
  if (!last && n < 7) { setTimeout(() => selfCheck(n + 1), 1000); return; }
  if (!blank()) {   // a foto apareceu: libera as miniaturas
    if (!glReady) { glReady = true; paintThumbs(); }
    return;
  }
  // em branco sem a placa cair: desce um degrau na hora (modo seguro primeiro)
  if (glStep < GL_STEPS.length - 1) {
    glFail('foto em branco'); glFailed = false; clearTimeout(glWait);
    try { preview._init(); } catch (e) { diagErrs.push('degrau novo: ' + e.message); }
    glBack();
  } else showDiag();
}
// a placa travou: o Android bloqueia o desenho até o app ser reaberto, então o jeito é pedir para reabrir
let restartAsked = false;
async function askRestart() {
  if (restartAsked) return;
  restartAsked = true;
  await ask({ title: 'Reabra o Pellicula', note: 'A placa de vídeo deste aparelho travou e o Android só a devolve com o app reaberto. '
    + `Feche o app (inclusive da lista de apps recentes) e abra de novo: ele vai usar um desenho mais seguro (degrau ${glStep + 1} de ${GL_STEPS.length}: `
    + `${LV_NAMES[glLevel]}${safeMode ? ', modo seguro' : ''}). Se ainda assim a foto não aparecer, abra ⋯ › Diagnóstico e me mande o texto.` });
}
function diagnose() {
  const L = [], ua = navigator.userAgent;
  L.push(`Pellicula · ${isNative() ? 'app instalado (APK)' : 'navegador'}`);
  L.push((ua.match(/Android [\d.]+|iPhone OS [\d_]+|Chrome\/[\d.]+|Version\/[\d.]+/g) || [ua.slice(0, 80)]).join(' · '));
  if (!preview) L.push('WebGL2: não iniciou');
  else {
    const gl = preview.gl, dbg = gl.getExtension('WEBGL_debug_renderer_info');
    L.push('GPU: ' + (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)));
    L.push(`Contexto perdido: ${gl.isContextLost() ? 'SIM' : 'não'} · textura máx: ${preview.maxTex}`);
    L.push(`Modo seguro: ${safeMode ? 'sim' : 'não'} · preparo do desenho: ${preview.initMs ?? '?'} ms`);
    L.push(`Degrau: ${glStep + 1} de ${GL_STEPS.length} · nível ${preview.level} (${LV_NAMES[preview.level]})${glReady ? ' · foto apareceu' : ''}`);
    const rl = [...preview.log.map((x) => 'prévia ' + x), ...(aux?.log || []).map((x) => 'miniaturas ' + x)];
    if (rl.length) L.push('Placa de vídeo: ' + rl.slice(-4).join(' | '));
    L.push(`Float linear: ${gl.getExtension('OES_texture_float_linear') ? 'sim' : 'não'} · cor float: ${gl.getExtension('EXT_color_buffer_float') ? 'sim' : 'não'}`);
    try {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.fillStyle = '#c86432'; x.fillRect(0, 0, 64, 64);
      const t = new Renderer(document.createElement('canvas'));
      t.setImage(c, 'diag'); t.render(32, 32, renderParams(defaults()), { w: 64, h: 64, src: 64 });
      const px = new Uint8Array(4); t.gl.readPixels(16, 16, 1, 1, t.gl.RGBA, t.gl.UNSIGNED_BYTE, px);
      L.push(`Teste de desenho: ${px[0]},${px[1]},${px[2]} (o certo é perto de 200,100,50)`);
      t.gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch (e) { L.push('Teste de desenho: FALHOU · ' + e.message); }
    if (photo && last) {
      const p = centerPixel();
      L.push(`Centro da foto: ${p.join(',')} · desenho ${last.w}×${last.h} · tela ${view.style.width} × ${view.style.height}`);
      L.push(`Foto: ${photo.bitmap.width}×${photo.bitmap.height} (${photo.bitmap.constructor.name})`);
    } else if (photo) L.push(`Foto aberta (${photo.bitmap.width}×${photo.bitmap.height}), mas nada foi desenhado`);
    else L.push('Nenhuma foto aberta (abra uma e rode de novo)');
    L.push('Erro GL: ' + gl.getError());
  }
  L.push(diagErrs.length ? 'Erros: ' + diagErrs.slice(-4).join(' | ') : 'Erros: nenhum');
  return L.join('\n');
}
// abre o Diagnóstico já copiado; tocar no texto copia de novo
let diagOpen = false;
async function showDiag() {
  if (diagOpen) return;
  diagOpen = true;
  let txt; try { txt = diagnose(); } catch (e) { txt = 'Diagnóstico falhou: ' + e.message; }
  const copy = () => navigator.clipboard?.writeText(txt).then(() => toast('Diagnóstico copiado: é só colar na conversa'), () => {});
  copy();
  $('askNote').classList.add('diag'); $('askNote').onclick = copy;
  await ask({ title: 'Diagnóstico', note: txt + '\n\nToque no texto para copiar e me mande.' });
  $('askNote').classList.remove('diag'); $('askNote').onclick = null;
  diagOpen = false;
}
$('btnDiag').onclick = showDiag;

// ------------------------------------------------------------ aviso, PWA
let tt;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2800);
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isNative()) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (preview) { await loadLuts(); buildCats(); buildStrip(); syncUI(); updUndo(); }

// ------------------------------------------------------------ mouse no computador: arrastar as faixas que rolam para o lado
// (filmes, categorias, ferramentas, opções) e a roda do mouse rola para o lado também. No toque nada muda.
(() => {
  const scroller = (el) => {
    for (; el && el !== document.body; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 2) { const ox = getComputedStyle(el).overflowX; if (ox === 'auto' || ox === 'scroll') return el; }
    }
    return null;
  };
  let d = null, moved = false;
  addEventListener('pointerdown', (e) => {
    moved = false;
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('input, textarea, select, #stage')) return;
    const el = scroller(e.target);
    if (el) d = { el, x: e.clientX, sl: el.scrollLeft };
  });
  addEventListener('pointermove', (e) => {
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!moved && Math.abs(dx) > 5) { moved = true; d.el.classList.add('dragging'); }
    if (moved) d.el.scrollLeft = d.sl - dx;
  });
  const end = () => { if (d) d.el.classList.remove('dragging'); d = null; };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  // soltar depois de arrastar não conta como toque no filme
  addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.target.closest('#stage, input')) return;
    const el = scroller(e.target);
    if (el) { el.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
})();
