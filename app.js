// Revela novo: filmes com a física do filme. Interface enxuta: Filmes, Ajustes, Analógico.
import { Render, TIPOS_GRAO, geometria, encaixa, dentro, quadroGirado, amostraCurva, curvaMexida, HSL0, CURVA0 } from './render.js';
import { decodeFile, isImageFile } from './core.js';
import { icon } from './icons.js';

const $ = (id) => document.getElementById(id);
const celular = () => !matchMedia('(min-width: 900px)').matches;
const tela = $('tela');


// luz vazada: de onde a luz entrou na câmera (do app publicado, core.js LEAKS)
const LUZES = [
  { id: '0', n: 'Tampa', nota: 'Luz pela vedação da tampa: faixa laranja entrando pela borda do filme' },
  { id: '1', n: 'Dobradiça', nota: 'Mancha forte numa lateral, com o centro queimado' },
  { id: '2', n: 'Início', nota: 'A primeira foto do rolo: parte da imagem queimada' },
  { id: '3', n: 'Entre fotos', nota: 'Faixa estreita perto da divisa entre duas fotos' },
  { id: '4', n: 'Frontal', nota: 'Luz pela frente da câmera: véu frio e macio' },
  { id: '6', n: 'Rolo aberto', nota: 'A tampa abriu: quase o quadro inteiro velado, com um canto quente' },
  { id: '7', n: 'Fresta', nota: 'Um risco de luz atravessando a foto, por um vão na porta da câmera' },
  { id: '8', n: 'Névoa quente', nota: 'Véu macio e quente entrando por um canto; tira o contraste' },
];

const CATS = [{ id: 'filmes', n: 'Filmes' }, { id: 'receitas', n: 'Receitas' }, { id: 'minhas', n: 'Minhas' }];

// receitas: um toque aplica filme + revelação + textura. Nomes clássicos (sem nomes de pessoas); a inspiração está
// em pesquisa/receitas.md. Tudo continua ajustável depois.
const RECEITAS = [
  { id: 'r_silver_puxado', g: 'Preto e branco', n: 'Silver 400 · Puxado', nota: 'P&B documental: puxado dois pontos, pretos densos, grão forte',
    s: { filme: 'silver400', puxar: 2, grao: 0.55, graoTamanho: 1.3 } },
  { id: 'r_silver_noturno', g: 'Preto e branco', n: 'Silver 400 · Noturno', nota: 'Rua à noite em P&B cru: puxado ao máximo, contraste duro, grão áspero e grosso',
    s: { filme: 'silver400', puxar: 3, exposicao: -0.3, grao: 0.8, graoTamanho: 1.7, graoTipo: 'aspero' } },
  { id: 'r_silver_epico', g: 'Preto e branco', n: 'Silver 400 · Épico', nota: 'P&B épico: céu queimado, entorno escuro, o assunto acende como na ampliação',
    s: { filme: 'silver400', puxar: 0.8, grao: 0.45, amplCeu: 0.7, pontos: [{ x: 0.5, y: 0.5, tam: 0.45, luz: 0.35, entorno: 0.5 }] } },
  { id: 'r_silver_retrato', g: 'Preto e branco', n: 'Silver Portrait · Grão', nota: 'Retrato P&B com grão aparente e contraste macio',
    s: { filme: 'silverportrait', puxar: 0.8, grao: 0.5, graoTamanho: 1.15 } },
  { id: 'r_portrait_claro', g: 'Cor', n: 'Portrait 160 · Claro', nota: 'Luz clara e etérea: superexposto, pastel, pele suave',
    s: { filme: 'portrait160', exposicao: 0.5, puxar: -0.5, grao: 0.18 } },
  { id: 'r_portrait_puxado', g: 'Cor', n: 'Portrait 400 · Puxado', nota: 'Intimidade de flash e noite: cor quente, grão aparente',
    s: { filme: 'portrait400', puxar: 1.5, grao: 0.45, cenaTemp: 0.1 } },
  { id: 'r_chrome_rua', g: 'Cor', n: 'Chrome 64 · Rua', nota: 'Rua em cor: luz dura, vermelhos quentes, sombras que contam história',
    s: { filme: 'chrome64', puxar: 0.5, grao: 0.28, poeira: 0.18 } },
  { id: 'r_chrome_vencido', g: 'Cor', n: 'Chrome 64 · Vencido', nota: 'Cor de rua silenciosa: cromo vencido, cor contida e véu macio',
    s: { filme: 'chrome64', vencido: 0.45, grao: 0.32, poeira: 0.22 } },
  { id: 'r_chrome_chuva', g: 'Cor', n: 'Chrome 64 · Chuva', nota: 'Cor suave, quase pintada: cromo um pouco vencido, luz difusa, grão colorido',
    s: { filme: 'chrome64', vencido: 0.3, exposicao: 0.2, difusao: 0.35, grao: 0.3, graoTipo: 'colorido' } },
  { id: 'r_gold_tarde', g: 'Cor', n: 'Gold 200 · Fim de tarde', nota: 'Sol baixo de verão: um pouco superexposto, luz que se espalha',
    s: { filme: 'gold200', exposicao: 0.35, difusao: 0.25, halacao: 0.15, grao: 0.3 } },
  { id: 'r_portrait800_cidade', g: 'Noite e flash', n: 'Portrait 800 · Cidade', nota: 'Noite na cidade em cor: puxado, quente e denso, grão colorido',
    s: { filme: 'portrait800', puxar: 1.3, grao: 0.5, graoTipo: 'colorido', halacao: 0.2 } },
  { id: 'r_tungsten_noite', g: 'Noite e flash', n: 'Tungsten 800 · Noite', nota: 'Noite de cinema puxada: halo forte nas luzes, grão de filme rápido',
    s: { filme: 'tungsten800', puxar: 1, halacao: 0.6, grao: 0.45 } },
  { id: 'r_gold_flash', g: 'Noite e flash', n: 'Gold 200 · Flash', nota: 'Festa dos anos 90: flash direto, fundo escuro, cor quente de filme comum',
    s: { filme: 'gold200', flash: 0.75, flashEstilo: 'anos90', grao: 0.35, graoTipo: 'colorido' } },
  { id: 'r_portrait_compacta', g: 'Noite e flash', n: 'Portrait 400 · Compacta', nota: 'Flash de compacta digital: luz fria e limpa, pele brilhante, fundo que cai',
    s: { filme: 'portrait400', flash: 0.7, flashEstilo: 'digital', grao: 0.2 } },
];
// campos que uma receita controla (voltam ao padrão quando a receita não diz nada sobre eles)
const DA_RECEITA = ['puxar', 'vencido', 'poeira', 'luzVazada', 'cenaTemp', 'cenaMatiz', 'exposicao', 'graoTipo', 'difusao', 'flash', 'flashEstilo', 'amplCeu'];
function aplicaReceita(r) {
  const f = filmes.find((x) => x.meta.id === r.s.filme), a = f?.meta.analogico || {};
  for (const k of DA_RECEITA) s[k] = PADRAO[k];
  s.grao = a.grao ?? 0; s.graoTamanho = a.grao_tamanho ?? 1; s.halacao = a.halacao ?? 0;
  const rs = { ...r.s }; if (rs.pontos && (s.pontos || []).length) delete rs.pontos;   // os pontos que você já pôs nesta foto ficam
  Object.assign(s, rs); s.receita = r.id;
  R.setFilm(filmeAtual()); montaFaixa(); sincroniza(); desenha(); memoriza();
  if (celular()) aviso(r.nota);
}

// ------------------------------------------------------------ estado da edição
const PADRAO = {
  filme: null, receita: null, intensidade: 1, exposicao: 0, lab: 'neutro', filtro: 'nenhum', labAuto: 1, rosto: null, separacao: 0.5, rostoTam: 1, poeira: 0, luzVazada: 0, luzTipo: '0', sorteLuz: 3, sorte: 7, puxar: 0, vencido: 0, sorteVenc: 5, cenaTemp: 0, cenaMatiz: 0,
  grao: 0, graoTamanho: 1, graoTipo: 'classico', halacao: 0, caraterFilme: 1, semente: 0.37,
  // ajustes finos (depois do filme) e geometria
  brilho: 0, contraste: 0, realces: 0, sombras: 0, brancos: 0, pretos: 0, esmaecer: 0, saturacao: 0, vibracao: 0, pele: 0,
  clareza: 0, nitidez: 0, vinheta: 0, difusao: 0, hsl: HSL0, curvas: null,
  giro: 0, espelho: 0, endireitar: 0, corte: null, proporcao: 'livre', perspV: 0, perspH: 0, lente: 0,
  // ampliação (laboratório) e flash: o assunto marcado (fração do quadro) e o horizonte valem para os dois
  assunto: null, horizonte: 0.42, amplCeu: 0, flash: 0, flashAlcance: 0.5, flashEstilo: 'anos90',
  pontos: [],   // Seletivo: até 4 pontos { x, y, tam, luz, contraste, sat, calor, estrutura, entorno }
};
// Retrato (marcar o rosto) está guardado na gaveta (18/11/2026, a pedido): a função continua no código e no motor,
// mas fica fora da tela até a ideia amadurecer. Para voltar, troque para true.
const RETRATO = false;
const GEO = ['giro', 'espelho', 'endireitar', 'corte', 'proporcao', 'perspV', 'perspH', 'lente'];
const POR_FOTO = [...GEO, 'assunto', 'horizonte', 'pontos'];   // a composição é desta foto: não vai para a próxima nem para o lote   // é desta foto: não vai para a próxima nem para o lote
let s = { ...PADRAO };
let marcando = false;   // esperando o toque no rosto (retrato)
let foto = null;          // { bitmap, nome }
let filmes = [];          // pacotes carregados { meta, data }
let catAtual = 'filmes';

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
  const cats = CATS;
  if (!cats.some((c) => c.id === catAtual)) catAtual = 'filmes';
  $('cats').innerHTML = '';
  for (const c of cats) {
    const b = document.createElement('button'); b.textContent = c.n; b.className = c.id === catAtual ? 'on' : '';
    b.onclick = () => { catAtual = c.id; montaCats(); montaFaixa(); if (c.id === 'minhas' && foto) dica('minhas'); };
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
    toqueLongo(b, () => fichaFilme(id === 'none' ? null : id));
    fx.append(b);
  };
  if (catAtual === 'minhas') {
    // as receitas da pessoa: a primeira casa salva a edição de agora; depois as salvas; por fim, colar um código
    const extra = (rot, sub, acao) => {
      const b = document.createElement('button'); b.className = 'film acao';
      b.innerHTML = `<div class="ph">${rot}</div><span>${sub}</span>`; b.onclick = acao; fx.append(b);
    };
    extra('+', 'Salvar esta', () => salvarMinha());
    for (const m of lerMinhas()) {
      const f = filmes.find((x) => x.meta.id === m.s.filme);
      const b = document.createElement('button'); b.className = 'film' + (s.receita === 'm_' + m.id ? ' on' : '');
      const c = document.createElement('canvas'); c.width = c.height = 148;
      if (foto) miniatura(c, f, m.s); else c.className = 'ph';
      const n = document.createElement('span'); n.textContent = m.n; b.append(c, n);
      b.onclick = () => aplicaMinha(m); toqueLongo(b, () => fichaMinha(m)); fx.append(b);
    }
    extra('⧉', 'Colar código', () => colarCodigo());
  } else if (catAtual === 'receitas') {
    let g = null;
    for (const r of RECEITAS) {
      if (r.g !== g) { g = r.g; const l = document.createElement('div'); l.className = 'film rotulo'; l.innerHTML = `<span>${g}</span>`; fx.append(l); }   // a família, entre os grupos
      const f = filmes.find((x) => x.meta.id === r.s.filme);
      const b = document.createElement('button'); b.className = 'film' + (s.receita === r.id ? ' on' : '');
      const c = document.createElement('canvas'); c.width = c.height = 148;
      if (foto) miniatura(c, f, r.s); else c.className = 'ph';
      const n = document.createElement('span'); n.textContent = r.n; b.append(c, n);
      b.onclick = () => aplicaReceita(r); toqueLongo(b, () => fichaReceita(r)); fx.append(b);
    }
  } else {
    item('none', 'Digital', (c) => miniatura(c, null));
    for (const f of filmes) item(f.meta.id, f.meta.nome, (c) => miniatura(c, f));
  }
  atualizaNota();
}

// ------------------------------------------------------------ folha: um painel pequeno que sobe por cima dos controles
// (salvar e renomear receitas, códigos, ficha do filme, exportar). Não muda a altura da tela; toque fora fecha.
const veu = document.createElement('div'); veu.id = 'veu'; document.body.append(veu);
const folhaEl = document.createElement('div'); folhaEl.id = 'folha'; folhaEl.setAttribute('role', 'dialog'); document.body.append(folhaEl);
function folha(html) { folhaEl.innerHTML = html; document.body.classList.add('com-folha'); return folhaEl; }
function fechaFolha() { document.body.classList.remove('com-folha'); }
veu.onclick = fechaFolha;
addEventListener('keydown', (e) => { if (e.key === 'Escape') fechaFolha(); });
const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// toque longo (ou botão direito) abre a ficha; o toque normal continua escolhendo
function toqueLongo(el, abre) {
  let tm = 0, longo = false;
  el.addEventListener('pointerdown', (e) => { if (e.button) return; longo = false; tm = setTimeout(() => { longo = true; navigator.vibrate?.(10); abre(); }, 480); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'pointermove']) el.addEventListener(ev, (e) => { if (ev === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 3) return; clearTimeout(tm); });
  el.addEventListener('click', (e) => { if (longo) { e.stopImmediatePropagation(); e.preventDefault(); longo = false; } }, true);
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); abre(); });
}

// ------------------------------------------------------------ ficha do filme (toque longo na miniatura)
const PARA = {
  portrait400: 'retratos e viagens com sol; pele bonita em quase qualquer luz',
  portrait160: 'retrato íntimo em luz suave: janela, sombra aberta, fim de tarde',
  portrait800: 'noite e interiores: festa, restaurante, casa à noite',
  gold200: 'o dia a dia: família, praia, verão, a casa numa tarde de sol',
  editorial100: 'retrato produzido: moda, estúdio, luz de janela',
  chrome100: 'arquitetura e céu azul; cor forte ao meio-dia',
  vivid50: 'paisagem: natureza, cachoeira, pôr do sol (deixa a pele vermelha)',
  chrome64: 'rua: luz dura, sombras e cor que contam história',
  pro400: 'casamento, natureza e céu aberto: verdes e brancos leves',
  tungsten800: 'cidade à noite: neon e luz artificial',
  silver400: 'rua e documental; céus dramáticos',
  silverportrait: 'retrato em preto e branco, pele luminosa',
};
function fichaFilme(id) {
  const f = filmes.find((x) => x.meta.id === id);
  const m = f?.meta;
  folha(`<div class="ficha"><h3>${m ? esc(m.nome) : 'Digital'}</h3>
    <p class="alma">${m ? esc(m.nota) : 'A foto como saiu da câmera, sem filme.'}</p>
    ${m ? `<dl><dt>Inspirado no</dt><dd>${esc(m.inspirado)}</dd>${PARA[id] ? `<dt>Para</dt><dd>${esc(PARA[id])}</dd>` : ''}</dl>` : ''}
    <div class="botoes"><button class="fecha">Fechar</button><button class="pri">Usar este filme</button></div></div>`);
  folhaEl.querySelector('.fecha').onclick = fechaFolha;
  folhaEl.querySelector('.pri').onclick = () => { fechaFolha(); escolheFilme(id); };
}
function fichaReceita(r) {
  const f = filmes.find((x) => x.meta.id === r.s.filme);
  folha(`<div class="ficha"><h3>${esc(r.n)}</h3><p class="alma">${esc(r.nota)}</p>
    <dl><dt>Filme</dt><dd>${esc(f?.meta.nome || 'Digital')}</dd></dl>
    <div class="botoes"><button class="fecha">Fechar</button><button class="pri">Usar esta receita</button></div></div>`);
  folhaEl.querySelector('.fecha').onclick = fechaFolha;
  folhaEl.querySelector('.pri').onclick = () => { fechaFolha(); aplicaReceita(r); };
}

// ------------------------------------------------------------ minhas receitas: guardadas no aparelho (sem conta, sem internet)
const CHAVE_MINHAS = 'revela.minhasReceitas';
const FORA_DA_RECEITA = new Set(['semente', 'rosto', 'receita']);   // e o que é da foto (corte, assunto): POR_FOTO
function lerMinhas() { try { const l = JSON.parse(localStorage.getItem(CHAVE_MINHAS) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } }
function gravarMinhas(l) { try { localStorage.setItem(CHAVE_MINHAS, JSON.stringify(l)); return true; } catch { aviso('Não consegui guardar neste aparelho'); return false; } }
function edicaoAtual() {   // só o que difere do padrão: a receita fica pequena e o código, curto
  return Object.fromEntries(Object.keys(PADRAO).filter((k) => !FORA_DA_RECEITA.has(k) && !POR_FOTO.includes(k) && JSON.stringify(s[k]) !== JSON.stringify(PADRAO[k])).map((k) => [k, s[k]]));
}
function aplicaMinha(m) {
  const daFoto = Object.fromEntries(POR_FOTO.map((k) => [k, s[k]]));   // o corte e o assunto desta foto ficam
  s = { ...PADRAO, ...daFoto, semente: s.semente, ...valida(m.s), receita: 'm_' + m.id };
  R.setFilm(filmeAtual()); montaFaixa(); sincroniza(); atualizaNota(); desenha(); memoriza();
  if (celular()) aviso(m.n);
}
function salvarMinha() {
  if (!foto) { aviso('Abra uma foto e edite antes de salvar'); return; }
  const l = lerMinhas(), nome = 'Minha receita ' + (l.length + 1);
  folha(`<div class="ficha"><h3>Salvar esta edição</h3><p class="alma">Filme, ajustes e textura. O corte e os pontos marcados ficam só nesta foto.</p>
    <input class="campo" maxlength="32" value="${esc(nome)}" aria-label="Nome da receita">
    <div class="botoes"><button class="fecha">Cancelar</button><button class="pri">Salvar</button></div></div>`);
  const inp = folhaEl.querySelector('input'); setTimeout(() => { inp.focus(); inp.select(); }, 50);
  const ok = () => {
    const n = inp.value.trim() || nome, id = Date.now().toString(36);
    if (gravarMinhas([...l, { id, n, s: edicaoAtual() }])) { fechaFolha(); s.receita = 'm_' + id; catAtual = 'minhas'; montaCats(); montaFaixa(); memoriza(); aviso('Receita salva: ' + n); }
  };
  folhaEl.querySelector('.pri').onclick = ok; inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  folhaEl.querySelector('.fecha').onclick = fechaFolha;
}
function fichaMinha(m) {
  const cod = codigo(m);
  folha(`<div class="ficha"><h3>Minha receita</h3>
    <input class="campo" maxlength="32" value="${esc(m.n)}" aria-label="Nome da receita">
    <p class="alma">Para passar adiante, copie o código e mande para quem quiser. No Revela da outra pessoa: Minhas › Colar código.</p>
    <textarea class="campo codigo" readonly rows="2" aria-label="Código da receita">${esc(cod)}</textarea>
    <div class="botoes"><button class="apaga">Apagar</button><button class="copia">Copiar código</button><button class="pri">Pronto</button></div></div>`);
  const inp = folhaEl.querySelector('input');
  folhaEl.querySelector('.pri').onclick = () => {
    const l = lerMinhas().map((x) => (x.id === m.id ? { ...x, n: inp.value.trim() || x.n } : x)); gravarMinhas(l); fechaFolha(); montaFaixa();
  };
  folhaEl.querySelector('.copia').onclick = async () => {
    const ta = folhaEl.querySelector('textarea');
    try { await navigator.clipboard.writeText(cod); aviso('Código copiado'); } catch { ta.select(); document.execCommand?.('copy'); aviso('Código copiado'); }
  };
  folhaEl.querySelector('.apaga').onclick = () => {
    const b = folhaEl.querySelector('.apaga');
    if (!b.dataset.certeza) { b.dataset.certeza = 1; b.textContent = 'Apagar mesmo?'; return; }   // segundo toque confirma
    gravarMinhas(lerMinhas().filter((x) => x.id !== m.id)); if (s.receita === 'm_' + m.id) s.receita = null; fechaFolha(); montaFaixa();
  };
}
// código da receita: "RV1." + JSON em base64 (url). Ao colar, só entram campos conhecidos, com o tipo certo e dentro dos limites.
function codigo(m) {
  const j = JSON.stringify({ n: m.n, s: m.s }), b = btoa(unescape(encodeURIComponent(j)));
  return 'RV1.' + b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodifica(txt) {
  const m = String(txt).trim().match(/RV1\.([A-Za-z0-9_-]+)/); if (!m) return null;
  try {
    const b = m[1].replace(/-/g, '+').replace(/_/g, '/'), j = JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4)))));
    if (!j || typeof j !== 'object') return null;
    return { n: String(j.n || 'Receita recebida').slice(0, 32), s: valida(j.s || {}) };
  } catch { return null; }
}
function valida(x) {   // nunca confia no que vem de fora: só chaves do padrão, com o tipo certo, dentro dos limites
  const o = {}; if (!x || typeof x !== 'object') return o;
  const num = (v, a, b) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : null);
  for (const [k, v] of Object.entries(x)) {
    if (!(k in PADRAO) || FORA_DA_RECEITA.has(k) || POR_FOTO.includes(k)) continue;
    if (k === 'filme') { if (v === null || filmes.some((f) => f.meta.id === v)) o.filme = v; continue; }
    if (k === 'hsl') { if (Array.isArray(v) && v.length === 8) o.hsl = v.map((c) => (Array.isArray(c) ? [0, 1, 2].map((i) => num(c[i], -1, 1) ?? 0) : [0, 0, 0])); continue; }
    if (k === 'curvas') {
      if (v && typeof v === 'object') {
        const c = {}; for (const ch of ['l', 'r', 'g', 'b']) { const pts = Array.isArray(v[ch]) ? v[ch].slice(0, 16).filter((p) => Array.isArray(p)).map((p) => [num(p[0], 0, 1) ?? 0, num(p[1], 0, 1) ?? 0]).sort((a, b) => a[0] - b[0]) : null; c[ch] = pts && pts.length >= 2 ? pts : CURVA0[ch]; }
        o.curvas = c;
      }
      continue;
    }
    if (typeof PADRAO[k] === 'string') { if (typeof v === 'string' && v.length < 24) o[k] = v; continue; }
    if (typeof PADRAO[k] === 'number') { const d = CTL[k]; const n = d ? num(v, d.min, d.max) : num(v, -1000, 1000); if (n !== null) o[k] = n; }
  }
  return o;
}
function colarCodigo() {
  folha(`<div class="ficha"><h3>Colar código</h3><p class="alma">Cole o código de uma receita que alguém mandou para você.</p>
    <textarea class="campo codigo" rows="3" placeholder="RV1.…" aria-label="Código da receita"></textarea>
    <div class="botoes"><button class="fecha">Cancelar</button><button class="pri">Guardar receita</button></div></div>`);
  const ta = folhaEl.querySelector('textarea'); setTimeout(() => ta.focus(), 50);
  navigator.clipboard?.readText?.().then((x) => { if (/RV1\./.test(x) && !ta.value) ta.value = x.trim(); }).catch(() => {});
  folhaEl.querySelector('.fecha').onclick = fechaFolha;
  folhaEl.querySelector('.pri').onclick = () => {
    const r = decodifica(ta.value); if (!r) { aviso('Esse código não é de uma receita do Revela'); return; }
    const m = { id: Date.now().toString(36), n: r.n, s: r.s };
    if (gravarMinhas([...lerMinhas(), m])) { fechaFolha(); catAtual = 'minhas'; montaCats(); if (foto) aplicaMinha(m); else montaFaixa(); aviso('Receita guardada: ' + m.n); }
  };
}

// miniatura: a foto atual com cada filme (como no RNI, a escolha é vendo o resultado)
let miniFonte = null;
function miniatura(c, f, extra = null) {
  if (!miniFonte) return;
  Rmini.setFilm(f);
  // filme sozinho: sem os efeitos de agora; receita: com a revelação dela (o grão não aparece nesse tamanho)
  const st = { ...s, ...(extra ? Object.fromEntries(DA_RECEITA.map((k) => [k, PADRAO[k]])) : { puxar: 0, vencido: 0, flash: 0, amplCeu: 0, pontos: [] }), ...(extra || {}),
    filme: f?.meta.id ?? null, intensidade: 1, grao: 0, halacao: 0, poeira: 0, luzVazada: 0, giro: 0, espelho: 0, endireitar: 0, corte: null, perspV: 0, perspH: 0, lente: 0, vinheta: 0, difusao: 0, ...(extra ? {} : { exposicao: 0 }) };
  Rmini.draw(st, miniFonte.width, miniFonte.height, 600);
  const g = c.getContext('2d'), k = Math.min(miniFonte.width, miniFonte.height);
  g.drawImage(Rmini.canvas, (miniFonte.width - k) / 2, (miniFonte.height - k) / 2, k, k, 0, 0, c.width, c.height);
}

function atualizaNota() {
  const f = filmeAtual();
  const rc = RECEITAS.find((r) => r.id === s.receita) || (catAtual === 'minhas' && String(s.receita).startsWith('m_') ? { nota: 'Minha receita: ' + (lerMinhas().find((m) => 'm_' + m.id === s.receita)?.n || '') } : null);
  if (rc && (catAtual === 'receitas' || catAtual === 'minhas')) { $('nota').textContent = rc.nota; return; }
  $('nota').textContent = f ? `${f.meta.nota} · inspirado no ${f.meta.inspirado}` : 'Sem filme: a foto como saiu da câmera.';
}

function escolheFilme(id) {
  if (s.filme === id && !s.receita) return;
  s.filme = id; s.receita = null;
  const f = filmeAtual();
  const a = f?.meta.analogico || {};
  s.grao = a.grao ?? 0; s.graoTamanho = a.grao_tamanho ?? 1; s.halacao = a.halacao ?? 0;   // o caráter do filme vem junto
  R.setFilm(f); montaFaixa(); sincroniza(); desenha(); memoriza();
  setTimeout(() => dica(lerDicas().ficha ? 'comparar' : 'ficha'), 2800);   // depois do aviso com a descrição do filme
  if (celular()) aviso(f ? `${f.meta.nome || ''}${f.meta.nome ? ': ' : ''}${f.meta.nota}` : 'Digital: a foto como saiu da câmera');   // no celular a descrição aparece de passagem
}

// ------------------------------------------------------------ controles
const CTL = {
  intensidade: { n: 'Intensidade do filme', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  exposicao: { n: 'Exposição', min: -3, max: 3, passo: 0.05, fmt: (v) => ((v > 0 ? '+' : '') + v.toFixed(1)).replace('.', ',') },
  cenaTemp: { n: 'Calor', min: -1, max: 1, passo: 0.01, fmt: sinal },
  brilho: { n: 'Brilho', min: -1, max: 1, passo: 0.01, fmt: sinal },
  contraste: { n: 'Contraste', min: -1, max: 1, passo: 0.01, fmt: sinal },
  realces: { n: 'Realces', min: -1, max: 1, passo: 0.01, fmt: sinal },
  sombras: { n: 'Sombras', min: -1, max: 1, passo: 0.01, fmt: sinal },
  brancos: { n: 'Brancos', min: -1, max: 1, passo: 0.01, fmt: sinal },
  pretos: { n: 'Pretos', min: -1, max: 1, passo: 0.01, fmt: sinal },
  esmaecer: { n: 'Esmaecer', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  saturacao: { n: 'Saturação', min: -1, max: 1, passo: 0.01, fmt: sinal },
  vibracao: { n: 'Vibração', min: -1, max: 1, passo: 0.01, fmt: sinal },
  pele: { n: 'Tom de pele', min: -1, max: 1, passo: 0.01, fmt: (v) => (Math.abs(v) < 0.005 ? '0' : (v < 0 ? 'rosado ' : 'dourado ') + Math.round(Math.abs(v) * 100)) },
  clareza: { n: 'Clareza', min: -1, max: 1, passo: 0.01, fmt: sinal },
  nitidez: { n: 'Nitidez', min: -1, max: 1, passo: 0.01, fmt: (v) => (Math.abs(v) < 0.005 ? '0' : v < 0 ? 'papel ' + Math.round(-v * 100) : '+' + Math.round(v * 100)) },   // como no RNI: − = maciez da cópia em papel
  vinheta: { n: 'Vinheta', min: -1, max: 1, passo: 0.01, fmt: (v) => (Math.abs(v) < 0.005 ? '0' : (v < 0 ? 'clara ' : 'escura ') + Math.round(Math.abs(v) * 100)) },
  difusao: { n: 'Difusão', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  flash: { n: 'Flash', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  amplCeu: { n: 'Céu', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  flashAlcance: { n: 'Alcance do flash', min: 0, max: 1, passo: 0.01, fmt: (v) => (v < 0.34 ? 'perto ' : v > 0.66 ? 'longe ' : '') + Math.round(v * 100) },
  endireitar: { n: 'Endireitar', min: -45, max: 45, passo: 0.1, fmt: (v) => (Math.abs(v) < 0.05 ? '0°' : v.toFixed(1).replace('.', ',') + '°') },
  cenaMatiz: { n: 'Matiz', min: -1, max: 1, passo: 0.01, fmt: sinal },
  grao: { n: 'Grão', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  graoTamanho: { n: 'Tamanho do grão', min: 0.5, max: 2.5, passo: 0.05, fmt: (v) => v.toFixed(2).replace('.', ',') },
  halacao: { n: 'Halação', min: 0, max: 1, passo: 0.01, fmt: (v) => Math.round(v * 100) },
  puxar: { n: 'Puxar', min: -1, max: 3, passo: 0.1, fmt: (v) => (Math.abs(v) < 0.05 ? 'normal' : (v > 0 ? 'puxado +' : 'segurado ') + v.toFixed(1).replace('.', ',')) },
  vencido: { n: 'Vencido', min: 0, max: 1, passo: 0.01, fmt: (v) => (v < 0.01 ? 'novo' : Math.round(v * 100)) },
  poeira: { n: 'Poeira', min: -1, max: 1, passo: 0.01, fmt: (v) => (v === 0 ? '0' : (v > 0 ? 'branca ' : 'preta ') + Math.round(Math.abs(v) * 100)) },   // como no RNI: meio = sem, direita = branca, esquerda = preta
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
  r.addEventListener('input', () => { s[k] = +r.value; if (k === 'endireitar') aoEndireitar(); $('o_' + k).textContent = d.fmt(s[k]); desenha(); if (typeof sincronizaFerramentas === 'function') sincronizaFerramentas(); });
  r.addEventListener('change', memoriza);
  r.addEventListener('dblclick', () => { s[k] = PADRAO[k] ?? 0; if (k === 'grao' || k === 'halacao') { const a = filmeAtual()?.meta.analogico || {}; s[k] = (k === 'grao' ? a.grao : a.halacao) ?? 0; } sincroniza(); desenha(); memoriza(); });
}
// barra como no RNI: acende o trecho entre o zero e o botão; nas de dois lados, um pontinho marca o zero
function pintaBarra(r) {
  const mn = +r.min, mx = +r.max, v = +r.value, bi = mn < 0 && mx > 0, z = bi ? (0 - mn) / (mx - mn) : 0, p = (v - mn) / (mx - mn);
  r.classList.toggle('bi', bi);
  r.style.setProperty('--z', z); r.style.setProperty('--a', Math.min(z, p)); r.style.setProperty('--b', Math.max(z, p));
}
// o número grande sobre a foto enquanto arrasta (some quando solta)
const numero = document.createElement('div'); numero.id = 'numero'; $('palco').append(numero);
let tNumero = 0;
document.addEventListener('input', (e) => {
  const r = e.target; if (!(r instanceof HTMLInputElement) || r.type !== 'range') return;
  pintaBarra(r);
  const c = r.closest('.ctl'), o = c?.querySelector('output'), nome = c?.querySelector('label')?.textContent || '';
  if (!o || !foto) return;
  numero.innerHTML = `${o.textContent}<small>${nome}</small>`; numero.style.opacity = 1;
  clearTimeout(tNumero); tNumero = setTimeout(() => (numero.style.opacity = 0), 900);
});
document.addEventListener('change', (e) => { if (e.target.type === 'range') { clearTimeout(tNumero); tNumero = setTimeout(() => (numero.style.opacity = 0), 350); } });
// escolha entre opções (botões lado a lado)
function escolha(k, ops, pai, titulo) {
  const w = document.createElement('div'); w.className = 'escolha'; w.id = 'e_' + k;
  w.innerHTML = (titulo ? `<label>${titulo}</label>` : '') + '<div></div><small></small>'; pai.append(w);
  for (const o of ops) {
    const b = document.createElement('button'); b.textContent = o.n; b.dataset.v = o.id;
    b.onclick = () => { if (s[k] === o.id) return; s[k] = o.id; sincroniza(); desenha(); memoriza(); };
    w.querySelector('div').append(b);
  }
}
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
const GRAOS = [
  { id: 'fino', n: 'Fino', nota: 'Liso e redondo, como os filmes de grão chato (Portra, T-Max)' },
  { id: 'classico', n: 'Clássico', nota: 'O grão de prata de sempre (Tri-X, HP5)' },
  { id: 'aspero', n: 'Áspero', nota: 'Filme puxado ou rápido: grãos aglomerados e irregulares' },
  { id: 'colorido', n: 'Colorido', nota: 'As nuvens de corante do negativo em cores' },
];
escolha('graoTipo', GRAOS, $('p-analogico'));
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
// revelação: o que o laboratório e o tempo fazem com o filme (vale para qualquer filme)
// revelação: mora junto do filme (aba Filmes), numa linha Intensidade · Puxar · Vencido
controle('puxar', $('cIntensidade'));
controle('vencido', $('cIntensidade'));
dado('vencido', 'tonalidade de rolo vencido', () => { s.sorteVenc = novo(); if (!s.vencido) s.vencido = 0.5; });
controle('luzVazada', $('p-analogico'));
dado('luzVazada', 'luz vazada', () => { s.sorteLuz = novo(); if (!s.luzVazada) s.luzVazada = 0.5; });
escolha('luzTipo', LUZES, $('p-analogico'));
controle('poeira', $('p-analogico'));
dado('poeira', 'poeira', () => { s.sorte = novo(); if (!s.poeira) s.poeira = 0.5; });
for (const k of ['brilho', 'contraste', 'realces', 'sombras', 'brancos', 'pretos', 'esmaecer', 'saturacao', 'vibracao', 'pele', 'clareza', 'nitidez', 'vinheta']) controle(k, $('p-ajustes'));
controle('difusao', $('p-analogico'));
controle('flash', $('p-analogico')); controle('flashAlcance', $('p-analogico'));
{ const d = document.createElement('small'); d.className = 'dica'; d.id = 'dicaFlash'; d.textContent = 'Toque no assunto · arraste a alça do círculo para o alcance'; $('p-analogico').append(d); }
// estilos de flash (como no Prequel): escolhas rápidas, cada uma muda a força no assunto, a queda do fundo e a cor
const FLASHES_UI = [
  { id: 'anos90', n: 'Anos 90', nota: 'Compacta de filme: fundo bem escuro, ambiente quente' },
  { id: 'digital', n: 'Compacta digital', nota: 'Anos 2010: luz fria e limpa, pele brilhante, fundo que cai menos' },
  { id: 'festa', n: 'Festa', nota: 'Flash forte e perto: o fundo some, contraste alto' },
];
escolha('flashEstilo', FLASHES_UI, $('p-analogico'));
// céu: a queima com filtro duro a partir da linha do horizonte (o assunto e o entorno foram para o Seletivo, em Ajustes)
controle('amplCeu', $('p-analogico'));
{ const d = document.createElement('small'); d.className = 'dica'; d.id = 'dicaCeu'; d.textContent = 'Arraste a linha do horizonte · o que não é céu fica protegido'; $('p-analogico').append(d); }

// ------------------------------------------------------------ Seletivo (Ajustes): pontos com a máscara que abraça o assunto
const PARAMS = [['luz', 'Luz', -1, 1], ['contraste', 'Contraste', -1, 1], ['sat', 'Saturação', -1, 1], ['calor', 'Calor', -1, 1], ['estrutura', 'Estrutura', -1, 1], ['entorno', 'Entorno', 0, 1]];
let ptSel = -1, paramSel = 'luz', novoPonto = false, verMasc = -1;
const gSel = document.createElement('div'); gSel.id = 'g_sel'; $('p-ajustes').append(gSel);
gSel.innerHTML = `<div class="selParams">${PARAMS.map(([k, n]) => `<button data-k="${k}">${n}</button>`).join('')}</div>`;
const selLinha = linha('selVal', 'Luz', -1, 1, 0.01, () => (ptSel >= 0 ? s.pontos[ptSel]?.[paramSel] || 0 : 0), (v) => {
  if (ptSel < 0) return; s.pontos = s.pontos.map((p, i) => (i === ptSel ? { ...p, [paramSel]: v } : p));
}, (v) => sinal(v), gSel);
{
  const acoes = document.createElement('div'); acoes.className = 'selAcoes';
  acoes.innerHTML = '<button class="novo">+ Ponto</button><button class="apaga">Apagar ponto</button><small class="dica"></small>'; gSel.append(acoes);
  acoes.querySelector('.novo').onclick = () => { novoPonto = !novoPonto; montaSel(); posicionaPontos(); };
  acoes.querySelector('.apaga').onclick = () => {
    if (ptSel < 0) return; s.pontos = s.pontos.filter((_, i) => i !== ptSel); ptSel = s.pontos.length ? Math.min(ptSel, s.pontos.length - 1) : -1;
    montaSel(); posicionaPontos(); desenha(); sincronizaFerramentas(); memoriza();
  };
}
gSel.querySelectorAll('.selParams button').forEach((b) => b.onclick = () => { paramSel = b.dataset.k; montaSel(); });
function montaSel() {
  const pt = ptSel >= 0 ? s.pontos[ptSel] : null, def = PARAMS.find((p) => p[0] === paramSel);
  gSel.querySelectorAll('.selParams button').forEach((b) => { b.classList.toggle('on', b.dataset.k === paramSel); b.classList.toggle('mudou', !!(pt && pt[b.dataset.k])); b.disabled = !pt; });
  const r = $('r_selVal'); r.min = def[2]; r.max = def[3]; r.disabled = !pt;
  selLinha.querySelector('label').textContent = def[1]; selLinha.sync();
  const n = (s.pontos || []).length, a = gSel.querySelector('.selAcoes');
  a.querySelector('.novo').classList.toggle('on', novoPonto); a.querySelector('.novo').disabled = n >= 4;
  a.querySelector('.apaga').style.display = pt ? '' : 'none';
  a.querySelector('.dica').textContent = n >= 4 ? 'Até 4 pontos' : celular() ? (n ? 'Toque fora para outro ponto' : 'Toque na foto para criar um ponto') : (novoPonto ? 'Clique na foto para pôr o ponto' : (n ? '' : 'Clique em + Ponto e depois na foto'));
  a.querySelector('.novo').style.display = celular() ? 'none' : '';
}

// ---- controle numa linha só (nome, barra, valor): para os grupos com três controles
function linha(id, nome, min, max, passo, ler, gravar, fmt, pai) {
  const w = document.createElement('div'); w.className = 'ctl linha';
  w.innerHTML = `<label for="r_${id}">${nome}</label><input type="range" id="r_${id}" min="${min}" max="${max}" step="${passo}"><output id="o_${id}"></output>`;
  pai.append(w);
  const r = w.querySelector('input');
  w.sync = () => { r.value = ler(); w.querySelector('output').textContent = fmt(+r.value); pintaBarra(r); };
  r.addEventListener('input', () => { gravar(+r.value); w.sync(); desenha(); sincronizaFerramentas(); });
  r.addEventListener('change', memoriza);
  r.addEventListener('dblclick', () => { gravar(0); w.sync(); desenha(); sincronizaFerramentas(); memoriza(); });
  return w;
}

// ---- Cores (HSL): escolhe a cor e mexe no matiz, na saturação e na luminância só dela
const CORES = [['Vermelhos', '#d9493f'], ['Laranjas', '#e58a3a'], ['Amarelos', '#e3c84a'], ['Verdes', '#5fae4f'], ['Cianos', '#4fb8c4'], ['Azuis', '#4a74d6'], ['Roxos', '#8a5ad0'], ['Magentas', '#cf4f9f']];
let corHsl = 0;
const gHsl = document.createElement('div'); gHsl.id = 'g_hsl'; $('p-ajustes').append(gHsl);
{
  const fila = document.createElement('div'); fila.className = 'cores'; gHsl.append(fila);
  setTimeout(() => { const q = document.createElement('span'); q.className = 'qual'; fila.append(q); sincronizaHsl(); });
  CORES.forEach(([n, c], i) => {
    const b = document.createElement('button'); b.style.background = c; b.title = n; b.setAttribute('aria-label', n);
    b.onclick = () => { corHsl = i; sincronizaHsl(); }; fila.append(b);
  });
  const muda = (j) => (v) => { s.hsl = s.hsl.map((c, i) => (i === corHsl ? c.map((x, jj) => (jj === j ? v : x)) : c)); };
  const f = (v) => sinal(v);
  gHsl.linhas = [
    linha('hslH', 'Matiz', -1, 1, 0.01, () => s.hsl[corHsl][0], muda(0), f, gHsl),
    linha('hslS', 'Saturação', -1, 1, 0.01, () => s.hsl[corHsl][1], muda(1), f, gHsl),
    linha('hslL', 'Luminância', -1, 1, 0.01, () => s.hsl[corHsl][2], muda(2), f, gHsl),
  ];
}
function sincronizaHsl() {
  gHsl.querySelectorAll('.cores button').forEach((b, i) => { b.classList.toggle('on', i === corHsl); b.classList.toggle('mudou', s.hsl[i].some((x) => x)); });
  gHsl.linhas.forEach((l) => l.sync());
  const n = gHsl.querySelector('.qual'); if (n) n.textContent = CORES[corHsl][0];
}

// ---- Curvas: Luz (as três cores juntas) e cada canal. No celular o desenho fica sobre a foto; no computador, no painel.
let canal = 'l';
const gCurva = document.createElement('div'); gCurva.id = 'g_curvas'; $('p-ajustes').append(gCurva);
gCurva.innerHTML = `<div class="canais"><button data-c="l">Luz</button><button data-c="r">Vermelho</button><button data-c="g">Verde</button><button data-c="b">Azul</button><button class="zerar">Zerar</button></div>
  <small class="dica">Toque na curva para criar um ponto e arraste. Para tirar, toque duas vezes no ponto.</small>`;
const editorCurva = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); editorCurva.id = 'curva'; gCurva.append(editorCurva);
gCurva.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { canal = b.dataset.c; desenhaCurva(); });
gCurva.querySelector('.zerar').onclick = () => { if (!s.curvas) return; s.curvas = curvaMexida({ ...s.curvas, [canal]: CURVA0[canal] }) ? { ...s.curvas, [canal]: CURVA0[canal] } : null; desenhaCurva(); desenha(); sincronizaFerramentas(); memoriza(); };
const COR_CANAL = { l: '#eee7dc', r: '#e06a5e', g: '#6cc06a', b: '#6f97ee' };
function desenhaCurva() {
  gCurva.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === canal));
  const W = editorCurva.clientWidth, H = editorCurva.clientHeight;
  if (!W || !H) return;
  const c = s.curvas || CURVA0, pts = c[canal], a = amostraCurva(pts, 64), X = (x) => x * W, Y = (y) => (1 - y) * H;
  let h = '';
  for (let i = 1; i < 4; i++) h += `<line x1="${X(i / 4)}" y1="0" x2="${X(i / 4)}" y2="${H}"/><line x1="0" y1="${Y(i / 4)}" x2="${W}" y2="${Y(i / 4)}"/>`;
  h = `<g class="grade">${h}<line x1="0" y1="${H}" x2="${W}" y2="0"/></g>`;
  for (const k of ['l', 'r', 'g', 'b']) if (k !== canal && curvaMexida({ x: c[k] })) h += `<polyline class="outra" stroke="${COR_CANAL[k]}" points="${Array.from(amostraCurva(c[k], 64), (y, i) => `${X(i / 63)},${Y(y)}`).join(' ')}"/>`;
  h += `<polyline stroke="${COR_CANAL[canal]}" points="${Array.from(a, (y, i) => `${X(i / 63)},${Y(y)}`).join(' ')}"/>`;
  for (const [x, y] of pts) h += `<circle cx="${X(x)}" cy="${Y(y)}" r="6" stroke="${COR_CANAL[canal]}"/>`;
  editorCurva.setAttribute('viewBox', `0 0 ${W} ${H}`); editorCurva.innerHTML = h;
}
{
  let arrasto = null;
  const pos = (e) => { const r = editorCurva.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, r]; };
  let ultimo = { t: 0, i: -1 };
  const apaga = (i, pts, c) => {   // tira um ponto do meio (as pontas ficam)
    if (i <= 0 || i >= pts.length - 1) return false;
    pts.splice(i, 1); s.curvas = curvaMexida({ ...c, [canal]: pts }) ? { ...c, [canal]: pts } : (curvaMexida({ ...c, [canal]: CURVA0[canal] }) ? { ...c, [canal]: pts } : null);
    arrasto = null; desenhaCurva(); desenha(); sincronizaFerramentas(); memoriza(); return true;
  };
  const acha = (e) => { const [x, y, r] = pos(e), c = s.curvas || CURVA0, pts = c[canal].map((p) => [...p]); return { x, y, r, c, pts, i: pts.findIndex((p) => Math.hypot((p[0] - x) * r.width, (p[1] - y) * r.height) < 24) }; };
  editorCurva.addEventListener('contextmenu', (e) => { e.preventDefault(); const a = acha(e); if (a.i >= 0) apaga(a.i, a.pts, a.c); });
  editorCurva.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.button === 2) return;   // botão direito: fica com o contextmenu
    editorCurva.setPointerCapture?.(e.pointerId);
    const a0 = acha(e), agora = performance.now();
    if (a0.i >= 0 && a0.i === ultimo.i && agora - ultimo.t < 350) { ultimo = { t: 0, i: -1 }; if (apaga(a0.i, a0.pts, a0.c)) return; }
    ultimo = { t: agora, i: a0.i };
    const [x, y, r] = pos(e), c = s.curvas || CURVA0, pts = c[canal].map((p) => [...p]);
    let i = a0.i;
    if (i < 0) {   // ponto novo em cima da curva, na altura que ela já tem (não dá salto)
      const yc = amostraCurva(pts, 256)[Math.round(Math.min(1, Math.max(0, x)) * 255)];
      pts.push([Math.min(0.98, Math.max(0.02, x)), yc]); pts.sort((a, b) => a[0] - b[0]); i = pts.findIndex((p) => p[0] === Math.min(0.98, Math.max(0.02, x)));
    }
    arrasto = { i, pts }; s.curvas = { ...c, [canal]: pts }; desenhaCurva(); desenha();
  });
  editorCurva.addEventListener('pointermove', (e) => {
    if (!arrasto) return; e.stopPropagation();
    const [x, y] = pos(e), { pts } = arrasto; let i = arrasto.i;
    const ponta = i === 0 || i === pts.length - 1;
    if (!ponta && (y < -0.12 || y > 1.12 || x < -0.08 || x > 1.08)) { pts.splice(i, 1); arrasto = null; s.curvas = { ...s.curvas, [canal]: pts }; desenhaCurva(); desenha(); sincronizaFerramentas(); memoriza(); return; }
    const lo = i === 0 ? 0 : pts[i - 1][0] + 0.02, hi = i === pts.length - 1 ? 1 : pts[i + 1][0] - 0.02;
    pts[i] = [Math.min(hi, Math.max(lo, x)), Math.min(1, Math.max(0, y))];
    s.curvas = { ...s.curvas, [canal]: pts.map((p) => [...p]) }; desenhaCurva(); desenha(); sincronizaFerramentas();
  });
  const fim = () => { if (!arrasto) return; arrasto = null; if (!curvaMexida(s.curvas)) s.curvas = null; sincronizaFerramentas(); memoriza(); };
  editorCurva.addEventListener('pointerup', fim); editorCurva.addEventListener('pointercancel', fim);
}

// ---- Enquadrar (19/11/2026, no espírito do SKRWT): ícones Cortar · Girar · Endireitar · Vertical · Horizontal · Lente,
// régua com marcas para os ajustes finos, grade sobre a foto e ✕ / ✓ (o enquadramento se aplica ou se cancela de uma vez)
const PROPORCOES = [['livre', 'Livre'], ['original', 'Original'], ['1:1', '1:1'], ['4:5', '4:5'], ['2:3', '2:3'], ['9:16', '9:16']];
const vira = (id) => (id.includes(':') ? id.split(':').reverse().join(':') : id);   // 4:5 <-> 5:4
const gCorte = document.createElement('div'); gCorte.id = 'g_corte'; $('p-ajustes').append(gCorte);
gCorte.innerHTML = '<div class="acoes"><button id="bEnquadrar">Enquadrar a foto</button></div><small class="dica" style="display:block">Cortar, girar, endireitar, perspectiva e lente</small>';
const ICO = {
  cortar: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
  girar: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3v5h-5"/>',
  endireitar: '<path d="M3 16 21 8"/><path d="M3 20h18" opacity=".5"/>',
  perspV: '<path d="M7 4h10l3 16H4z"/>',
  perspH: '<path d="M4 7v10l16 4V3z"/>',
  lente: '<path d="M5 4q-3 8 0 16h14q3-8 0-16z"/><path d="M12 4v16M3.5 12h17" opacity=".5"/>',
};
const FERR_ENQ = [['cortar', 'Cortar'], ['girar', 'Girar'], ['endireitar', 'Endireitar'], ['perspV', 'Vertical'], ['perspH', 'Horizontal'], ['lente', 'Lente']];
const REGUA = {   // valor guardado -> régua (unidade mostrada, passo das marcas, marcas grandes, pixels por unidade)
  endireitar: { min: -45, max: 45, k: 1, passo: 1, grande: 5, ppu: 11, fmt: (v) => (Math.abs(v) < 0.05 ? '0°' : v.toFixed(1).replace('.', ',') + '°') },
  perspV: { min: -100, max: 100, k: 100, passo: 2, grande: 10, ppu: 2.6, fmt: (v) => Math.round(v) },
  perspH: { min: -100, max: 100, k: 100, passo: 2, grande: 10, ppu: 2.6, fmt: (v) => Math.round(v) },
  lente: { min: -100, max: 100, k: 100, passo: 2, grande: 10, ppu: 2.6, fmt: (v) => (Math.abs(v) < 0.5 ? '0' : (v > 0 ? 'barril ' : 'almofada ') + Math.round(Math.abs(v))) },
};
const enq = document.createElement('div'); enq.id = 'enq';
enq.innerHTML = `<div class="enq-ferr">${FERR_ENQ.map(([id, n]) => `<button data-f="${id}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[id]}</svg><span>${n}</span></button>`).join('')}</div>
  <div class="enq-meio"><div class="enq-props"></div><div class="regua"><output></output><div class="trilho"><div class="marcas"></div><i class="agulha"></i></div></div></div>
  <div class="enq-fim"><button class="cancela" aria-label="Cancelar">✕</button><button class="restaura">Restaurar</button><button class="aplica" aria-label="Aplicar">✓</button></div>`;
$('painel').append(enq);
let enquadrando = false, ferrEnq = 'cortar', antesEnq = null, deitado = false, grupoAntes = 'luz';
const GEO_ZERO = { giro: 0, espelho: 0, endireitar: 0, corte: null, proporcao: 'livre', perspV: 0, perspH: 0, lente: 0 };
function abreEnquadrar() {
  if (!foto || enquadrando) return;
  antesEnq = JSON.stringify(Object.fromEntries(GEO.map((k) => [k, s[k]])));
  const c = s.corte || { w: 1, h: 1 }, [QW, QH] = quadroGirado(s, R.w, R.h); deitado = c.w * QW > c.h * QH;
  enquadrando = true; document.body.classList.add('enquadrando'); ferrEnq = 'cortar'; montaEnq(); atualizaModos();
}
function fechaEnquadrar(aplica) {
  if (!enquadrando) return;
  if (!aplica && antesEnq) Object.assign(s, JSON.parse(antesEnq));
  enquadrando = false; document.body.classList.remove('enquadrando');
  if (celular() && grupoAtivo['p-ajustes'] === 'corte') mostraGrupo('p-ajustes', grupoAntes);
  sincroniza(); atualizaModos(); desenha(); if (aplica) memoriza();
}
$('bEnquadrar').onclick = abreEnquadrar;
enq.querySelector('.cancela').onclick = () => fechaEnquadrar(false);
enq.querySelector('.aplica').onclick = () => fechaEnquadrar(true);
enq.querySelector('.restaura').onclick = () => { Object.assign(s, GEO_ZERO); deitado = false; montaEnq(); desenha(); posicionaSobreposicoes(); };
enq.querySelectorAll('.enq-ferr button').forEach((b) => b.onclick = () => {
  if (b.dataset.f === 'girar') { gira90(); return; }   // girar age na hora, como no SKRWT
  ferrEnq = b.dataset.f; montaEnq(); posicionaSobreposicoes();
});
function gira90() {   // 90° no sentido do relógio: o corte gira junto e a proporção deita ou levanta
  const c = s.corte; s.giro = ((s.giro || 0) + 1) % 4;
  if (c) s.corte = { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w };
  if (s.proporcao && s.proporcao.includes(':')) s.proporcao = vira(s.proporcao);
  deitado = !deitado; reencaixa(); montaEnq(); desenha();
}
function razao(id) {   // largura/altura do corte em pixels; 0 = livre
  if (!id || id === 'livre') return 0;
  if (id === 'original') { const [QW, QH] = quadroGirado(s, R.w, R.h); return QW / QH; }
  const [a, b] = id.split(':').map(Number); return a / b;
}
function cortePara(id) {   // o maior corte nessa proporção, em volta do centro do corte atual
  const k = razao(id); if (!k) return s.corte;
  const [QW, QH] = quadroGirado(s, R.w, R.h), c = s.corte || { x: 0, y: 0, w: 1, h: 1 };
  let w = 1, h = (QW / k) / QH; if (h > 1) { h = 1; w = (QH * k) / QW; }
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const x = Math.min(1 - w, Math.max(0, cx - w / 2)), y = Math.min(1 - h, Math.max(0, cy - h / 2));
  return encaixa(s, R.w, R.h, { x, y, w, h });
}
function reencaixa() { if (s.corte) s.corte = encaixa(s, R.w, R.h, s.corte); }
function aoEndireitar() { reencaixa(); }
function montaEnq() {
  const mexeu = GEO.some((k) => JSON.stringify(s[k] ?? GEO_ZERO[k]) !== JSON.stringify(GEO_ZERO[k]));
  enq.querySelector('.restaura').style.visibility = mexeu ? 'visible' : 'hidden';
  enq.querySelectorAll('.enq-ferr button').forEach((b) => {
    b.classList.toggle('on', b.dataset.f === ferrEnq);
    const k = b.dataset.f; b.classList.toggle('mudou', k === 'cortar' ? !!s.corte : k === 'girar' ? !!s.giro : !!s[k]);
  });
  const props = enq.querySelector('.enq-props'), regua = enq.querySelector('.regua');
  props.style.display = ferrEnq === 'cortar' ? '' : 'none'; regua.style.display = ferrEnq === 'cortar' ? 'none' : '';
  if (ferrEnq === 'cortar') {
    props.innerHTML = PROPORCOES.map(([id, n]) => { const v = deitado ? vira(id) : id; return `<button data-v="${v}" class="${(s.proporcao || 'livre') === v ? 'on' : ''}">${deitado ? vira(n) : n}</button>`; }).join('')
      + `<button class="deita" title="Deitar ou levantar o corte" aria-label="Deitar ou levantar o corte">${deitado ? '▭' : '▯'}</button>`;
    props.querySelectorAll('button[data-v]').forEach((b) => b.onclick = () => { s.proporcao = b.dataset.v; s.corte = cortePara(b.dataset.v); montaEnq(); desenha(); posicionaSobreposicoes(); });
    props.querySelector('.deita').onclick = () => {
      deitado = !deitado;
      if (s.proporcao && s.proporcao.includes(':')) { s.proporcao = vira(s.proporcao); s.corte = cortePara(s.proporcao); }
      else {   // livre ou original: troca largura e altura do corte, centralizado
        const c = s.corte || { x: 0, y: 0, w: 1, h: 1 }, [QW, QH] = quadroGirado(s, R.w, R.h), k = (c.h * QH) / (c.w * QW);
        let w = 1, h = (QW / k) / QH; if (h > 1) { h = 1; w = (QH * k) / QW; }
        s.proporcao = 'livre'; s.corte = encaixa(s, R.w, R.h, { x: (1 - w) / 2, y: (1 - h) / 2, w, h });
      }
      montaEnq(); desenha(); posicionaSobreposicoes();
    };
  } else desenhaRegua();
}
// régua: arrastar para o lado muda o valor; dois toques voltam ao zero; perto do zero ela "encaixa" e o celular vibra
function desenhaRegua() {
  const R0 = REGUA[ferrEnq], v = (s[ferrEnq] || 0) * R0.k, tr = enq.querySelector('.trilho'), mk = enq.querySelector('.marcas');
  const W = tr.clientWidth || 300, len = (R0.max - R0.min) * R0.ppu;
  if (mk.dataset.f !== ferrEnq) {
    mk.dataset.f = ferrEnq; mk.style.width = len + 'px';
    let h = '';
    for (let x = R0.min; x <= R0.max + 1e-6; x += R0.passo) {
      const g = Math.abs(Math.round(x / R0.grande) * R0.grande - x) < 1e-6;
      h += `<i class="${g ? 'g' : ''}" style="left:${(x - R0.min) * R0.ppu}px"></i>` + (g ? `<b style="left:${(x - R0.min) * R0.ppu}px">${Math.round(x)}</b>` : '');
    }
    mk.innerHTML = h;
  }
  mk.style.transform = `translateX(${W / 2 - (v - R0.min) * R0.ppu}px)`;
  enq.querySelector('.regua output').textContent = R0.fmt(v);
}
{
  const tr = enq.querySelector('.trilho'); let arr = null, ultimoT = 0;
  const muda = (v) => {
    const R0 = REGUA[ferrEnq]; v = Math.min(R0.max, Math.max(R0.min, v));
    if (Math.abs(v) < R0.passo * 0.6) v = 0;   // encaixa no zero
    const antes = (s[ferrEnq] || 0) * R0.k;
    if (v === 0 && antes !== 0) navigator.vibrate?.(8);
    s[ferrEnq] = v / R0.k; reencaixa(); desenhaRegua(); montaEnqMarcas(); desenha();
  };
  tr.addEventListener('pointerdown', (e) => {
    e.preventDefault(); tr.setPointerCapture?.(e.pointerId);
    const t0 = performance.now(); if (t0 - ultimoT < 320) { muda(0); arr = null; ultimoT = 0; return; } ultimoT = t0;
    arr = { x: e.clientX, v: (s[ferrEnq] || 0) * REGUA[ferrEnq].k };
  });
  tr.addEventListener('pointermove', (e) => { if (!arr) return; muda(arr.v - (e.clientX - arr.x) / REGUA[ferrEnq].ppu); });
  const fim = () => { arr = null; }; tr.addEventListener('pointerup', fim); tr.addEventListener('pointercancel', fim);
  tr.addEventListener('wheel', (e) => { e.preventDefault(); const R0 = REGUA[ferrEnq]; muda((s[ferrEnq] || 0) * R0.k + Math.sign(e.deltaY || e.deltaX) * R0.passo * 0.5); }, { passive: false });
}
function montaEnqMarcas() {   // só os pontinhos e o Restaurar (sem refazer a régua)
  const mexeu = GEO.some((k) => JSON.stringify(s[k] ?? GEO_ZERO[k]) !== JSON.stringify(GEO_ZERO[k]));
  enq.querySelector('.restaura').style.visibility = mexeu ? 'visible' : 'hidden';
  enq.querySelectorAll('.enq-ferr button').forEach((b) => { const k = b.dataset.f; b.classList.toggle('mudou', k === 'cortar' ? !!s.corte : k === 'girar' ? !!s.giro : !!s[k]); });
}

// ------------------------------------------------------------ ferramentas (18/11/2026)
// No celular cada aba mostra uma linha de ferramentas e só o controle da escolhida, como no VSCO e no RNI:
// o painel fica baixo e sempre do mesmo tamanho, e a foto não encolhe. No computador (≥ 900 px) tudo fica à vista.
const GRUPOS = {
  'p-ajustes': [   // em famílias: luz, cor, detalhe, retrato e corte (no celular, uma linha que rola)
    { id: 'luz', n: 'Exposição', el: ['exposicao'], sec: 'Luz' },
    { id: 'brilho', n: 'Brilho', el: ['brilho'] },
    { id: 'contraste', n: 'Contraste', el: ['contraste'] },
    { id: 'realces', n: 'Realces', el: ['realces'] },
    { id: 'sombras', n: 'Sombras', el: ['sombras'] },
    { id: 'brancos', n: 'Brancos', el: ['brancos'] },
    { id: 'pretos', n: 'Pretos', el: ['pretos'] },
    { id: 'esmaecer', n: 'Esmaecer', el: ['esmaecer'] },
    { id: 'curvas', n: 'Curvas', el: ['#g_curvas'], muda: () => curvaMexida(s.curvas) },
    { id: 'calor', n: 'Calor', el: ['cenaTemp'], sec: 'Cor' },
    { id: 'matiz', n: 'Matiz', el: ['cenaMatiz'] },
    { id: 'saturacao', n: 'Saturação', el: ['saturacao'] },
    { id: 'vibracao', n: 'Vibração', el: ['vibracao'] },
    { id: 'pele', n: 'Tom de pele', el: ['pele'] },
    { id: 'hsl', n: 'Cores', el: ['#g_hsl'], muda: () => s.hsl.some((c) => c.some((x) => x)) },
    { id: 'clareza', n: 'Clareza', el: ['clareza'], sec: 'Detalhe' },
    { id: 'nitidez', n: 'Nitidez', el: ['nitidez'] },
    { id: 'vinheta', n: 'Vinheta', el: ['vinheta'] },
    { id: 'seletivo', n: 'Seletivo', el: ['#g_sel'], sec: 'Seletivo', muda: () => (s.pontos || []).length > 0 },
    ...(RETRATO ? [{ id: 'retrato', n: 'Retrato', el: ['#g_retrato'], muda: () => !!s.rosto, fam: true }] : []),
    { id: 'corte', n: 'Enquadrar', el: ['#g_corte'], muda: () => !!(s.giro || s.espelho || s.endireitar || s.corte || s.perspV || s.perspH || s.lente), sec: 'Enquadrar' },
  ],
  'p-analogico': [
    { id: 'grao', n: 'Grão', el: ['grao', 'graoTamanho', '#e_graoTipo'], sec: 'Textura', muda: () => Math.abs(s.grao - padraoDe('grao')) > 1e-6 || Math.abs(s.graoTamanho - padraoDe('graoTamanho')) > 1e-6 || s.graoTipo !== 'classico' },
    { id: 'poeira', n: 'Poeira', el: ['poeira'] },
    { id: 'halacao', n: 'Halação', el: ['halacao'], sec: 'Luz' },
    { id: 'difusao', n: 'Difusão', el: ['difusao'] },
    { id: 'luzvazada', n: 'Luz vazada', el: ['luzVazada', '#e_luzTipo'] },
    { id: 'flash', n: 'Flash', el: ['#e_flashEstilo', 'flash', 'flashAlcance', '#dicaFlash'], muda: () => s.flash > 0 },
    { id: 'ceu', n: 'Céu', el: ['amplCeu', '#dicaCeu'], sec: 'Laboratório', muda: () => s.amplCeu > 0 },
  ],
  cIntensidade: [   // aba Filmes: o que acontece COM o filme (sem filme, Puxar e Vencido agem na foto digital)
    { id: 'intensidade', n: 'Intensidade', el: ['intensidade'] },
    { id: 'puxar', n: 'Puxar', el: ['puxar'] },
    { id: 'vencido', n: 'Vencido', el: ['vencido'] },
  ],
};
const grupoAtivo = {};
function padraoDe(k) {
  const a = filmeAtual()?.meta.analogico || {};
  if (k === 'grao') return a.grao ?? 0; if (k === 'halacao') return a.halacao ?? 0; if (k === 'graoTamanho') return a.grao_tamanho ?? 1;
  return PADRAO[k] ?? 0;
}
function mudou(g) { return g.muda ? g.muda() : g.el.some((k) => k[0] !== '#' && Math.abs((s[k] ?? 0) - padraoDe(k)) > 1e-6); }
function mostraGrupo(pag, id) {
  if (pronto && foto && ['seletivo', 'flash', 'ceu', 'curvas'].includes(id) && !pc.matches) setTimeout(() => dica(id), 400);
  if (pag === 'p-ajustes' && id !== 'corte' && typeof grupoAntes !== 'undefined') grupoAntes = id;
  grupoAtivo[pag] = id;
  const p = $(pag);
  p.querySelectorAll('.grupo').forEach((g) => g.classList.toggle('on', g.dataset.g === id));
  p.querySelectorAll('.ferramentas button').forEach((b) => b.classList.toggle('on', b.dataset.g === id));
  const b = p.querySelector(`.ferramentas button[data-g="${id}"]`); if (b && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  if (typeof atualizaModos === 'function') atualizaModos();
}
for (const [pag, grupos] of Object.entries(GRUPOS)) {
  const p = $(pag), bar = document.createElement('div'); bar.className = 'ferramentas'; bar.setAttribute('role', 'tablist');
  p.querySelectorAll(':scope > .sec').forEach((e) => e.remove());   // os títulos de seção passam para dentro dos grupos
  for (const g of grupos) {
    const w = document.createElement('div'); w.className = 'grupo'; w.dataset.g = g.id;
    if (g.sec) secao(w, g.sec);
    for (const k of g.el) w.append(k[0] === '#' ? $(k.slice(1)) : $('r_' + k).parentElement);
    p.append(w);
    const b = document.createElement('button'); b.dataset.g = g.id; b.textContent = g.n; b.setAttribute('role', 'tab');
    b.onclick = () => mostraGrupo(pag, g.id);
    if ((g.sec || g.fam) && g !== grupos[0]) b.classList.add('fam');   // um respiro entre as famílias
    bar.append(b);
  }
  p.prepend(bar); mostraGrupo(pag, grupos[0].id);
}
function sincronizaFerramentas() {
  const temRetrato = RETRATO && !!filmeAtual()?.meta.retrato;
  for (const [pag, grupos] of Object.entries(GRUPOS)) {
    for (const g of grupos) {
      const b = $(pag).querySelector(`.ferramentas button[data-g="${g.id}"]`);
      b.classList.toggle('mudou', mudou(g));
      if (g.id === 'retrato' && b) b.hidden = !temRetrato;
    }
    if (grupoAtivo[pag] === 'retrato' && !temRetrato) mostraGrupo(pag, grupos[0].id);
    if (pag === 'cIntensidade') {   // sem filme não há intensidade: ficam Puxar e Vencido
      const temFilme = !!filmeAtual();
      $(pag).querySelector('.ferramentas button[data-g="intensidade"]').hidden = !temFilme;
      $(pag).querySelector('.grupo[data-g="intensidade"]').style.display = temFilme ? '' : 'none';
      if (!temFilme && grupoAtivo[pag] === 'intensidade') mostraGrupo(pag, 'puxar');
    }
  }
  if (typeof sincronizaHsl === 'function') { sincronizaHsl(); }
  if (typeof montaSel === 'function') { if (ptSel >= (s.pontos || []).length) ptSel = (s.pontos || []).length - 1; montaSel(); }
  if (typeof posicionaMira === 'function' && pronto) { posicionaMira(); posicionaPontos(); }
}

function sincroniza() {
  for (const k of Object.keys(CTL)) { const r = $('r_' + k); if (r) { r.value = s[k]; $('o_' + k).textContent = CTL[k].fmt(s[k]); } }
  document.querySelectorAll('input[type=range]').forEach(pintaBarra);
  for (const [k, ops] of [['luzTipo', LUZES], ['graoTipo', GRAOS], ['flashEstilo', FLASHES_UI]]) {
    const e = $('e_' + k); if (!e) continue;
    e.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === s[k]));
    e.querySelector('small').textContent = ops.find((l) => l.id === s[k])?.nota || '';
  }
  const f = filmeAtual();
  $('g_retrato').style.display = RETRATO && f?.meta.retrato ? '' : 'none';
  $('nRosto').textContent = marcando ? 'Desenhe em volta do rosto' : s.rosto ? 'Rosto marcado' : 'Realça o rosto';
  $('bRosto').classList.toggle('on', marcando);
  $('bRosto').textContent = s.rosto && !marcando ? 'Marcar de novo' : 'Marcar o rosto';
  anel();
  if (typeof sincronizaFerramentas === 'function') sincronizaFerramentas();
  desenhaCurva();
}

var pronto = false;   // (as ferramentas são montadas antes de tudo existir)
let aba = 'filmes';
document.querySelectorAll('.abas button').forEach((b) => b.onclick = () => {
  aba = b.dataset.p;
  document.querySelectorAll('.abas button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.pag').forEach((p) => p.classList.toggle('on', p.id === 'p-' + b.dataset.p));
  atualizaModos();
});
// modos sobre a foto: cortar (moldura com alças) e curvas (no celular, o desenho por cima da foto)
const pc = matchMedia('(min-width: 900px)');
let modoCorte = false, curvaNaFoto = false;
function atualizaModos() {
  if (!pronto) return;
  const ajustes = aba === 'ajustes' && !!foto;
  if (!pc.matches && ajustes && grupoAtivo['p-ajustes'] === 'corte' && !enquadrando) { abreEnquadrar(); return; }   // celular: tocar em Enquadrar já abre
  const corte = enquadrando && !!foto;
  const curva = !pc.matches && ajustes && grupoAtivo['p-ajustes'] === 'curvas';
  if (curva !== curvaNaFoto) { curvaNaFoto = curva; (curva ? $('palco') : gCurva).append(editorCurva); editorCurva.classList.toggle('na-foto', curva); }
  if (corte !== modoCorte) { modoCorte = corte; if (modoCorte && zoom.z > 1) { zoom.z = 1; zoom.tx = zoom.ty = 0; aplicaZoom(); } }
  desenha(); requestAnimationFrame(() => { posicionaSobreposicoes(); desenhaCurva(); });
}
pc.addEventListener?.('change', atualizaModos);

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
    const st = modoCorte && !original ? { ...s, semCorte: 1 } : s;
    const G = geometria(st, R.w, R.h, !!st.semCorte);                       // tamanho do corte (ou do quadro inteiro, enquanto corta)
    const k = Math.min((box.width - 28) / G.w, (box.height - 18) / G.h);   // tamanho na tela (CSS)
    const px = Math.min(k * dpr * zoom.z, 1);                                // pixels de verdade (mais com zoom): nunca acima da foto carregada
    const w = Math.max(1, Math.round(G.w * px)), h = Math.max(1, Math.round(G.h * px));
    R.draw(original ? st : { ...st, cortina: modoCorte ? -1 : cortina, verMasc }, w, h, Math.max(foto.bitmap.width, foto.bitmap.height), original);
    tela.style.width = Math.floor(G.w * k) + 'px'; tela.style.height = Math.floor(G.h * k) + 'px';
    anel(); posicionaSobreposicoes();
  });
}
new ResizeObserver(desenha).observe($('palco'));

// marcar o rosto: o próximo toque na foto define o centro do rosto (até a detecção automática chegar)
$('bRosto').onclick = () => { marcando = !marcando; sincroniza(); };
// marcar o rosto: arrastar o dedo em volta do rosto desenha a área (oval); um toque só marca o centro com o tamanho padrão
let risco = null;   // {x0, y0, x1, y1} em fração da foto, enquanto desenha
const fr = (e) => { const r = fotoRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
// saída (fração da foto na tela) <-> foto original (fração), pela geometria do último desenho
const paraFoto = (x, y) => { const a = R.geo?.a || [1, 0, 0, 0, 1, 0]; return [a[0] * x + a[1] * y + a[2], a[3] * x + a[4] * y + a[5]]; };
function daFoto(x, y) {
  const a = R.geo?.a || [1, 0, 0, 0, 1, 0], d = a[0] * a[4] - a[1] * a[3], X = x - a[2], Y = y - a[5];
  return [(a[4] * X - a[1] * Y) / d, (-a[3] * X + a[0] * Y) / d];
}
function escalaOval(a, b, ida) {   // meio-eixos do oval: da tela para a foto (ida) ou da foto para a tela
  const m = R.geo?.a || [1, 0, 0, 0, 1, 0], d = m[0] * m[4] - m[1] * m[3];
  const M = ida ? [m[0], m[1], m[3], m[4]] : [m[4] / d, -m[1] / d, -m[3] / d, m[0] / d];
  return [Math.hypot(M[0] * a, M[1] * b), Math.hypot(M[2] * a, M[3] * b)];
}
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
    const [x, y] = paraFoto(risco.x0, risco.y0); s.rosto = { x, y };
  } else {                     // desenho: oval que cabe no retângulo arrastado (guardado em fração da foto original)
    const [x, y] = paraFoto((risco.x0 + risco.x1) / 2, (risco.y0 + risco.y1) / 2);
    const [a, b] = escalaOval(Math.abs(risco.x1 - risco.x0) / 2, Math.abs(risco.y1 - risco.y0) / 2, true);
    s.rosto = { x, y, a, b };
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
  else if (RETRATO && foto && f?.meta.retrato && s.rosto && !original && !modoCorte) {
    const ov = ovalRosto(s.rosto, R.w, R.h, s.rostoTam), [x, y] = daFoto(s.rosto.x, s.rosto.y), [a, b] = escalaOval(ov.a, ov.b, false);
    o = { x, y, a, b };
  }
  if (!o) { a.style.display = 'none'; return; }
  Object.assign(a.style, { display: 'block', left: (r.left - p.left + (o.x - o.a) * r.width) + 'px', top: (r.top - p.top + (o.y - o.b) * r.height) + 'px',
    width: 2 * o.a * r.width + 'px', height: 2 * o.b * r.height + 'px' });
}

// ------------------------------------------------------------ mira: o assunto (Flash e Ampliação) e a linha do horizonte
const mira = document.createElement('div'); mira.id = 'mira';
mira.innerHTML = '<div class="horizonte"><span>horizonte</span></div><div class="alvo"></div>';
$('palco').append(mira);
let miraAtiva = false, horAtivo = false, alvoAtivo = false;
function atualizaMira() {
  const ga = grupoAtivo['p-analogico'], noAnalog = aba === 'analogico' && !!foto && !modoCorte && !enquadrando;
  const usaFlash = pc.matches ? s.flash > 0 : ga === 'flash', usaCeu = pc.matches ? s.amplCeu > 0 : ga === 'ceu';
  miraAtiva = noAnalog && (usaFlash || usaCeu) && !(cortina >= 0);
  horAtivo = miraAtiva && usaCeu; alvoAtivo = miraAtiva && usaFlash;
}
// o círculo mostra o tamanho real do efeito: na Ampliação, onde a máscara cai pela metade; no Flash, onde a luz cai pela metade
function raioMira(r) {   // o alcance do flash (onde a luz cai pela metade)
  const m = Math.min(r.width, r.height), fe = { anos90: 1, digital: 1.25, festa: 0.85 }[s.flashEstilo] || 1;
  return (0.2 + 0.55 * (s.flashAlcance ?? 0.5)) * fe * 0.6 * m;
}
function tamDeRaio(rp, r) {   // o inverso: raio na tela -> controle (0..1)
  const m = Math.min(r.width, r.height), fe = { anos90: 1, digital: 1.25, festa: 0.85 }[s.flashEstilo] || 1;
  return ['flashAlcance', Math.min(1, Math.max(0, (rp / (0.6 * m * fe) - 0.2) / 0.55))];
}
function posicionaMira() {
  atualizaMira();
  mira.style.display = miraAtiva ? 'block' : 'none';
  if (!miraAtiva) return;
  const p = $('palco').getBoundingClientRect(), r = fotoRect(), a = s.assunto || { x: 0.5, y: 0.5 };
  Object.assign(mira.style, { left: r.left - p.left + 'px', top: r.top - p.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const rp = raioMira(r);
  Object.assign(mira.querySelector('.alvo').style, { display: alvoAtivo ? '' : 'none', left: a.x * 100 + '%', top: a.y * 100 + '%', width: 2 * rp + 'px', height: 2 * rp + 'px', margin: -rp + 'px' });
  const h = mira.querySelector('.horizonte'); h.style.display = horAtivo ? 'block' : 'none'; h.style.top = (s.horizonte ?? 0.42) * 100 + '%';
}
{
  // um dedo: tocar ou arrastar move o assunto; perto da borda do círculo, arrastar muda o tamanho (como no Snapseed);
  // perto da linha do horizonte, arrasta o horizonte. Dois dedos: pinça muda o tamanho.
  let arr = null; const toques = new Map(); let pinca2 = null;
  const fr2 = (e) => { const r = mira.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), r]; };
  const centroPx = (r) => { const a = s.assunto || { x: 0.5, y: 0.5 }; return [r.left + a.x * r.width, r.top + a.y * r.height]; };
  const mudaTam = (rp, r) => { const [k, v] = tamDeRaio(rp, r); s[k] = v; sincroniza(); posicionaMira(); desenha(); };
  mira.addEventListener('pointerdown', (e) => {
    if (!miraAtiva) return;
    e.preventDefault(); e.stopPropagation(); mira.setPointerCapture?.(e.pointerId);
    toques.set(e.pointerId, [e.clientX, e.clientY]);
    const [x, y, r] = fr2(e);
    if (toques.size === 2) {   // pinça
      const [p1, p2] = [...toques.values()]; pinca2 = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), rp: raioMira(r) }; arr = null; return;
    }
    const [cx, cy] = centroPx(r), dc = Math.hypot(e.clientX - cx, e.clientY - cy), rp = raioMira(r);
    const pertoHor = horAtivo && Math.abs(y - (s.horizonte ?? 0.42)) * r.height < 22;
    if (alvoAtivo && Math.hypot(e.clientX - (cx + rp), e.clientY - cy) < 22) arr = 'tam';   // só pela alça (ou pinça): tocar na borda move o assunto
    else if (pertoHor || !alvoAtivo) arr = horAtivo ? 'h' : null;
    else { arr = 'a'; s.assunto = { x, y }; }
    if (arr === 'h') s.horizonte = Math.min(0.95, Math.max(0.05, y));
    posicionaMira(); desenha();
  });
  mira.addEventListener('pointermove', (e) => {
    if (!toques.has(e.pointerId)) return; e.stopPropagation();
    toques.set(e.pointerId, [e.clientX, e.clientY]);
    const [x, y, r] = fr2(e);
    if (pinca2 && toques.size === 2) { const [p1, p2] = [...toques.values()]; mudaTam(pinca2.rp * Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) / pinca2.d, r); return; }
    if (!arr) return;
    if (arr === 'tam') { const [cx, cy] = centroPx(r); mudaTam(Math.hypot(e.clientX - cx, e.clientY - cy), r); return; }
    if (arr === 'h') s.horizonte = Math.min(0.95, Math.max(0.05, y)); else s.assunto = { x, y };
    posicionaMira(); desenha();
  });
  mira.addEventListener('mousemove', (e) => {
    if (toques.size) return; const r = mira.getBoundingClientRect(), [cx, cy] = centroPx(r);
    mira.style.cursor = alvoAtivo && Math.hypot(e.clientX - (cx + raioMira(r)), e.clientY - cy) < 22 ? 'ew-resize' : horAtivo && Math.abs((e.clientY - r.top) / r.height - (s.horizonte ?? 0.42)) * r.height < 22 ? 'ns-resize' : 'crosshair';
  });
  const fim = (e) => { toques.delete(e.pointerId); if (toques.size < 2) pinca2 = null; if (!arr && toques.size) return; arr = null; memoriza(); };
  mira.addEventListener('pointerup', fim); mira.addEventListener('pointercancel', fim);
}

// ------------------------------------------------------------ pontos do Seletivo sobre a foto
// celular: com o Seletivo escolhido, tocar num lugar vazio cria um ponto (até 4); computador: "+ Ponto" e clicar na foto.
// Tocar num ponto o escolhe; arrastar move; puxar a borda (ou pinça) muda o tamanho; enquanto mexe, a área fica vermelha.
const pontosEl = document.createElement('div'); pontosEl.id = 'pontos'; $('palco').append(pontosEl);
let pontosAtivos = false;
function atualizaPontos() {
  const aj = aba === 'ajustes' && !!foto && !modoCorte && !enquadrando && !(cortina >= 0) && !curvaNaFoto;
  pontosAtivos = aj && (pc.matches ? ((s.pontos || []).length > 0 || novoPonto) : grupoAtivo['p-ajustes'] === 'seletivo');
}
const raioPonto = (pt, r) => (0.06 + 0.44 * (pt.tam ?? 0.4)) * 1.3 * Math.min(r.width, r.height);
function posicionaPontos() {
  atualizaPontos();
  pontosEl.style.display = pontosAtivos ? 'block' : 'none'; if (!pontosAtivos) return;
  const p = $('palco').getBoundingClientRect(), r = fotoRect();
  Object.assign(pontosEl.style, { left: r.left - p.left + 'px', top: r.top - p.top + 'px', width: r.width + 'px', height: r.height + 'px', cursor: novoPonto ? 'crosshair' : 'default' });
  pontosEl.innerHTML = (s.pontos || []).map((pt, i) => {
    const sel = i === ptSel, rp = raioPonto(pt, r);
    return `<div class="pt${sel ? ' sel' : ''}" style="left:${pt.x * 100}%;top:${pt.y * 100}%">${sel ? `<i class="aro" style="width:${2 * rp}px;height:${2 * rp}px;margin:${-rp}px"></i>` : ''}<b>${i + 1}</b></div>`;
  }).join('');
}
{
  let arr = null; const toques = new Map(); let pinca3 = null;
  const pos = (e) => { const r = pontosEl.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), r]; };
  const centro = (pt, r) => [r.left + pt.x * r.width, r.top + pt.y * r.height];
  const muda = (i, campos) => { s.pontos = s.pontos.map((p, j) => (j === i ? { ...p, ...campos } : p)); };
  pontosEl.addEventListener('pointerdown', (e) => {
    if (!pontosAtivos) return;
    e.preventDefault(); e.stopPropagation(); pontosEl.setPointerCapture?.(e.pointerId);
    toques.set(e.pointerId, [e.clientX, e.clientY]);
    const [x, y, r] = pos(e), pts = s.pontos || [];
    if (toques.size === 2 && ptSel >= 0) { const [a, b] = [...toques.values()]; pinca3 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), tam: pts[ptSel].tam ?? 0.4 }; arr = null; return; }
    // perto do centro de um ponto: escolhe e arrasta; na borda do escolhido: tamanho; vazio: cria (celular ou "+ Ponto")
    const perto = pts.findIndex((pt) => { const [cx, cy] = centro(pt, r); return Math.hypot(e.clientX - cx, e.clientY - cy) < 24; });
    if (ptSel >= 0 && pts[ptSel] && perto !== ptSel) {
      // o tamanho muda só pela alça (o pontinho branco à direita do aro) ou pela pinça: tocar na borda não cria confusão
      const [cx, cy] = centro(pts[ptSel], r); if (Math.hypot(e.clientX - (cx + raioPonto(pts[ptSel], r)), e.clientY - cy) < 22) { arr = 'tam'; verMasc = ptSel; desenha(); return; }
    }
    if (perto >= 0) { ptSel = perto; arr = 'mover'; verMasc = ptSel; }
    else if ((celular() || novoPonto) && pts.length < 4) {
      s.pontos = [...pts, { x, y, tam: 0.4, luz: 0, contraste: 0, sat: 0, calor: 0, estrutura: 0, entorno: 0 }]; ptSel = s.pontos.length - 1;
      novoPonto = false; arr = 'mover'; verMasc = ptSel; sincronizaFerramentas();
    } else { ptSel = -1; arr = null; }
    montaSel(); posicionaPontos(); desenha();
  });
  pontosEl.addEventListener('pointermove', (e) => {
    if (!toques.has(e.pointerId)) return; e.stopPropagation();
    toques.set(e.pointerId, [e.clientX, e.clientY]);
    const [x, y, r] = pos(e);
    if (pinca3 && toques.size === 2 && ptSel >= 0) { const [a, b] = [...toques.values()]; muda(ptSel, { tam: Math.min(1, Math.max(0, pinca3.tam + (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinca3.d - 1) * 0.6)) }); verMasc = ptSel; posicionaPontos(); desenha(); return; }
    if (arr === 'mover') muda(ptSel, { x, y });
    else if (arr === 'tam') { const [cx, cy] = centro(s.pontos[ptSel], r), d = Math.hypot(e.clientX - cx, e.clientY - cy); muda(ptSel, { tam: Math.min(1, Math.max(0, (d / (1.3 * Math.min(r.width, r.height)) - 0.06) / 0.44)) }); }
    else return;
    posicionaPontos(); desenha();
  });
  const fim = (e) => { toques.delete(e.pointerId); if (toques.size < 2) pinca3 = null; if (toques.size) return; const mexeu = arr || verMasc >= 0; arr = null; verMasc = -1; desenha(); if (mexeu) memoriza(); };
  pontosEl.addEventListener('pointerup', fim); pontosEl.addEventListener('pointercancel', fim);
}

// ------------------------------------------------------------ moldura do corte sobre a foto (alças nos cantos e lados; arrastar dentro move)
const moldCorte = document.createElement('div'); moldCorte.id = 'moldCorte';
moldCorte.innerHTML = '<div class="caixa"><i class="t1"></i><i class="t2"></i><i class="t3"></i><i class="t4"></i>' + ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((h) => `<b data-h="${h}"></b>`).join('') + '</div>';
$('palco').append(moldCorte);
function posicionaSobreposicoes() {
  posicionaMira(); if (typeof posicionaPontos === 'function') posicionaPontos(); if (typeof posicionaCortina === 'function') posicionaCortina();
  const p = $('palco').getBoundingClientRect(), r = fotoRect();
  moldCorte.style.display = modoCorte && foto ? 'block' : 'none';
  if (modoCorte && foto) {
    Object.assign(moldCorte.style, { left: r.left - p.left + 'px', top: r.top - p.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    const c = encaixa(s, R.w, R.h, s.corte || { x: 0, y: 0, w: 1, h: 1 });
    Object.assign(moldCorte.firstChild.style, { left: c.x * 100 + '%', top: c.y * 100 + '%', width: c.w * 100 + '%', height: c.h * 100 + '%' });
    moldCorte.firstChild.classList.toggle('fina', ferrEnq !== 'cortar');
  }
  if (curvaNaFoto) {
    Object.assign(editorCurva.style, { left: r.left - p.left + 'px', top: r.top - p.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  } else Object.assign(editorCurva.style, { left: '', top: '', width: '', height: '' });
}
{
  let arr = null;
  moldCorte.addEventListener('pointerdown', (e) => {
    if (!modoCorte) return;
    e.preventDefault(); e.stopPropagation(); moldCorte.setPointerCapture?.(e.pointerId);
    const h = e.target.dataset?.h || (e.target.closest('.caixa') ? 'm' : null); if (!h) return;
    arr = { h, x: e.clientX, y: e.clientY, c: encaixa(s, R.w, R.h, s.corte || { x: 0, y: 0, w: 1, h: 1 }) };
  });
  moldCorte.addEventListener('pointermove', (e) => {
    if (!arr) return; e.stopPropagation();
    const r = moldCorte.getBoundingClientRect(), dx = (e.clientX - arr.x) / r.width, dy = (e.clientY - arr.y) / r.height, c0 = arr.c, h = arr.h;
    const k = razao(s.proporcao || 'livre'), [QW, QH] = quadroGirado(s, R.w, R.h), kf = k ? k * QH / QW : 0;   // proporção em fração do quadro
    let { x, y, w, h: hh } = c0; const MIN = 0.06;
    if (h === 'm') { x = Math.min(1 - w, Math.max(0, x + dx)); y = Math.min(1 - hh, Math.max(0, y + dy)); }
    else {
      let x1 = x + w, y1 = y + hh;
      if (h.includes('w')) x = Math.min(x1 - MIN, Math.max(0, x + dx));
      if (h.includes('e')) x1 = Math.max(x + MIN, Math.min(1, x1 + dx));
      if (h.includes('n')) y = Math.min(y1 - MIN, Math.max(0, y + dy));
      if (h.includes('s')) y1 = Math.max(y + MIN, Math.min(1, y1 + dy));
      w = x1 - x; hh = y1 - y;
      if (kf) {   // proporção travada: o lado que você puxa manda, o outro acompanha
        if (h === 'n' || h === 's') { const nw = hh * kf, cx = c0.x + c0.w / 2; w = nw; x = cx - nw / 2; }
        else if (h === 'e' || h === 'w') { const nh = w / kf, cy = c0.y + c0.h / 2; hh = nh; y = cy - nh / 2; }
        else { hh = w / kf; if (h.includes('n')) y = y1 - hh; }
        if (x < 0 || y < 0 || x + w > 1 || y + hh > 1) return;
      }
    }
    const nc = { x, y, w, h: hh };
    if (!dentro(s, R.w, R.h, nc)) return;   // não sai da foto endireitada
    s.corte = nc; if (h !== 'm' && !kf && s.proporcao !== 'livre') s.proporcao = 'livre';
    posicionaSobreposicoes();
  });
  const fim = () => { if (!arr) return; arr = null; if (enquadrando) { montaEnq(); desenha(); } else { sincroniza(); desenha(); memoriza(); } };
  moldCorte.addEventListener('pointerup', fim); moldCorte.addEventListener('pointercancel', fim);
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
  if (modoCorte) return;
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
  if (!foto || modoCorte) return; e.preventDefault();
  const c = centro(), z0 = zoom.z, z = Math.min(4, Math.max(1, z0 * Math.exp(-e.deltaY * 0.0015))), k = z / z0;
  zoom.tx = e.clientX - (c[0] - zoom.tx) - (e.clientX - c[0]) * k; zoom.ty = e.clientY - (c[1] - zoom.ty) - (e.clientY - c[1]) * k;
  zoom.z = z; aplicaZoom(); clearTimeout(zoom.t); zoom.t = setTimeout(desenha, 120);
}, { passive: false });
$('palco').addEventListener('dblclick', () => { if (zoom.z > 1) zeraZoom(); });

// comparar: segurar o botão (ou a foto) mostra a original
const segura = (el) => {
  const on = (e) => { if (!foto || marcando || modoCorte || (el === tela && (zoom.z > 1 || dedos.size > 1))) return; e.preventDefault(); original = true; $('selo').style.display = 'block'; desenha(); };
  const off = () => { if (!original) return; original = false; $('selo').style.display = 'none'; desenha(); };
  el.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, off);
};
segura(tela);
// botão comparar: segurar mostra a original inteira; um toque rápido liga a cortina (antes | depois, arrastando a linha)
let cortina = -1;
{
  const b = $('bComparar'); let tm = 0, segurou = false;
  b.addEventListener('pointerdown', (e) => {
    if (!foto || modoCorte) return; e.preventDefault(); segurou = false;
    tm = setTimeout(() => { segurou = true; original = true; $('selo').style.display = 'block'; desenha(); }, 230);
  });
  const solta = (ev) => {
    clearTimeout(tm);
    if (segurou) { segurou = false; original = false; $('selo').style.display = 'none'; desenha(); return; }
    if (ev.type === 'pointerup' && foto && !modoCorte) { cortina = cortina < 0 ? 0.5 : -1; b.classList.toggle('on', cortina >= 0); posicionaCortina(); desenha(); }
  };
  b.addEventListener('pointerup', solta); b.addEventListener('pointerleave', (e) => { if (segurou) solta(e); else clearTimeout(tm); }); b.addEventListener('pointercancel', solta);
}
const cortinaEl = document.createElement('div'); cortinaEl.id = 'cortina';
cortinaEl.innerHTML = '<span class="ant">ORIGINAL</span><span class="dep">REVELA</span><i></i>'; $('palco').append(cortinaEl);
function posicionaCortina() {
  const on = cortina >= 0 && foto && !modoCorte;
  cortinaEl.style.display = on ? 'block' : 'none'; if (!on) return;
  const p = $('palco').getBoundingClientRect(), r = fotoRect();
  Object.assign(cortinaEl.style, { left: r.left - p.left + 'px', top: r.top - p.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  cortinaEl.querySelector('i').style.left = cortina * 100 + '%';
}
{
  let arr = false;
  const pos = (e) => { const r = cortinaEl.getBoundingClientRect(); cortina = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); posicionaCortina(); desenha(); };
  cortinaEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); arr = true; cortinaEl.setPointerCapture?.(e.pointerId); pos(e); });
  cortinaEl.addEventListener('pointermove', (e) => { if (arr) { e.stopPropagation(); pos(e); } });
  const fim = () => { arr = false; }; cortinaEl.addEventListener('pointerup', fim); cortinaEl.addEventListener('pointercancel', fim);
}

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
    s = { ...anterior, semente: s.semente, rosto: null, ...Object.fromEntries(POR_FOTO.map((k) => [k, PADRAO[k]])) };   // o rosto e o corte são de outra foto
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
    s = { ...PADRAO, semente: Math.random() }; ptSel = -1; novoPonto = false; marcando = false; if (enquadrando) { enquadrando = false; document.body.classList.remove('enquadrando'); } R.setFilm(null); zoom.z = 1; zoom.tx = zoom.ty = 0; aplicaZoom();
    perguntaRepetir(anterior);
    tela.style.display = 'block'; $('vazio').style.display = 'none'; document.body.classList.add('com-foto');
    for (const id of ['bComparar', 'bExportar', 'bLote']) $(id).disabled = false;
    montaFaixa(); sincroniza(); atualizaNota(); atualizaModos(); desenha(); hist = []; hi = -1; memoriza();
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

// revela uma foto em tamanho real com a edição st e devolve o arquivo (JPEG, ou PNG sem perda)
// limite de pixels da imagem final: o Safari (iPhone/iPad) não gera imagens acima de ~16,7 MP (sai em branco ou trava);
// nos outros, a placa de vídeo do aparelho decide, e conferimos depois de desenhar
const ehIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const MAX_PIX = ehIOS ? 16e6 : 64e6;
async function revela(E, bitmap, st, nome, fmt = 'jpeg') {
  let lado = Math.min(E.maxTex, 8192);
  const prop = Math.max(bitmap.width, bitmap.height) / Math.min(bitmap.width, bitmap.height);
  lado = Math.min(lado, Math.floor(Math.sqrt(MAX_PIX * prop)));   // o lado maior que cabe no limite de pixels
  let src = reduz(bitmap, lado);
  E.setImage(src); E.setFilm(filmeAtual());
  let G = geometria(st, src.width, src.height), W = Math.max(1, Math.round(G.w)), H = Math.max(1, Math.round(G.h));
  E.draw(st, W, H, Math.max(bitmap.width, bitmap.height));
  // a placa de vídeo pode aceitar menos do que pedimos (sem avisar): se for o caso, reduz só o necessário e desenha de novo
  const gl = E.gl;
  if (gl.drawingBufferWidth < W || gl.drawingBufferHeight < H) {
    const k = Math.min(gl.drawingBufferWidth / W, gl.drawingBufferHeight / H) * 0.98;
    src = reduz(bitmap, Math.floor(Math.max(src.width, src.height) * k));
    E.setImage(src); G = geometria(st, src.width, src.height); W = Math.max(1, Math.round(G.w)); H = Math.max(1, Math.round(G.h));
    E.draw(st, W, H, Math.max(bitmap.width, bitmap.height));
  }
  const png = fmt === 'png', tipo = png ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((r) => E.canvas.toBlob(r, tipo, png ? undefined : 0.95));
  return new File([blob], `${nome}_revela${st.filme ? '_' + st.filme : ''}.${png ? 'png' : 'jpg'}`, { type: tipo });
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
// exportar: escolher o formato (JPEG ou PNG) e o destino: salvar no aparelho ou compartilhar com outro app
// (Instagram, WhatsApp, e-mail…, pelo menu do próprio sistema). O Revela entrega a foto; para onde ela vai é escolha sua.
const nativo = () => !!window.Capacitor?.isNativePlatform?.();
const podeCompartilhar = () => nativo() || !!navigator.canShare?.({ files: [new File([new Blob(['x'], { type: 'image/jpeg' })], 'x.jpg', { type: 'image/jpeg' })] });
let formato = 'jpeg'; try { formato = localStorage.getItem('revela.formato') === 'png' ? 'png' : 'jpeg'; } catch { /* sem armazenamento */ }
$('bExportar').onclick = () => {
  if (!foto) return;
  const G = geometria(s, foto.bitmap.width, foto.bitmap.height), W = Math.round(G.w), H = Math.round(G.h);
  folha(`<div class="ficha"><h3>Exportar</h3><p class="alma">${W} × ${H} pixels, o tamanho real da foto. Sai sem a localização (GPS) e sem nada além da imagem.</p>
    <div class="formatos" role="radiogroup" aria-label="Formato">
      <button role="radio" data-f="jpeg"><b>JPEG</b><small>leve, para postar e mandar</small></button>
      <button role="radio" data-f="png"><b>PNG</b><small>sem perda, para guardar e imprimir</small></button>
    </div>
    <div class="botoes">${podeCompartilhar() ? '<button class="comp">Compartilhar…</button>' : ''}<button class="pri salva">Salvar</button></div></div>`);
  const marca = () => folhaEl.querySelectorAll('.formatos button').forEach((b) => { b.classList.toggle('on', b.dataset.f === formato); b.setAttribute('aria-checked', b.dataset.f === formato); });
  folhaEl.querySelectorAll('.formatos button').forEach((b) => b.onclick = () => { formato = b.dataset.f; try { localStorage.setItem('revela.formato', formato); } catch { /* ok */ } marca(); });
  marca();
  folhaEl.querySelector('.salva').onclick = () => { fechaFolha(); exporta('salvar'); };
  const c = folhaEl.querySelector('.comp'); if (c) c.onclick = () => { fechaFolha(); exporta('compartilhar'); };
};
async function exporta(destino) {
  aviso('Revelando em tamanho real…');
  try {
    const c = document.createElement('canvas'), E = new Render(c, { preserve: true });
    const arq = await revela(E, foto.bitmap, s, foto.nome, formato);
    const W = c.width, H = c.height;
    E.gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (destino === 'compartilhar') await compartilha([arq]); else { await salva([arq]); }
    if (destino !== 'compartilhar') aviso(nativo() ? 'Salvo em Imagens › Revela' : `Foto salva (${W}×${H}, ${formato.toUpperCase()})`);
  } catch (err) { console.error(err); aviso('Falha ao exportar: ' + err.message); }
}
// salvar: app Android grava em Imagens › Revela; no navegador, baixa o arquivo
async function salva(arqs) {
  if (nativo()) { for (const a of arqs) await salvaNoAparelho(a); return; }
  for (const a of arqs) {
    const l = document.createElement('a'); l.href = URL.createObjectURL(a); l.download = a.name; l.click();
    setTimeout(() => URL.revokeObjectURL(l.href), 4000); await new Promise((r) => setTimeout(r, 350));
  }
}
// compartilhar: o menu do sistema (Instagram, WhatsApp, e-mail, Drive…); se não der, salva
async function compartilha(arqs) {
  if (nativo()) {
    const C = window.Capacitor, P = C.Plugins || {};
    const Filesystem = P.Filesystem || C.registerPlugin('Filesystem'), Share = P.Share || C.registerPlugin('Share');
    const uris = [];
    for (const a of arqs) {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(a); });
      uris.push((await Filesystem.writeFile({ path: a.name, data, directory: 'CACHE' })).uri);
    }
    try { await Share.share({ title: 'Revela', files: uris }); } catch { aviso('Compartilhamento cancelado'); }
    return;
  }
  if (navigator.canShare?.({ files: arqs })) {
    try { await navigator.share({ files: arqs }); return; } catch (e) { if (e?.name === 'AbortError') { aviso('Compartilhamento cancelado'); return; } }
  }
  await salva(arqs);
}

// ------------------------------------------------------------ várias fotos (como no Lightroom: a mesma edição numa série)
$('bLote').onclick = () => $('lote').click();
$('lote').addEventListener('change', async (e) => {
  const fs = [...e.target.files].filter(isImageFile); e.target.value = '';
  if (!fs.length) return;
  const st = { ...s, rosto: null, ...Object.fromEntries(POR_FOTO.map((k) => [k, PADRAO[k]])) };   // o rosto e o corte são desta foto
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
// dicas de primeira vez: uma frase curta na primeira vez que a pessoa encontra um gesto escondido; depois nunca mais
const DICAS = {
  ficha: 'Toque e segure um filme ou receita para ver a ficha dele',
  comparar: 'Um toque em comparar mostra o antes e o depois lado a lado; segure para ver a original',
  seletivo: 'Toque na foto para criar um ponto · a alça branca do círculo muda o tamanho',
  flash: 'Toque no assunto para mirar o flash · a alça do círculo muda o alcance',
  ceu: 'Arraste a linha do horizonte · o que não é céu fica protegido',
  minhas: 'Salve a edição de agora e use em outras fotos · toque e segure para copiar o código',
  curvas: 'Toque na curva para criar um ponto · dois toques apagam o ponto',
};
const lerDicas = () => { try { return JSON.parse(localStorage.getItem('revela.dicas') || '{}'); } catch { return {}; } };
function dica(k) {
  let vistas = {}; try { vistas = JSON.parse(localStorage.getItem('revela.dicas') || '{}'); } catch { /* sem armazenamento: mostra mesmo assim */ }
  if (vistas[k] || !DICAS[k]) return;
  vistas[k] = 1; try { localStorage.setItem('revela.dicas', JSON.stringify(vistas)); } catch { /* ok */ }
  const d = $('dica') || Object.assign(document.createElement('div'), { id: 'dica' }); if (!d.parentElement) $('palco').append(d);
  d.innerHTML = `<span>${DICAS[k]}</span><button aria-label="Entendi">Entendi</button>`; d.classList.add('on');
  const fecha = () => d.classList.remove('on'); d.querySelector('button').onclick = fecha;
  clearTimeout(d._t); d._t = setTimeout(fecha, 7000);
}
function aviso(t) {
  const a = $('aviso'); a.textContent = t; a.style.opacity = t ? 1 : 0;
  clearTimeout(tAviso); if (t) tAviso = setTimeout(() => (a.style.opacity = 0), 2600);
}

// ------------------------------------------------------------ início
pronto = true;
carregaFilmes().then(() => {
  montaCats(); montaFaixa(); sincroniza(); atualizaNota();   // começa sem filme: nada é aplicado antes de você escolher
}).catch((e) => { console.error(e); aviso('Não consegui carregar os filmes.'); });
