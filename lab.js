import { buildLutData } from './looks.js';
import { FILMS, FILM_CATS, FILM_FILE, FILM_SRC, saveFilmLooks, clearFilmLooks } from './films.js';
import { Renderer } from './renderer.js';

const $ = (id) => document.getElementById(id);
const view = $('view');
const R = new Renderer(view);
const NEUTRAL = { mix: 1, exp: 0, con: 0, temp: 0, tint: 0, sat: 0, grain: 0, gsize: 1.6, fade: 0, halo: 0, vig: 0 };

// ------------------------------------------------------------ receitas
const clone = (o) => JSON.parse(JSON.stringify(o));
function norm(r) {
  return {
    id: r.id, name: r.name,
    wb: r.wb ?? [1, 1, 1], contrast: r.contrast ?? 0, pivot: r.pivot ?? 0.5,
    sat: r.sat ?? 1, satShadow: r.satShadow ?? 1, satHigh: r.satHigh ?? 1,
    gamma: r.gamma ?? [1, 1, 1],
    hues: (r.hues ?? []).map((z) => ({ at: z.at ?? 0, width: z.width ?? 40, shift: z.shift ?? 0, sat: z.sat ?? 1, val: z.val ?? 1 })),
    split: r.split ? clone(r.split) : { shadow: [0.5, 0.5, 0.5], high: [0.5, 0.5, 0.5], amt: 0 },
    black: r.black ?? [0, 0, 0], white: r.white ?? [1, 1, 1],
    bw: r.bw ?? null, _bw: r.bw ?? r._bw ?? [0.3, 0.59, 0.11], tone: r.tone ?? [1, 1, 1],
  };
}
const round = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(round) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v);
// look editado -> objeto "look" de films.js (sem campos de interface)
function toLook(l) {
  const o = {};
  for (const [k, v] of Object.entries(l)) if (!['id', 'name', '_bw', 'film'].includes(k) && v !== null) o[k] = round(v);
  if (!o.hues.length) delete o.hues;
  if (!o.split.amt) delete o.split;
  return o;
}
const filmLook = (f, look) => ({ ...norm({ id: f.id, name: f.code, ...clone(look) }), film: f });
let looks = FILMS.map((f) => filmLook(f, f.look));
let cur = 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isEdited = (L) => !same(toLook(L), toLook(filmLook(L.film, FILM_FILE[L.id])));

// ------------------------------------------------------------ imagem
let photo;
function testChart() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
  const x = c.getContext('2d');
  for (let i = 0; i < 1200; i++) { x.fillStyle = `hsl(${i * 0.3},80%,50%)`; x.fillRect(i, 0, 1, 160); }
  for (let i = 0; i < 1200; i++) { const v = Math.round(i / 1199 * 255); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 160, 1, 100); }
  const g = x.createLinearGradient(0, 260, 0, 520); g.addColorStop(0, '#5d8fc8'); g.addColorStop(1, '#cfe0ee'); x.fillStyle = g; x.fillRect(0, 260, 600, 260);
  x.fillStyle = '#3f6b2c'; x.fillRect(0, 440, 600, 80); x.fillStyle = '#7d9b4a'; x.fillRect(0, 470, 600, 50);
  const skins = ['#f3d2bf', '#e6b597', '#c98d6a', '#a86b48', '#7a4b31', '#4e2f1f'];
  skins.forEach((s, i) => { x.fillStyle = s; x.fillRect(600 + (i % 3) * 200, 260 + Math.floor(i / 3) * 130, 200, 130); });
  const pal = ['#b33a3a', '#d9822b', '#e8c547', '#3a8f5c', '#2f7fa6', '#334c99', '#7a4fa0', '#c95b8f', '#202020', '#5a5a5a', '#a0a0a0', '#f2f2f2'];
  pal.forEach((p, i) => { x.fillStyle = p; x.fillRect(i * 100, 520, 100, 280); });
  return c;
}
function setPhoto(src) {
  const s = Math.min(1, 1600 / Math.max(src.width, src.height));
  let img = src;
  if (s < 1) { img = document.createElement('canvas'); img.width = Math.round(src.width * s); img.height = Math.round(src.height * s); img.getContext('2d').drawImage(src, 0, 0, img.width, img.height); }
  photo = { w: img.width, h: img.height };
  R.setImage(img, 'p');
  rebuild();
}
$('btnOpen').onclick = () => $('fileImg').click();
$('fileImg').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { setPhoto(await createImageBitmap(f, { imageOrientation: 'from-image' })); } catch { toast('Não consegui abrir essa imagem'); }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) setPhoto(await createImageBitmap(f, { imageOrientation: 'from-image' })); });

// ------------------------------------------------------------ render
let raf = 0, bypass = false;
function draw() {
  if (raf || !photo) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const st = $('stage'), dpr = Math.min(devicePixelRatio || 1, 2);
    const sc = Math.min(1, (st.clientWidth - 20) * dpr / photo.w, (st.clientHeight - 20) * dpr / photo.h);
    const w = Math.max(1, Math.round(photo.w * sc)), h = Math.max(1, Math.round(photo.h * sc));
    R.render(w, h, $('chkCh').checked ? { ...NEUTRAL, ...looks[cur].film.ch } : NEUTRAL, photo, bypass);
    view.style.width = w / dpr + 'px'; view.style.height = h / dpr + 'px';
  });
}
let lutRaf = 0;
function rebuild() {
  if (lutRaf) return;
  lutRaf = requestAnimationFrame(() => {
    lutRaf = 0;
    R.setLut(buildLutData(looks[cur], 25), 25);
    draw();
  });
}
addEventListener('resize', draw);
view.addEventListener('pointerdown', () => { bypass = true; $('badge').style.display = 'block'; draw(); });
addEventListener('pointerup', () => { if (bypass) { bypass = false; $('badge').style.display = 'none'; draw(); } });
view.addEventListener('contextmenu', (e) => e.preventDefault());

// ------------------------------------------------------------ salvar
let saveT;
function changed() {
  rebuild();
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const o = Object.fromEntries(looks.filter(isEdited).map((L) => [L.id, toLook(L)]));
    if (!saveFilmLooks(o)) toast('Não foi possível salvar neste navegador');
    fillSelect();
  }, 300);
}

// ------------------------------------------------------------ controles
const get = (o, p) => p.split('.').reduce((a, k) => a[k], o);
const set = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const RGB = ['R', 'G', 'B'];
const tri = (label, path, min, max, step = 0.005) => RGB.map((c, i) => [`${label} ${c}`, `${path}.${i}`, min, max, step]);

const SECTIONS = [
  { title: 'Curva', open: true, rows: [['Contraste', 'contrast', 0, 12, 0.1], ['Ponto médio', 'pivot', 0.3, 0.7], ...tri('Gama', 'gamma', 0.7, 1.3)] },
  { title: 'Balanço de branco', rows: tri('Ganho', 'wb', 0.8, 1.2) },
  { title: 'Saturação', color: true, rows: [['Geral', 'sat', 0, 1.8, 0.01], ['Sombras', 'satShadow', 0, 1.8, 0.01], ['Altas luzes', 'satHigh', 0, 1.8, 0.01]] },
  { title: 'Cores por matiz', color: true, zones: true },
  { title: 'Split toning', rows: [['Força', 'split.amt', 0, 0.8], ...tri('Sombras', 'split.shadow', 0.3, 0.7), ...tri('Altas', 'split.high', 0.3, 0.7)] },
  { title: 'Pretos e brancos', rows: [...tri('Preto', 'black', 0, 0.3, 0.002), ...tri('Branco', 'white', 0.6, 1, 0.002)] },
  { title: 'Preto & branco', bwSec: true, rows: [...tri('Filtro', 'bw', -0.5, 1.5, 0.01), ...tri('Tom', 'tone', 0.6, 1.3)] },
];

function slider(label, path, min, max, step, obj = looks[cur]) {
  const row = document.createElement('div'); row.className = 'row';
  const id = 'c_' + Math.random().toString(36).slice(2);
  row.innerHTML = `<label for="${id}">${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}"><output></output>`;
  const inp = row.querySelector('input'), out = row.querySelector('output');
  const v0 = get(obj, path);
  inp.value = v0; out.textContent = (+v0).toFixed(step >= 1 ? 0 : 2);
  inp.addEventListener('input', () => { set(obj, path, +inp.value); out.textContent = (+inp.value).toFixed(step >= 1 ? 0 : 2); changed(); });
  return row;
}

const openState = {};
function renderControls() {
  const L = looks[cur];
  $('filmRef').textContent = `inspirado no ${L.film.ref} · ${L.film.kind}`;
  const box = $('controls'); box.innerHTML = '';
  for (const s of SECTIONS) {
    const d = document.createElement('details');
    d.open = openState[s.title] ?? !!s.open;
    d.addEventListener('toggle', () => { openState[s.title] = d.open; });
    d.innerHTML = `<summary>${s.title}</summary>`;
    if (s.color && L.bw) { d.insertAdjacentHTML('beforeend', '<p class="hint">Sem efeito em looks P&amp;B.</p>'); }
    if (s.bwSec) {
      const lab = document.createElement('label'); lab.className = 'chk';
      lab.innerHTML = '<input type="checkbox"> Converter para preto e branco';
      const cb = lab.querySelector('input'); cb.checked = !!L.bw;
      cb.addEventListener('change', () => { if (cb.checked) L.bw = L._bw.slice(); else { L._bw = L.bw; L.bw = null; } renderControls(); changed(); });
      d.append(lab);
      if (!L.bw) { box.append(d); continue; }
    }
    for (const r of s.rows ?? []) d.append(slider(...r));
    if (s.zones) {
      L.hues.forEach((z, i) => {
        const zd = document.createElement('div'); zd.className = 'zone';
        zd.innerHTML = `<div class="zone-h"><span class="sw" style="background:hsl(${z.at},80%,50%)"></span>Zona ${i + 1}<button>Remover</button></div>`;
        zd.querySelector('button').onclick = () => { L.hues.splice(i, 1); renderControls(); changed(); };
        for (const r of [['Matiz alvo', 'at', 0, 360, 1], ['Largura', 'width', 10, 120, 1], ['Deslocar', 'shift', -60, 60, 1], ['Saturação', 'sat', 0, 2, 0.01], ['Brilho', 'val', 0.6, 1.4, 0.01]]) {
          const row = slider(...r, z);
          if (r[1] === 'at') row.querySelector('input').addEventListener('input', (e) => { zd.querySelector('.sw').style.background = `hsl(${e.target.value},80%,50%)`; });
          zd.append(row);
        }
        d.append(zd);
      });
      const add = document.createElement('button'); add.textContent = '+ Zona de cor';
      add.onclick = () => { L.hues.push({ at: 30, width: 40, shift: 0, sat: 1, val: 1 }); renderControls(); changed(); };
      d.append(add);
      d.insertAdjacentHTML('beforeend', '<p class="hint">0 vermelho · 30 laranja/pele · 60 amarelo · 120 verde · 180 ciano · 220 azul · 300 magenta</p>');
    }
    box.append(d);
  }
}

function fillSelect() {
  const sel = $('selLook');
  sel.innerHTML = FILM_CATS.filter((c) => c.id !== 'mine').map((c) => `<optgroup label="${c.n}">` +
    looks.map((l, i) => (l.film.cat === c.id ? `<option value="${i}">${l.name}${isEdited(l) ? ' •' : ''}</option>` : '')).join('') + '</optgroup>').join('');
  sel.value = cur;
}
$('selLook').addEventListener('change', (e) => { cur = +e.target.value; renderControls(); rebuild(); });
$('chkCh').addEventListener('change', draw);
$('btnReset').onclick = () => {
  const L = looks[cur];
  looks[cur] = filmLook(L.film, FILM_FILE[L.id]); renderControls(); changed(); toast('Edições deste filme desfeitas');
};
$('btnFactory').onclick = () => {
  if (!confirm('Apagar as edições de todos os filmes neste aparelho?')) return;
  clearFilmLooks(); looks = FILMS.map((f) => filmLook(f, FILM_FILE[f.id])); fillSelect(); renderControls(); rebuild(); toast('Filmes de fábrica restaurados');
};
$('btnExport').onclick = () => {
  // só o que difere do films.js entra no arquivo
  const o = {};
  for (const L of looks) { const lk = toLook(L); if (!same(lk, toLook(filmLook(L.film, FILM_SRC[L.id])))) o[L.id] = lk; }
  const txt = '// Ajustes de cor dos filmes feitos no Laboratório (lab.html → Exportar filmes).\n' +
    '// Cada entrada substitui o "look" do filme com o mesmo id em films.js. Vazio = usa o films.js como está.\n' +
    'export const FILM_LOOKS = ' + JSON.stringify(o, null, 2) + ';\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' })); a.download = 'film-looks.js'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`film-looks.js exportado (${Object.keys(o).length} filme${Object.keys(o).length === 1 ? '' : 's'} ajustado${Object.keys(o).length === 1 ? '' : 's'})`);
};

let tt;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); }

fillSelect(); renderControls(); setPhoto(testChart());
