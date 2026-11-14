// Revela novo: filmes com a física do filme. Interface enxuta: Filmes, Ajustes, Analógico.
import { Render } from './render.js';
import { decodeFile, isImageFile } from '../core.js';
import { icon } from '../icons.js';

const $ = (id) => document.getElementById(id);
const tela = $('tela');

const CATS = [
  { id: 'negativo', n: 'Negativo' }, { id: 'cromo', n: 'Cromo' }, { id: 'pb', n: 'P&B' },
  { id: 'instantaneo', n: 'Instantâneo' }, { id: 'vencido', n: 'Vencido' },
];

// ------------------------------------------------------------ estado da edição
const PADRAO = {
  filme: null, intensidade: 1, exposicao: 0, cenaTemp: 0, cenaMatiz: 0, labTemp: 0, labMatiz: 0,
  grao: 0, graoTamanho: 1, halacao: 0, caraterFilme: 1, semente: 0.37,
};
let s = { ...PADRAO };
let foto = null;          // { bitmap, nome }
let filmes = [];          // pacotes carregados { meta, data }
let catAtual = 'negativo';

// ------------------------------------------------------------ renderizadores (tela e miniaturas)
let R, Rmini;
try {
  R = new Render(tela);
  Rmini = new Render(document.createElement('canvas'), { preserve: true });
} catch (e) {
  $('vazio').innerHTML = `<h1>REVELA</h1><p>Não consegui iniciar a placa de vídeo deste aparelho.<br><small>${e.message}</small></p>`;
  throw e;
}

// ------------------------------------------------------------ ícones
for (const [id, n] of [['bAbrir', 'open'], ['bDesfazer', 'undo'], ['bRefazer', 'redo'], ['bComparar', 'compare']]) $(id).innerHTML = icon(n);

// ------------------------------------------------------------ filmes
async function carregaFilmes() {
  const ids = await (await fetch('filmes/indice.json')).json();
  filmes = await Promise.all(ids.map(async (id) => {
    const [meta, buf] = await Promise.all([fetch(`filmes/${id}.json`).then((r) => r.json()), fetch(`filmes/${id}.bin`).then((r) => r.arrayBuffer())]);
    return { meta, data: new Uint16Array(buf) };
  }));
}
const filmeAtual = () => filmes.find((f) => f.meta.id === s.filme) || null;

function montaCats() {
  const cats = CATS.filter((c) => filmes.some((f) => f.meta.cat === c.id));
  if (!cats.some((c) => c.id === catAtual)) catAtual = cats[0]?.id;
  $('cats').innerHTML = '';
  for (const c of cats) {
    const b = document.createElement('button'); b.textContent = c.n; b.className = c.id === catAtual ? 'on' : '';
    b.onclick = () => { catAtual = c.id; montaCats(); montaFaixa(); };
    $('cats').append(b);
  }
}

function montaFaixa() {
  const fx = $('faixa'); fx.innerHTML = '';
  const item = (id, nome, desenha) => {
    const b = document.createElement('button'); b.className = 'film' + ((s.filme ?? 'none') === id ? ' on' : '');
    const c = document.createElement('canvas'); c.width = c.height = 148;
    if (foto && desenha) desenha(c); else { c.className = 'ph'; }
    b.append(c); const n = document.createElement('span'); n.textContent = nome; b.append(n);
    b.onclick = () => escolheFilme(id === 'none' ? null : id);
    fx.append(b);
  };
  item('none', 'Digital', (c) => miniatura(c, null));
  for (const f of filmes.filter((x) => x.meta.cat === catAtual)) item(f.meta.id, f.meta.nome, (c) => miniatura(c, f));
  atualizaNota();
}

// miniatura: a foto atual com cada filme (como no RNI, a escolha é vendo o resultado)
let miniFonte = null;
function miniatura(c, f) {
  if (!miniFonte) return;
  Rmini.setFilm(f);
  const st = { ...s, filme: f?.meta.id ?? null, intensidade: 1, grao: 0, halacao: 0, exposicao: 0 };
  Rmini.draw(st, miniFonte.width, miniFonte.height, 600);
  const g = c.getContext('2d'), k = Math.min(miniFonte.width, miniFonte.height);
  g.drawImage(Rmini.canvas, (miniFonte.width - k) / 2, (miniFonte.height - k) / 2, k, k, 0, 0, c.width, c.height);
}

function atualizaNota() {
  const f = filmeAtual();
  $('nota').textContent = f ? `${f.meta.nota} · inspirado no ${f.meta.inspirado}` : 'Sem filme: a foto como saiu da câmera.';
  $('cIntensidade').style.display = f ? '' : 'none';
}

function escolheFilme(id) {
  if (s.filme === id) return;
  s.filme = id;
  const f = filmeAtual();
  const a = f?.meta.analogico || {};
  s.grao = a.grao ?? 0; s.graoTamanho = a.grao_tamanho ?? 1; s.halacao = a.halacao ?? 0;   // o caráter do filme vem junto
  R.setFilm(f); montaFaixa(); sincroniza(); desenha(); memoriza();
}

// ------------------------------------------------------------ controles
const CTL = {
  intensidade: { n: 'Intensidade do filme', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  exposicao: { n: 'Exposição do negativo', min: -3, max: 3, passo: 0.05, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(1) },
  cenaTemp: { n: 'Temperatura', min: -1, max: 1, passo: 0.01, fmt: sinal },
  cenaMatiz: { n: 'Matiz', min: -1, max: 1, passo: 0.01, fmt: sinal },
  labTemp: { n: 'Temperatura', min: -1, max: 1, passo: 0.01, fmt: sinal },
  labMatiz: { n: 'Matiz', min: -1, max: 1, passo: 0.01, fmt: sinal },
  grao: { n: 'Grão', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  graoTamanho: { n: 'Tamanho do grão', min: 0.5, max: 2.5, passo: 0.05, fmt: (v) => v.toFixed(2) },
  halacao: { n: 'Halação', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  caraterFilme: { n: 'Nitidez do filme', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
};
function sinal(v) { const x = Math.round(v * 100); return (x > 0 ? '+' : '') + x; }

function controle(k, pai) {
  const d = CTL[k], w = document.createElement('div'); w.className = 'ctl';
  w.innerHTML = `<label for="r_${k}">${d.n}</label><output id="o_${k}"></output><input type="range" id="r_${k}" min="${d.min}" max="${d.max}" step="${d.passo}">`;
  pai.append(w);
  const r = w.querySelector('input');
  r.addEventListener('input', () => { s[k] = +r.value; $('o_' + k).textContent = d.fmt(s[k]); desenha(); });
  r.addEventListener('change', memoriza);
  r.addEventListener('dblclick', () => { s[k] = PADRAO[k] ?? 0; if (k === 'grao' || k === 'halacao') { const a = filmeAtual()?.meta.analogico || {}; s[k] = (k === 'grao' ? a.grao : a.halacao) ?? 0; } sincroniza(); desenha(); memoriza(); });
}
function secao(pai, t, nota) { const e = document.createElement('div'); e.className = 'sec'; e.textContent = t; if (nota) e.title = nota; pai.append(e); }

$('cIntensidade').className = '';
controle('intensidade', $('cIntensidade'));
secao($('p-ajustes'), 'Na câmera', 'Antes do filme: a luz que chega ao negativo');
controle('exposicao', $('p-ajustes'));
controle('cenaTemp', $('p-ajustes')); controle('cenaMatiz', $('p-ajustes'));
secao($('p-ajustes'), 'No laboratório', 'Depois do filme: o equilíbrio feito no scan');
controle('labTemp', $('p-ajustes')); controle('labMatiz', $('p-ajustes'));
secao($('p-analogico'), 'Do filme');
controle('grao', $('p-analogico')); controle('graoTamanho', $('p-analogico'));
controle('halacao', $('p-analogico')); controle('caraterFilme', $('p-analogico'));

function sincroniza() {
  for (const k of Object.keys(CTL)) { const r = $('r_' + k); if (r) { r.value = s[k]; $('o_' + k).textContent = CTL[k].fmt(s[k]); } }
}

document.querySelectorAll('.abas button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.abas button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.pag').forEach((p) => p.classList.toggle('on', p.id === 'p-' + b.dataset.p));
});

// ------------------------------------------------------------ desfazer / refazer
let hist = [], hi = -1;
function memoriza() {
  const j = JSON.stringify(s);
  if (hist[hi] === j) return;
  hist = hist.slice(0, hi + 1); hist.push(j); hi = hist.length - 1; botoes();
}
function volta(n) {
  if (hi + n < 0 || hi + n >= hist.length) return;
  hi += n; const ant = s.filme; s = JSON.parse(hist[hi]);
  if (s.filme !== ant) { R.setFilm(filmeAtual()); montaFaixa(); }
  sincroniza(); atualizaNota(); desenha(); botoes();
}
function botoes() { $('bDesfazer').disabled = hi <= 0; $('bRefazer').disabled = hi >= hist.length - 1; }
$('bDesfazer').onclick = () => volta(-1); $('bRefazer').onclick = () => volta(1);

// ------------------------------------------------------------ desenho na tela
let pedido = 0, original = false;
function desenha() {
  if (!foto || pedido) return;
  pedido = requestAnimationFrame(() => {
    pedido = 0;
    const box = $('palco').getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const k = Math.min((box.width - 28) / R.w, (box.height - 18) / R.h);   // tamanho na tela (CSS)
    const px = Math.min(k * dpr, 1);                                         // pixels de verdade: nunca acima da foto carregada
    const w = Math.max(1, Math.round(R.w * px)), h = Math.max(1, Math.round(R.h * px));
    R.draw(s, w, h, Math.max(foto.bitmap.width, foto.bitmap.height), original);
    tela.style.width = Math.floor(R.w * k) + 'px'; tela.style.height = Math.floor(R.h * k) + 'px';
  });
}
new ResizeObserver(desenha).observe($('palco'));

// comparar: segurar o botão (ou a foto) mostra a original
const segura = (el) => {
  const on = (e) => { if (!foto) return; e.preventDefault(); original = true; $('selo').style.display = 'block'; desenha(); };
  const off = () => { if (!original) return; original = false; $('selo').style.display = 'none'; desenha(); };
  el.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, off);
};
segura($('bComparar')); segura(tela);

// ------------------------------------------------------------ abrir foto
const reduz = (bmp, lado) => {
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  if (k === 1) return bmp;
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c;
};
$('bAbrir').onclick = $('bAbrir2').onclick = () => $('arquivo').click();
$('arquivo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) abre(f);
});
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => { e.preventDefault(); const f = [...e.dataTransfer.files].find(isImageFile); if (f) abre(f); });

async function abre(file) {
  aviso('Abrindo…');
  try {
    const { bitmap, note } = await decodeFile(file);
    foto = { bitmap, nome: file.name.replace(/\.[^.]+$/, '') };
    R.setImage(reduz(bitmap, Math.min(R.maxTex, 2400)));
    miniFonte = reduz(bitmap, 300); Rmini.setImage(miniFonte);
    s.semente = Math.random();
    tela.style.display = 'block'; $('vazio').style.display = 'none';
    for (const id of ['bComparar', 'bExportar']) $(id).disabled = false;
    montaFaixa(); desenha(); hist = []; hi = -1; memoriza();
    aviso(note || '');
  } catch (err) { console.error(err); aviso(err.message || 'Não consegui abrir essa foto.'); }
}

// ------------------------------------------------------------ exportar em tamanho real
$('bExportar').onclick = async () => {
  if (!foto) return;
  aviso('Revelando em tamanho real…');
  try {
    const c = document.createElement('canvas'), E = new Render(c, { preserve: true });
    const src = reduz(foto.bitmap, Math.min(E.maxTex, 8192));
    E.setImage(src); E.setFilm(filmeAtual());
    E.draw(s, src.width, src.height, Math.max(foto.bitmap.width, foto.bitmap.height));
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
    E.gl.getExtension('WEBGL_lose_context')?.loseContext();
    const nome = `${foto.nome}_revela${s.filme ? '_' + s.filme : ''}.jpg`;
    const arq = new File([blob], nome, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [arq] }) && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ files: [arq] }); aviso(''); return; } catch { /* cancelado: baixa */ }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    aviso(`Foto exportada (${src.width}×${src.height})`);
  } catch (err) { console.error(err); aviso('Falha ao exportar: ' + err.message); }
};

// ------------------------------------------------------------ aviso
let tAviso = 0;
function aviso(t) {
  const a = $('aviso'); a.textContent = t; a.style.opacity = t ? 1 : 0;
  clearTimeout(tAviso); if (t) tAviso = setTimeout(() => (a.style.opacity = 0), 2600);
}

// ------------------------------------------------------------ início
carregaFilmes().then(() => {
  montaCats(); montaFaixa(); sincroniza();
  escolheFilme(filmes[0]?.meta.id ?? null);
}).catch((e) => { console.error(e); aviso('Não consegui carregar os filmes.'); });
