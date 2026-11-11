import { getLooks, LUT_N, buildLutData, identityLut, parseCube } from './looks.js';
import { Renderer } from './renderer.js';
import { icon } from './icons.js';
import {
  defaults, withDefaults, GFX_DUO, GFX_TRI, GEO_KEYS, KEEP_KEYS, computeView, curveData, curveFn, renderParams, decodeFile, isImageFile,
  HSL_NAMES, HSL_COLORS, ASPECTS, FRAMES, LEAKS, makeOverlay, autoDate,
} from './core.js';
import { specToState } from './recipes.js';
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
for (const id of ['sCancel', 'fCancel', 'hCancel', 'cCancel', 'lCancel', 'dCancel', 'uCancel', 'pCancel', 'ppCancel', 'gCancel', 'gfxCancel']) setIcon(id, 'cancel');
for (const id of ['sOk', 'fOk', 'hOk', 'cOk', 'lOk', 'dOk', 'rOk', 'uOk', 'pOk', 'ppOk', 'gOk', 'gfxOk']) setIcon(id, 'ok');
const NAV = { films: 'Pellicula', adjust: 'Ajustes', tex: 'Textura', fx: 'Efeitos', crop: 'Corte' };
document.querySelectorAll('#nav button').forEach((b) => { b.innerHTML = icon(b.dataset.m) + `<span>${NAV[b.dataset.m]}</span>`; });

let preview, aux;
try {
  preview = new Renderer(view);
  aux = new Renderer(document.createElement('canvas'));
} catch (e) {
  $('empty').textContent = 'Não foi possível iniciar: ' + e.message;
}
const CAP = () => Math.min(aux.maxTex, 8192);

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

// ------------------------------------------------------------ estado
let state = defaults();
let photo = null;
let bypass = false;
let zoom = null;          // lupa 100%: { cx, cy } no centro da janela, em coordenadas da foto (0..1)
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
function drawNow() {
  syncTextures();
  const { SW, SH, dpr } = stagePx();
  const src = Math.max(photo.w, photo.h);
  let v, w, h, full, ov = null;
  if (zoom) {
    const v0 = computeView(state, photo.w, photo.h, { zoom: [0, 0, 1, 1] });
    const es = exportScale(v0), FW = v0.innerW * es, FH = v0.innerH * es;
    w = Math.round(Math.min(SW, FW)); h = Math.round(Math.min(SH, FH));
    const zw = w / FW, zh = h / FH;
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
  overlayPrev = ov;
  preview.render(w, h, renderParams(state), full, bypass, { ...v, overlay: ov?.canvas, overlayKey: ov?.key });
  view.style.width = w / dpr + 'px'; view.style.height = h / dpr + 'px';
  last = { v, w, h, full, dpr };
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
const ADJ = [
  { k: 'exp', n: 'Exposição', min: -200, max: 200 },
  { k: 'con', n: 'Contraste' }, { k: 'high', n: 'Luzes' }, { k: 'shad', n: 'Sombras' },
  { k: 'temp', n: 'Temperatura' }, { k: 'tint', n: 'Matiz' }, { k: 'vib', n: 'Vibração' }, { k: 'sat', n: 'Saturação' },
  { k: 'clar', n: 'Claridade' }, { k: 'depth', n: 'Cor profunda', min: 0 },
  { s: 'hsl', n: 'Cor', i: 'hsl' }, { s: 'curve', n: 'Curvas', i: 'curve' },
  { k: 'white', n: 'Brancos' }, { k: 'black', n: 'Pretos' },
];
// painéis com vários controles. chips: grupos de botões (opções prontas); rows: controles deslizantes
const near = (a, b, t = 0.02) => Math.abs(a - b) <= t;
const P_SHARP = { p: 'sharp', n: 'Nitidez', i: 'sharp', rows: [
  { k: 'sharp', n: 'Quantidade' },
  { k: 'srad', n: 'Raio', min: 5, max: 30, scale: 10, fmt: (v) => (v / 10).toFixed(1) },
] };
const P_GRAIN = { p: 'grain', n: 'Grão', i: 'grain', on: { grain: 0.35 },
  chips: [
    { n: 'Tamanho', opts: [['Fino', { gsize: 1.1 }], ['Médio', { gsize: 1.7 }], ['Grosso', { gsize: 2.8 }]],
      pick: (s) => (s.gsize < 1.4 ? 0 : s.gsize < 2.25 ? 1 : 2) },
    { n: 'Tipo', opts: [['Prata', { gcolor: 0, grough: 0.3 }], ['Negativo', { gcolor: 0.35, grough: 0.45 }], ['Colorido', { gcolor: 1, grough: 0.7 }]],
      pick: (s) => (s.gcolor < 0.15 ? 0 : s.gcolor < 0.7 ? 1 : 2) },
  ],
  rows: [
    { k: 'grain', n: 'Intensidade', min: 0 },
    { k: 'gsize', n: 'Escala', min: 8, max: 40, scale: 10, fmt: (v) => (v / 10).toFixed(1) },
  ] };
const P_GLOW = { p: 'bloom', n: 'Brilho', i: 'bloom', rows: [
  { k: 'bloom', n: 'Quantidade' },
  { k: 'bloomR', n: 'Área', min: 0 },
] };
const P_HALO = { p: 'halo', n: 'Halação', i: 'halo', rows: [
  { k: 'halo', n: 'Intensidade', min: 0 },
  { k: 'haloR', n: 'Raio', min: 0 },
  { k: 'haloT', n: 'Limiar', min: 0 },
] };
const TEX = [
  { a: 'zoom', n: 'Lupa 100%', i: 'zoom' },
  P_SHARP, P_GRAIN, P_GLOW, P_HALO,
  { k: 'vlens', n: 'Lente antiga', min: 0 },
  { k: 'eblur', n: 'Borda suave', min: 0 },
  { s: 'paper', n: 'Papel', i: 'paper' },
];
const FX = [
  { k: 'fade', n: 'Desbotado', min: 0 }, { k: 'vig', n: 'Vinheta' },
  { s: 'leak', n: 'Luz', i: 'leak' }, { s: 'dust', n: 'Poeira', i: 'dust' }, { k: 'scratch', n: 'Arranhões', min: 0 },
  { k: 'chroma', n: 'Aberração', min: 0 }, { s: 'date', n: 'Data', i: 'date' },
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
    if (t.p) b.dataset.keys = [...t.rows.map((r) => r.k), ...(t.chips ? ['gcolor', 'grough'] : [])].join(',');
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
    else if (b.dataset.keys) { const main = b.dataset.keys.split(',')[0]; set = state[main] !== d[main]; } // marcado quando o efeito está ligado
    else if (!k.startsWith('act_')) set = JSON.stringify(state[k]) !== JSON.stringify(d[k]);
    b.classList.toggle('set', set);
  });
  document.querySelector('.tool[data-k="act_zoom"]')?.classList.toggle('on', !!zoom);
}

// ------------------------------------------------------------ Pellicula: filmes e "Minhas"
let cat = store.get('revela.cat', 'neg');
let thumbSrc = null;
let userRecipes = store.get('revela.recipes', []).map((r, i) => (r.id ? r : { id: `u_old${i}_${Date.now().toString(36)}`, ...r }));
const saveUserRecipes = () => { if (!store.set('revela.recipes', userRecipes)) toast('Não foi possível salvar neste navegador'); };
const findRecipe = (id) => userRecipes.find((r) => r.id === id);
const filmById = (id) => FILMS.find((f) => f.id === id);

// troca de filme: muda só a cor e o caráter do filme; luz, ajustes, corte e moldura ficam
function applyFilm(id) {
  const d = defaults(), prev = state.filmCh || {};
  for (const [k, v] of Object.entries(prev)) if (near(state[k], v, 1e-6)) state[k] = d[k];
  const f = filmById(id), ch = f ? { ...f.ch } : {};
  // um filme sempre define o grão (mesmo que seja "sem grão")
  if (f) for (const k of ['grain', 'gsize', 'grough', 'gcolor']) if (!(k in ch)) ch[k] = d[k];
  Object.assign(state, ch);
  state.filmCh = Object.keys(ch).length ? ch : null;
  state.look = id; state.mix = 1; state.recipe = null;
  syncUI(); draw(); commit();
}
function recipeParams(r) {
  if (r.spec) return specToState(r.spec);
  const o = JSON.parse(JSON.stringify(r.s || {}));
  for (const k of KEEP_KEYS) delete o[k];
  return o;
}
function applyRecipe(r) {
  state = withDefaults({ ...recipeParams(r), ...keepNow(), recipe: r.id, filmCh: null, seed: state.seed, leakSeed: state.leakSeed });
  syncUI(); draw(); commit();
}
function editSnapshot() {
  const s = JSON.parse(JSON.stringify(state));
  for (const k of [...KEEP_KEYS, 'recipe', 'filmCh']) delete s[k];
  return s;
}
function saveAsMine() {
  const base = filmById(state.look)?.code;
  const name = (prompt('Nome do seu filme', base ? `${base} meu` : `Meu ${userRecipes.length + 1}`) || '').trim();
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
  } else {
    for (const f of FILMS.filter((x) => x.cat === cat)) {
      const b = tile('', f.code); b.dataset.id = f.id; b.title = `${f.code} · inspirado no ${f.ref}`;
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
  if (r) { title = r.name; text = f ? `seu filme · feito a partir do ${f.code}` : 'seu filme'; }
  else if (f) { title = f.code; text = `inspirado no ${f.ref} · ${f.kind}`; }
  else if (state.look !== 'none') { title = lookName(state.look); text = 'LUT importada'; }
  else { title = 'Original'; text = 'toque num filme para aplicar; toque de novo para a intensidade'; }
  const info = $('filmInfo'); info.innerHTML = '<b></b><span></span>';
  info.querySelector('b').textContent = title; info.querySelector('span').textContent = text;
}

function openFilmSheet(name) {
  $('fTitle').textContent = name;
  $('fRange').value = Math.round(state.mix * 100); $('fVal').textContent = $('fRange').value;
  openSheet('filmSheet');
}
$('fRange').addEventListener('input', () => { state.mix = +$('fRange').value / 100; $('fVal').textContent = $('fRange').value; draw(); flashVal('Filme', $('fRange').value); });
$('fSave').onclick = () => { closeSheet(true); saveAsMine(); };
$('fOk').onclick = () => closeSheet(true);
$('fCancel').onclick = () => closeSheet(false);

let paintGen = 0;
async function paintThumbs() {
  const gen = ++paintGen;
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
  $('rNote').textContent = f ? `Feito a partir do ${f.code} (inspirado no ${f.ref}).` : 'Seu filme, com todos os ajustes salvos.';
  openSheet('recSheet');
}
$('rRen').onclick = () => {
  const r = sheetRecipe, name = (prompt('Novo nome', r.name) || '').trim();
  if (!name) return;
  r.name = name; saveUserRecipes(); $('rTitle').textContent = name; buildStrip();
};
$('rUpd').onclick = () => {
  const r = sheetRecipe;
  if (!confirm(`Substituir “${r.name}” pela edição atual?`)) return;
  const snap = sheetSnap ? JSON.parse(sheetSnap) : state;
  const s = JSON.parse(JSON.stringify(snap)); for (const k of [...KEEP_KEYS, 'recipe', 'filmCh']) delete s[k];
  delete r.spec; r.s = s; saveUserRecipes(); closeSheet(true); buildStrip(); toast(`“${r.name}” atualizado`);
};
$('rDel').onclick = () => {
  const r = sheetRecipe;
  if (!confirm(`Excluir “${r.name}”?`)) return;
  userRecipes = userRecipes.filter((x) => x.id !== r.id); saveUserRecipes();
  if (state.recipe === r.id) state.recipe = null;
  closeSheet(true); buildStrip(); toast('Excluído');
};
$('rOk').onclick = () => closeSheet(true);

// ------------------------------------------------------------ folhas especiais: cor (HSL), curvas, luz, data
function openSpecial(s) {
  if (s === 'hsl') { syncHsl(); openSheet('hslSheet'); }
  if (s === 'curve') { openSheet('curveSheet'); drawCurve(); }
  if (s === 'leak') { syncLeak(); openSheet('leakSheet'); }
  if (s === 'date') { openSheet('dateSheet'); if (!state.date) { state.date = true; draw(); } syncDate(); }
  if (s === 'dust') { openSheet('dustSheet'); syncDust(); }
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

LEAKS.forEach((L, i) => {
  const b = document.createElement('button'); b.textContent = L.name; b.dataset.i = i;
  b.onclick = () => { state.leakType = i; if (!state.leak) state.leak = 0.5; syncLeak(); draw(); };
  $('leakTypes').append(b);
});
function syncLeak() {
  document.querySelectorAll('#leakTypes button').forEach((b) => b.classList.toggle('on', +b.dataset.i === state.leakType && state.leak > 0));
  $('leakRange').value = Math.round(state.leak * 100); $('leakRange').parentElement.querySelector('output').textContent = $('leakRange').value;
}
$('leakRange').addEventListener('input', () => { state.leak = +$('leakRange').value / 100; syncLeak(); draw(); });
$('leakSeed').onclick = () => { state.leakSeed = Math.floor(Math.random() * 1e5); state.seed = Math.floor(Math.random() * 1000); draw(); };
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
$('uCancel').onclick = () => closeSheet(false);
$('dCancel').onclick = () => closeSheet(false);

// papel: tipo, variação (dado) e intensidade
const PAPER_TYPES = ['Nenhum', 'Fotográfico', 'Marfim', 'Tela', 'Revista', 'Fotocópia'];
const PAPER_ON = [0, 0.6, 0.7, 0.6, 1, 1];   // intensidade inicial ao escolher o tipo
PAPER_TYPES.forEach((n, i) => {
  const b = document.createElement('button'); b.textContent = n; b.dataset.i = i;
  b.onclick = () => {
    if (i === 0) state.paper = 0;
    else { if (!state.paper || state.paperType !== i - 1) state.paper = PAPER_ON[i]; state.paperType = i - 1; }
    syncPaper(); draw();
  };
  $('paperTypes').append(b);
});
function syncPaper() {
  const on = state.paper > 0 ? state.paperType + 1 : 0;
  document.querySelectorAll('#paperTypes button').forEach((b) => b.classList.toggle('on', +b.dataset.i === on));
  const r = $('ppRange'), v = Math.round(state.paper * 100); r.value = v; fillRange(r, 0);
  $('ppVal').textContent = String(v);
  $('ppSeed').disabled = !state.paper;
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
  const accent = css.getPropertyValue('--accent').trim() || '#e8b04a', muted = css.getPropertyValue('--muted').trim() || '#998f80';
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
for (const k of Object.keys(FRAMES)) {
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
function setZoom(on, cx = 0.5, cy = 0.5) {
  if (on) {
    if (!photo) return;
    if (mode === 'crop') setMode('films');
    const v0 = computeView(state, photo.w, photo.h, { zoom: [0, 0, 1, 1] });
    const es = exportScale(v0), { SW, SH } = stagePx();
    if (v0.innerW * es <= SW && v0.innerH * es <= SH) { toast('A foto inteira já aparece em 100%'); return; }
    zoom = { cx, cy };
  } else zoom = null;
  markTools(); draw();
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
    aux.imgKey = null; zoom = null;
    Object.assign(state, { rot: 0, flip: false, straight: 0, persV: 0, persH: 0, lens: 0, crop: [0, 0, 1, 1] }); syncUI(); commit();
    $('empty').style.display = 'none';
    view.style.display = 'block';
    $('btnExport').disabled = false;
    draw(); paintThumbs();
    toast(note || 'Foto aberta');
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
  if (zoom) { pan = { x: e.clientX, y: e.clientY, cx: zoom.cx, cy: zoom.cy }; view.setPointerCapture(e.pointerId); return; }
  holdTimer = setTimeout(holdOn, 170);
});
view.addEventListener('pointermove', (e) => {
  if (!pan || !zoom || !last) return;
  zoom.cx = pan.cx - ((e.clientX - pan.x) * last.dpr) / last.full.w;
  zoom.cy = pan.cy - ((e.clientY - pan.y) * last.dpr) / last.full.h;
  draw();
});
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
async function deliver(files) {
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
    await deliver([new File([blob], `${photo.name}_pellicula.jpg`, { type: 'image/jpeg' })]);
    toast(`Foto exportada (${w}×${h})`);
  } catch (e) {
    console.error(e); toast('Falha ao exportar: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Exportar'; if (thumbSrc) paintThumbs();
  }
});

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

// ------------------------------------------------------------ aviso, PWA
let tt;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2800);
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (preview) { await loadLuts(); buildCats(); buildStrip(); syncUI(); updUndo(); }
