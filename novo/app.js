// Revela novo: filmes com a física do filme. Interface enxuta: Filmes, Ajustes, Analógico.
import { Render, quadro } from './render.js';
import { decodeFile, isImageFile } from '../core.js';
import { icon } from '../icons.js';

const $ = (id) => document.getElementById(id);
const tela = $('tela');

// laboratório: a máquina que escaneia o negativo (pesquisa/laboratorios.md). Cada filme traz uma tabela por laboratório.
const LABS = [
  { id: 'neutro', n: 'Neutro', nota: 'Inversão ideal: o cinza fica cinza em qualquer luz' },
  { id: 'frontier', n: 'Frontier', nota: 'Inspirado no Fuji Frontier: sombras ciano, verdes frios, luzes douradas, mais contraste' },
];

// filtro de cor na lente (só nos filmes P&B; fatores conferidos com a ficha do Tri-X)
const FILTROS = [
  { id: 'nenhum', n: 'Sem', nota: 'Como o filme enxerga: azul claro, vermelho e pele mais escuros' },
  { id: 'amarelo', n: 'Amarelo', nota: 'Céu um pouco mais escuro, nuvens destacadas (o clássico de paisagem)' },
  { id: 'laranja', n: 'Laranja', nota: 'Céu escuro, pele mais lisa e clara' },
  { id: 'vermelho', n: 'Vermelho', nota: 'Céu quase preto, contraste dramático; pele muito clara' },
  { id: 'verde', n: 'Verde', nota: 'Pele e lábios mais escuros, folhagem clara (o da receita Lindbergh)' },
];

// luz vazada: de onde a luz entrou na câmera (do app publicado, core.js LEAKS)
const LUZES = [
  { id: '0', n: 'Tampa', nota: 'Luz pela vedação da tampa: faixa laranja entrando pela borda do filme' },
  { id: '1', n: 'Dobradiça', nota: 'Mancha forte numa lateral, com o centro queimado' },
  { id: '2', n: 'Início', nota: 'A primeira foto do rolo: parte da imagem queimada' },
  { id: '3', n: 'Entre fotos', nota: 'Faixa estreita perto da divisa entre duas fotos' },
  { id: '4', n: 'Frontal', nota: 'Luz pela frente da câmera: véu frio e macio' },
  { id: '5', n: 'Raios', nota: 'Furinho na vedação: feixes saindo de um ponto da borda' },
];

const CATS = [
  { id: 'negativo', n: 'Negativo' }, { id: 'cromo', n: 'Cromo' }, { id: 'pb', n: 'P&B' },
  { id: 'instantaneo', n: 'Instantâneo' }, { id: 'vencido', n: 'Vencido' },
];

// ------------------------------------------------------------ estado da edição
const PADRAO = {
  filme: null, intensidade: 1, exposicao: 0, lab: 'neutro', filtro: 'nenhum', labAuto: 1, rosto: null, separacao: 0.5, rostoTam: 1, poeira: 0, riscos: 0, luzVazada: 0, luzTipo: '0', sorteLuz: 3, moldura: 0, sorte: 7, cenaTemp: 0, cenaMatiz: 0, labTemp: 0, labMatiz: 0,
  grao: 0, graoTamanho: 1, halacao: 0, caraterFilme: 1, semente: 0.37,
};
let s = { ...PADRAO };
let marcando = false;   // esperando o toque no rosto (retrato)
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

// funciona sem internet e instala na tela do celular (no APK o próprio app já guarda tudo)
if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('sw.js').catch(() => {});

// ------------------------------------------------------------ ícones
for (const [id, n] of [['bAbrir', 'open'], ['bDesfazer', 'undo'], ['bRefazer', 'redo'], ['bComparar', 'compare']]) $(id).innerHTML = icon(n);
// várias fotos: duas fotos empilhadas
$('bLote').innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="3" width="14" height="14" rx="2"/><path d="M17 21H5a2 2 0 0 1-2-2V7"/></svg>';

// ------------------------------------------------------------ filmes
async function carregaFilmes() {
  const ids = await (await fetch('filmes/indice.json')).json();
  filmes = await Promise.all(ids.map(async (id) => {
    const meta = await fetch(`filmes/${id}.json`).then((r) => r.json());
    const labs = {};
    // variantes: um laboratório por tabela (colorido) ou um filtro de lente por tabela (P&B)
    const vars = meta.filtros ? meta.filtros : (meta.labs || ['neutro']);
    const base = meta.filtros ? 'nenhum' : 'neutro';
    await Promise.all(vars.map(async (v) => {
      labs[v] = new Uint16Array(await fetch(`filmes/${id}${v === base ? '' : '.' + v}.bin`).then((r) => r.arrayBuffer()));
    }));
    // data: a tabela da variante escolhida agora
    return { meta, labs, get data() { return meta.filtros ? (labs[s.filtro] || labs.nenhum) : (labs[s.lab] || labs.neutro); } };
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

// rolar a faixa de filmes com o mouse (roda e arrastar), além do dedo
{
  const fx = $('faixa'); let x0 = null, s0 = 0, moveu = false;
  fx.addEventListener('wheel', (e) => { if (fx.scrollWidth > fx.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { fx.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  fx.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { x0 = e.clientX; s0 = fx.scrollLeft; moveu = false; } });
  addEventListener('pointermove', (e) => { if (x0 !== null) { const d = e.clientX - x0; if (Math.abs(d) > 4) moveu = true; fx.scrollLeft = s0 - d; } });
  addEventListener('pointerup', () => { x0 = null; });
  fx.addEventListener('click', (e) => { if (moveu) { e.stopPropagation(); e.preventDefault(); moveu = false; } }, true);   // arrastar não escolhe filme
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
  for (const f of filmes) item(f.meta.id, f.meta.nome, (c) => miniatura(c, f));
  atualizaNota();
}

// miniatura: a foto atual com cada filme (como no RNI, a escolha é vendo o resultado)
let miniFonte = null;
function miniatura(c, f) {
  if (!miniFonte) return;
  Rmini.setFilm(f);
  const st = { ...s, filme: f?.meta.id ?? null, intensidade: 1, grao: 0, halacao: 0, exposicao: 0, poeira: 0, riscos: 0, luzVazada: 0, moldura: 0 };
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
  exposicao: { n: 'Luz', min: -3, max: 3, passo: 0.05, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(1) },
  cenaTemp: { n: 'Calor', min: -1, max: 1, passo: 0.01, fmt: sinal },
  cenaMatiz: { n: 'Matiz', min: -1, max: 1, passo: 0.01, fmt: sinal },
  labTemp: { n: 'Temperatura', min: -1, max: 1, passo: 0.01, fmt: sinal },
  labMatiz: { n: 'Matiz', min: -1, max: 1, passo: 0.01, fmt: sinal },
  grao: { n: 'Grão', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  graoTamanho: { n: 'Tamanho do grão', min: 0.5, max: 2.5, passo: 0.05, fmt: (v) => v.toFixed(2) },
  halacao: { n: 'Halação', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  poeira: { n: 'Poeira', min: -1, max: 1, passo: 0.01, fmt: (v) => (v === 0 ? '0' : (v > 0 ? 'branca ' : 'preta ') + Math.round(Math.abs(v) * 100)) },   // como no RNI: meio = sem, direita = branca, esquerda = preta
  riscos: { n: 'Riscos', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  luzVazada: { n: 'Luz vazada', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  separacao: { n: 'Separação do rosto', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) + (v < 0.2 ? ' · suave' : v > 0.8 ? ' · forte' : '') },
  rostoTam: { n: 'Tamanho do rosto', min: 0.5, max: 2, passo: 0.05, fmt: (v) => v.toFixed(2) },
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
// chave liga/desliga (valor 1 ou 0 no estado)
function chave(k, nome, nota, pai) {
  const w = document.createElement('label'); w.className = 'chave';
  w.innerHTML = `<span><b>${nome}</b><small>${nota}</small></span><input type="checkbox" id="c_${k}"><i></i>`;
  pai.append(w);
  w.querySelector('input').addEventListener('change', (e) => { s[k] = e.target.checked ? 1 : 0; desenha(); memoriza(); });
}
// escolha entre opções (botões lado a lado)
function escolha(k, ops, pai, titulo) {
  const w = document.createElement('div'); w.className = 'escolha'; w.id = 'e_' + k;
  w.innerHTML = (titulo ? `<label>${titulo}</label>` : '') + '<div></div><small></small>'; pai.append(w);
  for (const o of ops) {
    const b = document.createElement('button'); b.textContent = o.n; b.dataset.v = o.id;
    b.onclick = () => { if (s[k] === o.id) return; s[k] = o.id; aoMudar(k); sincroniza(); desenha(); memoriza(); };
    w.querySelector('div').append(b);
  }
}
function aoMudar(k) { if (k === 'lab' || k === 'filtro') { R.setFilm(filmeAtual()); montaFaixa(); } }
function secao(pai, t, nota) { const e = document.createElement('div'); e.className = 'sec'; e.textContent = t; if (nota) e.title = nota; pai.append(e); }

$('cIntensidade').className = '';
controle('intensidade', $('cIntensidade'));
// tela enxuta (17/11/2026): Luz, Calor e Matiz; o retrato só no Silver Portrait. O laboratório e o filtro já vêm em cada filme.
controle('exposicao', $('p-ajustes'));
controle('cenaTemp', $('p-ajustes')); controle('cenaMatiz', $('p-ajustes'));
const retrato = document.createElement('div'); retrato.id = 'g_retrato'; $('p-ajustes').prepend(retrato);
secao(retrato, 'Retrato', 'Destaque do rosto, como na ampliação com máscara');
{ const w = document.createElement('div'); w.className = 'escolha';
  w.innerHTML = '<div><button id="bRosto">Marcar o rosto</button></div><small id="nRosto"></small>'; retrato.append(w); }
controle('separacao', retrato); controle('rostoTam', retrato);
controle('grao', $('p-analogico')); controle('graoTamanho', $('p-analogico'));
controle('halacao', $('p-analogico'));
// tempo: cada efeito com a sua intensidade e o seu dado (sortear outra variação só daquele efeito)
const DADO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/></svg>';
function dado(k, nome, sorteia) {
  const c = $('r_' + k).parentElement, b = document.createElement('button');
  b.className = 'dado'; b.id = 'd_' + k; b.title = `Sortear outra ${nome}`; b.setAttribute('aria-label', `Sortear outra ${nome}`); b.innerHTML = DADO;
  c.style.gridTemplateColumns = '1fr auto auto'; c.insertBefore(b, $('o_' + k));
  b.onclick = () => { sorteia(); sincroniza(); desenha(); memoriza(); };
}
const novo = () => Math.floor(Math.random() * 1000) + 1;
dado('grao', 'textura de grão', () => { s.semente = Math.random(); if (!s.grao) s.grao = filmeAtual()?.meta.analogico?.grao || 0.3; });
secao($('p-analogico'), 'Tempo');
controle('luzVazada', $('p-analogico'));
dado('luzVazada', 'luz vazada', () => { s.sorteLuz = novo(); if (!s.luzVazada) s.luzVazada = 0.5; });
escolha('luzTipo', LUZES, $('p-analogico'));
controle('poeira', $('p-analogico'));
dado('poeira', 'poeira', () => { s.sorte = novo(); if (!s.poeira) s.poeira = 0.5; });
// (moldura do filme saiu a pedido do usuário: o trabalho é sobre a imagem; quadro() continua no render.js)

function sincroniza() {
  for (const k of Object.keys(CTL)) { const r = $('r_' + k); if (r) { r.value = s[k]; $('o_' + k).textContent = CTL[k].fmt(s[k]); } }
  const c = $('c_labAuto'); if (c) c.checked = !!s.labAuto;
  if ($('c_moldura')) $('c_moldura').checked = !!s.moldura;
  for (const [k, ops] of [['lab', LABS], ['filtro', FILTROS], ['luzTipo', LUZES]]) {
    const e = $('e_' + k); if (!e) continue;
    e.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === s[k]));
    e.querySelector('small').textContent = ops.find((l) => l.id === s[k])?.nota || '';
  }
  // o filtro só existe no P&B; o laboratório (Frontier) só nos coloridos que têm a tabela
  const f = filmeAtual();
  $('g_retrato').style.display = f?.meta.retrato ? '' : 'none';
  // P&B: temperatura e matiz do laboratório não existem (o scan é cinza)
  for (const k of ['labTemp', 'labMatiz']) { const r = $('r_' + k); if (r) r.parentElement.style.display = f?.meta.cat === 'pb' ? 'none' : ''; }
  if ($('c_labAuto')) $('c_labAuto').closest('.chave').style.display = f?.meta.cat === 'pb' ? 'none' : '';
  $('nRosto').textContent = marcando ? 'Desenhe em volta do rosto (ou toque no centro dele)' : s.rosto ? 'Rosto marcado. Separação: 0 = suave, 50 = padrão, 100 = forte' : 'Destaque o rosto como na ampliação com máscara: toque em "Marcar o rosto" e desenhe em volta dele';
  $('bRosto').classList.toggle('on', marcando);
  $('bRosto').textContent = s.rosto && !marcando ? 'Marcar de novo' : 'Marcar o rosto';
  anel();
  if ($('e_filtro')) $('e_filtro').style.display = f?.meta.filtros ? '' : 'none';
  if ($('e_lab')) $('e_lab').style.display = !f || (f.meta.labs || []).length > 1 ? '' : 'none';
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
  hi += n; const ant = s.filme, antLab = s.lab, antF = s.filtro; s = { ...PADRAO, ...JSON.parse(hist[hi]) };
  if (s.filme !== ant || s.lab !== antLab || s.filtro !== antF) { R.setFilm(filmeAtual()); montaFaixa(); }
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
    const Q = quadro(original ? {} : s, R.w, R.h);                            // com a moldura, o quadro é maior que a foto
    const k = Math.min((box.width - 28) / Q.W, (box.height - 18) / Q.H);   // tamanho na tela (CSS)
    const px = Math.min(k * dpr * zoom.z, 1);                                // pixels de verdade (mais com zoom): nunca acima da foto carregada
    const w = Math.max(1, Math.round(R.w * px)), h = Math.max(1, Math.round(R.h * px));
    R.draw(original ? { ...s, moldura: 0 } : s, w, h, Math.max(foto.bitmap.width, foto.bitmap.height), original);
    tela.style.width = Math.floor(Q.W * k) + 'px'; tela.style.height = Math.floor(Q.H * k) + 'px';
    anel();
  });
}
new ResizeObserver(desenha).observe($('palco'));

// marcar o rosto: o próximo toque na foto define o centro do rosto (até a detecção automática chegar)
$('bRosto').onclick = () => { marcando = !marcando; sincroniza(); };
// marcar o rosto: arrastar o dedo em volta do rosto desenha a área (oval); um toque só marca o centro com o tamanho padrão
let risco = null;   // {x0, y0, x1, y1} em fração da foto, enquanto desenha
const fr = (e) => { const r = fotoRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
tela.addEventListener('pointerdown', (e) => {
  if (!marcando) return;
  e.preventDefault(); tela.setPointerCapture?.(e.pointerId);
  const [x, y] = fr(e); risco = { x0: x, y0: y, x1: x, y1: y }; anel();
});
tela.addEventListener('pointermove', (e) => { if (!risco) return; [risco.x1, risco.y1] = fr(e); anel(); });
const fimRisco = () => {
  if (!risco) return;
  const r = fotoRect(), w = Math.abs(risco.x1 - risco.x0) * r.width, h = Math.abs(risco.y1 - risco.y0) * r.height;
  if (Math.max(w, h) < 14) {   // toque: centro no ponto, tamanho padrão
    s.rosto = { x: risco.x0, y: risco.y0 };
  } else {                     // desenho: oval que cabe no retângulo arrastado
    s.rosto = { x: (risco.x0 + risco.x1) / 2, y: (risco.y0 + risco.y1) / 2, a: Math.abs(risco.x1 - risco.x0) / 2, b: Math.abs(risco.y1 - risco.y0) / 2 };
  }
  s.rostoTam = 1; risco = null; marcando = false; sincroniza(); desenha(); memoriza();
};
tela.addEventListener('pointerup', fimRisco); tela.addEventListener('pointercancel', fimRisco);
// tamanho do oval do rosto (em fração da foto): o desenhado, ou o padrão de um toque; × o controle "Tamanho do rosto"
function ovalRosto(ro, w, h, k = 1) {
  const m = Math.min(w, h);
  return { a: (ro.a ?? 0.16 * m / w) * k, b: (ro.b ?? 0.2 * m / h) * k };
}
// retângulo da FOTO na tela (sem a moldura do filme)
function fotoRect() {
  const t = tela.getBoundingClientRect(), j = R.janela || [0, 0, 1, 1];
  return { left: t.left + j[0] * t.width, top: t.top + j[1] * t.height, width: j[2] * t.width, height: j[3] * t.height };
}
function anel() {
  let a = $('anel');
  if (!a) { a = document.createElement('div'); a.id = 'anel'; $('palco').append(a); }
  const f = filmeAtual();
  const r = fotoRect(), p = $('palco').getBoundingClientRect();
  let o = null;
  if (risco) o = { x: (risco.x0 + risco.x1) / 2, y: (risco.y0 + risco.y1) / 2, a: Math.abs(risco.x1 - risco.x0) / 2, b: Math.abs(risco.y1 - risco.y0) / 2 };
  else if (foto && f?.meta.retrato && s.rosto && !original) o = { ...s.rosto, ...ovalRosto(s.rosto, r.width, r.height, s.rostoTam) };
  if (!o) { a.style.display = 'none'; return; }
  Object.assign(a.style, { display: 'block', left: (r.left - p.left + (o.x - o.a) * r.width) + 'px', top: (r.top - p.top + (o.y - o.b) * r.height) + 'px',
    width: 2 * o.a * r.width + 'px', height: 2 * o.b * r.height + 'px' });
}

// ------------------------------------------------------------ zoom: pinça com dois dedos (até 4×), um dedo arrasta, toque duplo volta
const zoom = { z: 1, tx: 0, ty: 0 };
const dedos = new Map();
let pinca = null, ultimoToque = 0;
function aplicaZoom() {
  const pr = $('palco').getBoundingClientRect(), w = tela.offsetWidth * zoom.z, h = tela.offsetHeight * zoom.z;
  const mx = Math.max(0, (w - pr.width) / 2 + 40), my = Math.max(0, (h - pr.height) / 2 + 40);   // não deixa a foto fugir da tela
  zoom.tx = Math.min(mx, Math.max(-mx, zoom.tx)); zoom.ty = Math.min(my, Math.max(-my, zoom.ty));
  if (zoom.z <= 1.001) { zoom.z = 1; zoom.tx = zoom.ty = 0; }
  tela.style.transform = zoom.z === 1 ? '' : `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.z})`;
  anel();
}
function zeraZoom() { zoom.z = 1; zoom.tx = zoom.ty = 0; aplicaZoom(); desenha(); }
const centro = () => { const r = tela.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
$('palco').addEventListener('pointerdown', (e) => {
  if (!foto || e.pointerType === 'mouse' && e.button !== 0) return;
  dedos.set(e.pointerId, [e.clientX, e.clientY]);
  if (dedos.size === 2 && !risco) {
    const [a, b] = [...dedos.values()];
    pinca = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom.z, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tx: zoom.tx, ty: zoom.ty, c: centro() };
    if (original) { original = false; $('selo').style.display = 'none'; desenha(); }   // pinça não é "ver a original"
  } else if (dedos.size === 1 && e.pointerType !== 'mouse') {
    const t = performance.now(); if (t - ultimoToque < 300 && zoom.z > 1 && !marcando) zeraZoom(); ultimoToque = t;
  }
});
addEventListener('pointermove', (e) => {
  if (!dedos.has(e.pointerId)) return;
  const ant = dedos.get(e.pointerId); dedos.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinca && dedos.size === 2) {
    const [a, b] = [...dedos.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const z = Math.min(4, Math.max(1, pinca.z * d / pinca.d)), k = z / pinca.z;
    // o ponto entre os dedos fica parado na foto
    zoom.z = z;
    zoom.tx = m[0] - (pinca.c[0] - pinca.tx) - (pinca.m[0] - pinca.c[0]) * k;
    zoom.ty = m[1] - (pinca.c[1] - pinca.ty) - (pinca.m[1] - pinca.c[1]) * k;
    aplicaZoom();
  } else if (dedos.size === 1 && zoom.z > 1 && !marcando && !risco) {
    zoom.tx += e.clientX - ant[0]; zoom.ty += e.clientY - ant[1]; aplicaZoom();
  }
});
const soltaDedo = (e) => {
  if (!dedos.delete(e.pointerId)) return;
  if (dedos.size < 2 && pinca) { pinca = null; desenha(); }   // redesenha na resolução do zoom
};
addEventListener('pointerup', soltaDedo); addEventListener('pointercancel', soltaDedo);
$('palco').addEventListener('wheel', (e) => {   // computador: roda do mouse (ou pinça do trackpad) também dá zoom
  if (!foto) return; e.preventDefault();
  const c = centro(), z0 = zoom.z, z = Math.min(4, Math.max(1, z0 * Math.exp(-e.deltaY * 0.0015))), k = z / z0;
  zoom.tx = e.clientX - (c[0] - zoom.tx) - (e.clientX - c[0]) * k; zoom.ty = e.clientY - (c[1] - zoom.ty) - (e.clientY - c[1]) * k;
  zoom.z = z; aplicaZoom(); clearTimeout(zoom.t); zoom.t = setTimeout(desenha, 120);
}, { passive: false });
$('palco').addEventListener('dblclick', () => { if (zoom.z > 1) zeraZoom(); });

// comparar: segurar o botão (ou a foto) mostra a original
const segura = (el) => {
  const on = (e) => { if (!foto || marcando || (el === tela && (zoom.z > 1 || dedos.size > 1))) return; e.preventDefault(); original = true; $('selo').style.display = 'block'; desenha(); };
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

// a edição tem algo além do padrão? (filme, ajustes, efeitos)
function editada() {
  const ign = new Set(['semente', 'sorte', 'sorteLuz', 'rosto']);
  return Object.keys(PADRAO).some((k) => !ign.has(k) && JSON.stringify(s[k]) !== JSON.stringify(PADRAO[k]));
}
function perguntaRepetir(anterior) {
  const q = $('pergunta');
  if (!anterior) { q.style.display = 'none'; return; }
  q.style.display = 'flex';
  $('pNao').onclick = () => { q.style.display = 'none'; };
  $('pSim').onclick = () => {
    q.style.display = 'none';
    s = { ...anterior, semente: s.semente, rosto: null };   // o rosto é de outra foto: marcar de novo
    R.setFilm(filmeAtual()); montaFaixa(); sincroniza(); atualizaNota(); desenha(); memoriza();
  };
}
async function abre(file) {
  aviso('Abrindo…');
  try {
    const { bitmap, note } = await decodeFile(file);
    const tinhaFoto = !!foto;   // na primeira foto não há edição anterior para repetir
    foto = { bitmap, nome: file.name.replace(/\.[^.]+$/, '') };
    R.setImage(reduz(bitmap, Math.min(R.maxTex, 2400)));
    miniFonte = reduz(bitmap, 300); Rmini.setImage(miniFonte);
    // a foto nova começa limpa; se a anterior foi editada, pergunta se quer repetir (nunca aplica sozinho)
    const anterior = tinhaFoto && editada() ? { ...s } : null;
    s = { ...PADRAO, semente: Math.random() }; marcando = false; R.setFilm(null); zoom.z = 1; zoom.tx = zoom.ty = 0; aplicaZoom();
    perguntaRepetir(anterior);
    tela.style.display = 'block'; $('vazio').style.display = 'none';
    for (const id of ['bComparar', 'bExportar', 'bLote']) $(id).disabled = false;
    montaFaixa(); sincroniza(); atualizaNota(); desenha(); hist = []; hi = -1; memoriza();
    aviso(note || '');
  } catch (err) { console.error(err); aviso(err.message || 'Não consegui abrir essa foto.'); }
}

// ------------------------------------------------------------ exportar em tamanho real
// app Android (APK, Capacitor): o WebView não baixa arquivos. Grava em Imagens/Revela (a Galeria encontra);
// sem acesso, abre o compartilhar do Android. Mesmo caminho do app publicado (app.js, deliverNative).
async function salvaNoAparelho(arq) {
  const C = window.Capacitor, P = C.Plugins || {};
  const Filesystem = P.Filesystem || C.registerPlugin('Filesystem'), Share = P.Share || C.registerPlugin('Share');
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(arq); });
  try {
    await Filesystem.writeFile({ path: `Pictures/Revela/${arq.name}`, data, directory: 'EXTERNAL_STORAGE', recursive: true });
    aviso('Salvo em Imagens › Revela');
  } catch {
    const w = await Filesystem.writeFile({ path: arq.name, data, directory: 'CACHE' });
    try { await Share.share({ title: arq.name, files: [w.uri] }); aviso(''); } catch { aviso('Exportação cancelada'); }
  }
}

// revela uma foto em tamanho real com a edição st e devolve o arquivo JPEG
async function revela(E, bitmap, st, nome) {
  const src = reduz(bitmap, Math.min(E.maxTex, 8192));
  E.setImage(src); E.setFilm(filmeAtual());
  E.draw(st, src.width, src.height, Math.max(bitmap.width, bitmap.height));
  const blob = await new Promise((r) => E.canvas.toBlob(r, 'image/jpeg', 0.95));
  return new File([blob], `${nome}_revela${st.filme ? '_' + st.filme : ''}.jpg`, { type: 'image/jpeg' });
}
// entrega os arquivos: app Android grava em Imagens › Revela; celular abre o compartilhar; computador baixa
async function entrega(arqs) {
  if (window.Capacitor?.isNativePlatform?.()) { for (const a of arqs) await salvaNoAparelho(a); return; }
  if (navigator.canShare?.({ files: arqs }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: arqs }); return; } catch { /* cancelado: baixa */ }
  }
  for (const a of arqs) {
    const l = document.createElement('a'); l.href = URL.createObjectURL(a); l.download = a.name; l.click();
    setTimeout(() => URL.revokeObjectURL(l.href), 4000); await new Promise((r) => setTimeout(r, 350));
  }
}
$('bExportar').onclick = async () => {
  if (!foto) return;
  aviso('Revelando em tamanho real…');
  try {
    const c = document.createElement('canvas'), E = new Render(c, { preserve: true });
    const arq = await revela(E, foto.bitmap, s, foto.nome);
    const W = c.width, H = c.height;
    E.gl.getExtension('WEBGL_lose_context')?.loseContext();
    await entrega([arq]);
    aviso(`Foto exportada (${W}×${H})`);
  } catch (err) { console.error(err); aviso('Falha ao exportar: ' + err.message); }
};

// ------------------------------------------------------------ várias fotos (como no Lightroom: a mesma edição numa série)
$('bLote').onclick = () => $('lote').click();
$('lote').addEventListener('change', async (e) => {
  const fs = [...e.target.files].filter(isImageFile); e.target.value = '';
  if (!fs.length) return;
  const st = { ...s, rosto: null };   // o rosto marcado é desta foto; nas outras o retrato fica sem máscara
  const c = document.createElement('canvas'), E = new Render(c, { preserve: true }), arqs = [];
  try {
    for (let i = 0; i < fs.length; i++) {
      aviso(`Revelando ${i + 1} de ${fs.length}…`);
      const { bitmap } = await decodeFile(fs[i]);
      arqs.push(await revela(E, bitmap, { ...st, semente: Math.random() }, fs[i].name.replace(/\.[^.]+$/, '')));   // grão próprio em cada foto
      bitmap.close?.();
    }
    E.gl.getExtension('WEBGL_lose_context')?.loseContext();
    await entrega(arqs);
    aviso(`${arqs.length} fotos reveladas com esta edição`);
  } catch (err) { console.error(err); aviso('Falha ao revelar as fotos: ' + err.message); }
});

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
