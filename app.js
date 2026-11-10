import { getLooks, LUT_N, buildLutData, identityLut, parseCube } from './looks.js';
import { Renderer } from './renderer.js';
import { icon } from './icons.js';
import {
  defaults, withDefaults, GEO_KEYS, KEEP_KEYS, computeView, curveData, curveFn, renderParams, decodeFile, isImageFile,
  HSL_NAMES, HSL_COLORS, ASPECTS, FRAMES, LEAKS, makeOverlay, autoDate,
} from './core.js';
import { RECIPE_FIELDS, CLASSICS, blankSpec, specToState, fmtField } from './recipes.js';

const LOOKS = getLooks();
const $ = (id) => document.getElementById(id);
const view = $('view');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ------------------------------------------------------------ ícones da interface
const setIcon = (id, name) => { $(id).innerHTML = icon(name); };
setIcon('btnOpen', 'open'); setIcon('btnOpen2', 'open'); setIcon('btnLut', 'lut'); setIcon('btnMenu', 'menu');
setIcon('btnUndo', 'undo'); setIcon('btnRedo', 'redo'); setIcon('btnCompare', 'compare');
for (const id of ['sCancel', 'fCancel', 'hCancel', 'cCancel', 'lCancel', 'eCancel', 'dCancel', 'uCancel']) setIcon(id, 'cancel');
for (const id of ['sOk', 'fOk', 'hOk', 'cOk', 'lOk', 'eOk', 'dOk', 'rOk', 'uOk']) setIcon(id, 'ok');
const NAV = { films: 'Filmes', recipes: 'Receitas', adjust: 'Ajustes', tex: 'Textura', fx: 'Efeitos', crop: 'Corte' };
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
  $('dock').classList.remove('tall');
  openSheetId = null; sheetSnap = null; curTool = null;
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
  { k: 'con', n: 'Contraste' }, { k: 'high', n: 'Realces' }, { k: 'shad', n: 'Sombras' },
  { k: 'white', n: 'Brancos' }, { k: 'black', n: 'Pretos' },
  { k: 'temp', n: 'Temperatura' }, { k: 'tint', n: 'Matiz' }, { k: 'vib', n: 'Vibração' }, { k: 'sat', n: 'Saturação' },
  { k: 'depth', n: 'Cor profunda', min: 0 },
  { s: 'hsl', n: 'Cor', i: 'hsl' }, { s: 'curve', n: 'Curvas', i: 'curve' },
  { k: 'clar', n: 'Claridade' },
];
const TEX = [
  { a: 'zoom', n: 'Lupa 100%', i: 'zoom' },
  { k: 'sharp', n: 'Nitidez', i: 'sharp' }, { k: 'srad', n: 'Raio', min: 5, max: 30, scale: 10 },
  { k: 'eblur', n: 'Borda suave', min: 0 },
  { k: 'bloom', n: 'Difusão', min: 0 }, { k: 'halo', n: 'Halação', min: 0 },
  { k: 'grain', n: 'Grão', min: 0 }, { k: 'gsize', n: 'Tam. grão', min: 10, max: 40, scale: 10 },
  { k: 'grough', n: 'Aspereza', min: 0 }, { k: 'gcolor', n: 'Grão de cor', min: 0 },
  { k: 'paper', n: 'Papel', min: 0 },
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
    const b = document.createElement('button'); b.className = 'tool'; b.dataset.k = t.k || t.s || 'act_' + t.a;
    b.innerHTML = `<div class="ring">${icon(t.i || t.k)}</div><span>${t.n}</span>`;
    b.onclick = () => (t.a ? ACTIONS[t.a]() : t.s ? openSpecial(t.s) : openSlider(t));
    box.append(b);
  }
}
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
    else if (!k.startsWith('act_')) set = JSON.stringify(state[k]) !== JSON.stringify(d[k]);
    b.classList.toggle('set', set);
  });
  document.querySelector('.tool[data-k="act_zoom"]')?.classList.toggle('on', !!zoom);
}

// ------------------------------------------------------------ filmes
let favs = new Set(store.get('revela.fav', []));
let filter = 'all';
let thumbSrc = null;

function lookItems() {
  return [
    { id: 'none', name: 'Original', group: 'all' },
    ...LOOKS.map((l) => ({ id: l.id, name: l.name, group: l.group || 'Cor' })),
    ...userLuts.map((u) => ({ id: u.id, name: u.name, group: 'mine' })),
  ];
}
function buildStrip() {
  const strip = $('strip');
  strip.innerHTML = '';
  for (const it of lookItems()) {
    const b = document.createElement('button');
    b.className = 'film'; b.dataset.id = it.id; b.dataset.group = it.group; b.title = it.name;
    b.innerHTML = `<canvas width="152" height="152"></canvas><div class="knob">${icon('dial')}</div><span class="star">★</span><span class="nm"></span>`;
    b.querySelector('.nm').textContent = it.name;
    b.addEventListener('click', () => {
      if (state.look === it.id && it.id !== 'none') return openFilmSheet(it.name);
      state.look = it.id; state.mix = 1; state.recipe = null; syncFilms(); syncRecipes(); draw(); commit();
    });
    strip.append(b);
  }
  const plus = document.createElement('button');
  plus.className = 'film add'; plus.dataset.group = 'mine'; plus.title = 'Importar LUT .cube';
  plus.innerHTML = `<div class="ph">${icon('lut')}</div><span class="nm">Importar</span>`;
  plus.onclick = () => $('fileLut').click();
  strip.append(plus);
  syncFilms(); paintThumbs();
}
function syncFilms() {
  document.querySelectorAll('#strip .film').forEach((b) => {
    const id = b.dataset.id, g = b.dataset.group;
    if (id) { b.setAttribute('aria-pressed', String(id === state.look)); b.classList.toggle('fav', favs.has(id)); }
    const show = filter === 'all' ? true : filter === 'fav' ? favs.has(id) : filter === 'mine' ? g === 'mine' : g === filter;
    b.style.display = show || id === 'none' ? '' : 'none';
  });
  document.querySelectorAll('#cats button').forEach((b) => b.classList.toggle('on', b.dataset.f === filter));
}
document.querySelectorAll('#cats button').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; syncFilms(); }));

function openFilmSheet(name) {
  $('fTitle').textContent = name;
  $('fRange').value = Math.round(state.mix * 100); $('fVal').textContent = $('fRange').value;
  syncFav();
  openSheet('filmSheet');
}
function syncFav() { $('fFav').textContent = favs.has(state.look) ? '★ favorito' : '☆ favoritar'; }
$('fRange').addEventListener('input', () => { state.mix = +$('fRange').value / 100; $('fVal').textContent = $('fRange').value; draw(); });
$('fFav').onclick = () => {
  favs.has(state.look) ? favs.delete(state.look) : favs.add(state.look);
  store.set('revela.fav', [...favs]); syncFav(); syncFilms();
};
$('fOk').onclick = () => closeSheet(true);
$('fCancel').onclick = () => closeSheet(false);

let paintGen = 0;
async function paintThumbs() {
  const gen = ++paintGen;
  const cs = [...document.querySelectorAll('#strip .film[data-id] canvas')];
  if (!thumbSrc) {
    for (const c of cs) { const x = c.getContext('2d'); x.fillStyle = '#26221e'; x.fillRect(0, 0, c.width, c.height); }
    paintRecipeThumbs();
    return;
  }
  aux.setCurve(null);
  for (const c of cs) {
    if (gen !== paintGen) return;
    if (aux.imgKey !== 'thumb') aux.setImage(thumbSrc, 'thumb');
    aux.setCurve(null);
    const l = lutFor(c.parentElement.dataset.id); aux.setLut(l.data, l.n);
    aux.render(thumbSrc.width, thumbSrc.height, {}, { w: thumbSrc.width, h: thumbSrc.height });
    blitThumb(c);
    await new Promise((r) => setTimeout(r));
  }
  paintRecipeThumbs();
}
function blitThumb(c) {
  const s = Math.min(thumbSrc.width, thumbSrc.height);
  c.getContext('2d').drawImage(aux.canvas, (thumbSrc.width - s) / 2, (thumbSrc.height - s) / 2, s, s, 0, 0, c.width, c.height);
}

// ------------------------------------------------------------ receitas
let userRecipes = store.get('revela.recipes', []).map((r, i) => (r.id ? r : { id: `u_old${i}_${Date.now().toString(36)}`, ...r }));
let recFavs = new Set(store.get('revela.recfav', []));
let rfilter = 'classic';
const saveUserRecipes = () => { if (!store.set('revela.recipes', userRecipes)) toast('Não foi possível salvar neste navegador'); };
const allRecipes = () => [...CLASSICS.map((r) => ({ ...r, classic: true })), ...userRecipes];
const findRecipe = (id) => allRecipes().find((r) => r.id === id);
function recipeParams(r) {
  if (r.spec) return specToState(r.spec);
  const o = JSON.parse(JSON.stringify(r.s || {}));
  for (const k of KEEP_KEYS) delete o[k];
  return o;
}
function applyRecipe(r) {
  state = withDefaults({ ...recipeParams(r), ...keepNow(), recipe: r.id, seed: state.seed, leakSeed: state.leakSeed });
  syncUI(); draw(); commit();
  toast(`Receita “${r.name}”`);
}
function buildRecipeStrip() {
  const strip = $('rstrip'); strip.innerHTML = '';
  const list = allRecipes().filter((r) => (rfilter === 'classic' ? r.classic : rfilter === 'fav' ? recFavs.has(r.id) : !r.classic));
  for (const r of list) {
    const b = document.createElement('button');
    b.className = 'film rec'; b.dataset.rid = r.id; b.title = r.note || r.name;
    b.innerHTML = `<canvas width="152" height="152"></canvas><div class="knob">${icon('dial')}</div><span class="star">★</span><span class="nm"></span><span class="sub"></span>`;
    b.querySelector('.nm').textContent = r.name;
    b.querySelector('.sub').textContent = lookName(r.spec ? r.spec.film : r.s?.look || 'none');
    b.addEventListener('click', () => (state.recipe === r.id ? openRecSheet(r) : applyRecipe(r)));
    strip.append(b);
  }
  if (!list.length) {
    const p = document.createElement('p'); p.className = 'hint'; p.style.padding = '0 4px';
    p.textContent = rfilter === 'fav' ? 'Toque duas vezes numa receita e marque como favorita.' : 'Crie com “+ Nova”, ou ajuste a foto e use “Salvar edição”.';
    strip.append(p);
  }
  syncRecipes(); paintRecipeThumbs();
}
function syncRecipes() {
  document.querySelectorAll('#rstrip .film').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.rid === state.recipe));
    b.classList.toggle('fav', recFavs.has(b.dataset.rid));
  });
  document.querySelectorAll('#rcats button[data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === rfilter));
}
document.querySelectorAll('#rcats button[data-f]').forEach((b) => b.addEventListener('click', () => { rfilter = b.dataset.f; buildRecipeStrip(); }));

let rpaintGen = 0;
async function paintRecipeThumbs() {
  const gen = ++rpaintGen;
  const cs = [...document.querySelectorAll('#rstrip .film canvas')];
  if (!thumbSrc || !photo) {
    for (const c of cs) { const x = c.getContext('2d'); x.fillStyle = '#26221e'; x.fillRect(0, 0, c.width, c.height); }
    return;
  }
  for (const c of cs) {
    if (gen !== rpaintGen) return;
    const r = findRecipe(c.parentElement.dataset.rid); if (!r) continue;
    if (aux.imgKey !== 'thumb') aux.setImage(thumbSrc, 'thumb');
    const p = withDefaults(recipeParams(r));
    const l = lutFor(p.look); aux.setLut(l.data, l.n); aux.setCurve(curveData(p.curve));
    aux.render(thumbSrc.width, thumbSrc.height, renderParams(p), { w: photo.w, h: photo.h, src: Math.max(photo.w, photo.h) });
    blitThumb(c);
    await new Promise((res) => setTimeout(res));
  }
}

// folha da receita escolhida
let sheetRecipe = null;
function openRecSheet(r) {
  sheetRecipe = r;
  $('rTitle').textContent = r.name;
  $('rNote').textContent = r.note || `${lookName(r.spec ? r.spec.film : r.s?.look || 'none')} · ${r.spec ? 'receita de câmera' : 'edição salva'}`;
  $('rFav').textContent = recFavs.has(r.id) ? '★ Favorita' : '☆ Favoritar';
  $('rEdit').textContent = r.classic ? 'Editar cópia' : 'Editar';
  $('rEdit').style.display = r.spec ? '' : 'none';
  $('rDel').style.display = r.classic ? 'none' : '';
  openSheet('recSheet');
}
$('rFav').onclick = () => {
  const id = sheetRecipe.id;
  recFavs.has(id) ? recFavs.delete(id) : recFavs.add(id);
  store.set('revela.recfav', [...recFavs]);
  $('rFav').textContent = recFavs.has(id) ? '★ Favorita' : '☆ Favoritar';
  syncRecipes();
};
$('rEdit').onclick = () => openEditor(sheetRecipe, sheetRecipe.classic);
$('rDup').onclick = () => {
  const r = sheetRecipe, copy = { id: 'u' + Date.now().toString(36), name: `${r.name} (cópia)`, ...(r.spec ? { spec: { ...r.spec } } : { s: JSON.parse(JSON.stringify(r.s)) }) };
  userRecipes.push(copy); saveUserRecipes();
  state.recipe = copy.id; closeSheet(true); rfilter = 'mine'; buildRecipeStrip(); toast('Cópia criada em “Minhas”');
};
$('rDel').onclick = () => {
  const r = sheetRecipe;
  if (!confirm(`Excluir a receita “${r.name}”?`)) return;
  userRecipes = userRecipes.filter((x) => x.id !== r.id); saveUserRecipes();
  recFavs.delete(r.id); store.set('revela.recfav', [...recFavs]);
  if (state.recipe === r.id) state.recipe = null;
  closeSheet(true); buildRecipeStrip(); toast('Receita excluída');
};
$('rOk').onclick = () => closeSheet(true);

// editor de receita (estilo menu de câmera)
let edit = null;
function openEditor(r, asCopy) {
  const film = r?.spec?.film ?? (state.look || 'none');
  edit = { spec: { ...blankSpec(film), ...(r?.spec || {}) }, id: r && !r.classic && !asCopy ? r.id : null };
  $('eName').value = r ? (asCopy ? `${r.name} (minha)` : r.name) : '';
  $('eName').placeholder = `Receita ${userRecipes.length + 1}`;
  openSheet('recEditor');
  $('dock').classList.add('tall');
  buildEditor(); applyEdit();
}
function applyEdit() {
  state = withDefaults({ ...specToState(edit.spec), ...keepNow(), recipe: edit.id, seed: state.seed, leakSeed: state.leakSeed });
  draw();
}
function buildEditor() {
  const box = $('eList'); box.innerHTML = '';
  const base = blankSpec(edit.spec.film);
  for (const f of RECIPE_FIELDS) {
    if (f.group) { const g = document.createElement('div'); g.className = 'grp'; g.textContent = f.group; box.append(g); }
    const row = document.createElement('div'); row.className = 'frow';
    const lab = document.createElement('span'); lab.textContent = f.n; row.append(lab);
    if (f.type === 'film') {
      const sel = document.createElement('select');
      for (const it of lookItems()) { const o = document.createElement('option'); o.value = it.id; o.textContent = it.name; sel.append(o); }
      sel.value = edit.spec.film;
      sel.onchange = () => { edit.spec.film = sel.value; applyEdit(); };
      row.append(sel);
    } else {
      const minus = document.createElement('button'), out = document.createElement('output'), plus = document.createElement('button');
      minus.className = plus.className = 'st'; minus.textContent = '−'; plus.textContent = '+';
      minus.setAttribute('aria-label', `${f.n}: menos`); plus.setAttribute('aria-label', `${f.n}: mais`);
      const lo = f.opts ? 0 : f.min, hiV = f.opts ? f.opts.length - 1 : f.max, st = f.opts ? 1 : f.step;
      const show = () => { out.textContent = fmtField(f, edit.spec[f.k]); out.classList.toggle('chg', edit.spec[f.k] !== base[f.k]); };
      const step = (d) => {
        const v = clamp(Math.round((edit.spec[f.k] + d * st) / st) * st, lo, hiV);
        edit.spec[f.k] = Math.round(v * 1000) / 1000; show(); applyEdit();
      };
      minus.onclick = () => step(-1); plus.onclick = () => step(1);
      out.ondblclick = () => { edit.spec[f.k] = base[f.k]; show(); applyEdit(); };
      show(); row.append(minus, out, plus);
    }
    box.append(row);
  }
}
$('eOk').onclick = () => {
  const name = $('eName').value.trim() || $('eName').placeholder;
  const rec = { id: edit.id || 'u' + Date.now().toString(36), name, spec: { ...edit.spec } };
  const i = userRecipes.findIndex((x) => x.id === rec.id);
  if (i >= 0) userRecipes[i] = { ...userRecipes[i], ...rec }; else userRecipes.push(rec);
  saveUserRecipes();
  state.recipe = rec.id;
  closeSheet(true); rfilter = 'mine'; buildRecipeStrip(); toast(`Receita “${name}” salva`);
};
$('eCancel').onclick = () => closeSheet(false);
$('recNew').onclick = () => openEditor(null, false);
$('recSaveCur').onclick = () => {
  const name = (prompt('Nome da receita', `Receita ${userRecipes.length + 1}`) || '').trim();
  if (!name) return;
  const s = JSON.parse(JSON.stringify(state)); for (const k of [...KEEP_KEYS, 'recipe']) delete s[k];
  const rec = { id: 'u' + Date.now().toString(36), name, s };
  userRecipes.push(rec); saveUserRecipes();
  state.recipe = rec.id; commit(); rfilter = 'mine'; buildRecipeStrip(); toast(`Receita “${name}” salva com todos os ajustes`);
};

// ------------------------------------------------------------ folhas especiais: cor (HSL), curvas, luz, data
function openSpecial(s) {
  if (s === 'hsl') { syncHsl(); openSheet('hslSheet'); }
  if (s === 'curve') { openSheet('curveSheet'); drawCurve(); }
  if (s === 'leak') { syncLeak(); openSheet('leakSheet'); }
  if (s === 'date') { openSheet('dateSheet'); if (!state.date) { state.date = true; draw(); } syncDate(); }
  if (s === 'dust') { openSheet('dustSheet'); syncDust(); }
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
$('uRange').addEventListener('input', () => {
  let v = +$('uRange').value; if (Math.abs(v) <= 2) { v = 0; $('uRange').value = 0; }
  state.dust = v / 100; syncDust(); draw();
});
$('uRange').addEventListener('dblclick', () => { state.dust = 0; syncDust(); draw(); });
$('uSeed').onclick = () => { state.dustSeed = (state.dustSeed + 1 + Math.floor(Math.random() * 97)) % 997; if (!state.dust) state.dust = 0.5; syncDust(); draw(); };
$('uOk').onclick = () => closeSheet(true);
$('uCancel').onclick = () => closeSheet(false);
$('dCancel').onclick = () => closeSheet(false);

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
  const geoSheet = !!(photo && openSheetId === 'sliderSheet' && curTool?.geo);
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
  syncFilms(); syncRecipes(); markTools();
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
    await deliver([new File([blob], `${photo.name}_revela.jpg`, { type: 'image/jpeg' })]);
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
      out.push(new File([blob], nm + '_revela.jpg', { type: 'image/jpeg' }));
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
    state.look = id; state.mix = 1; state.recipe = null; setMode('films'); buildStrip(); draw(); commit();
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

if (preview) { await loadLuts(); buildStrip(); buildRecipeStrip(); syncUI(); updUndo(); }
