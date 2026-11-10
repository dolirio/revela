// Receitas de filme no estilo "receita de câmera": poucos parâmetros em passos inteiros,
// como nos menus de simulação de filme das câmeras. Nomes e valores são do Revela.

// Campos do editor. opts = lista de opções; senão min/max/step numéricos.
export const RECIPE_FIELDS = [
  { k: 'film', n: 'Filme', type: 'film', group: 'Base' },
  { k: 'mix', n: 'Intensidade', min: 0, max: 100, step: 10, unit: '%' },
  { k: 'expo', n: 'Exposição', min: -2, max: 2, step: 1 / 3, fmt: 'ev' },
  { k: 'grain', n: 'Grão', opts: ['Desligado', 'Fraco', 'Médio', 'Forte'], group: 'Textura' },
  { k: 'gsize', n: 'Tamanho do grão', opts: ['Fino', 'Médio', 'Grosso'] },
  { k: 'gcolor', n: 'Grão de cor', opts: ['Não', 'Sim'] },
  { k: 'sharp', n: 'Nitidez', min: -4, max: 4, step: 1 },
  { k: 'clarity', n: 'Claridade', min: -5, max: 5, step: 1 },
  { k: 'halo', n: 'Halação', opts: ['Desligado', 'Fraco', 'Forte'] },
  { k: 'bloom', n: 'Difusão', opts: ['Desligado', 'Fraco', 'Forte'] },
  { k: 'paper', n: 'Papel', opts: ['Desligado', 'Fraco', 'Forte'] },
  { k: 'hl', n: 'Realces', min: -2, max: 4, step: 0.5, group: 'Tom e cor' },
  { k: 'sh', n: 'Sombras', min: -2, max: 4, step: 0.5 },
  { k: 'color', n: 'Cor', min: -4, max: 4, step: 1 },
  { k: 'depth', n: 'Cor profunda', opts: ['Desligado', 'Fraco', 'Forte'] },
  { k: 'wbR', n: 'Desvio vermelho', min: -9, max: 9, step: 1 },
  { k: 'wbB', n: 'Desvio azul', min: -9, max: 9, step: 1 },
  { k: 'fade', n: 'Desbotado', opts: ['Desligado', 'Fraco', 'Forte'] },
  { k: 'vig', n: 'Vinheta', opts: ['Desligado', 'Fraca', 'Forte'] },
];

export function blankSpec(film = 'none') {
  return {
    film, mix: 100, expo: 0, grain: 0, gsize: 0, gcolor: 0, sharp: 0, clarity: 0, halo: 0, bloom: 0, paper: 0,
    hl: 0, sh: 0, color: 0, depth: 0, wbR: 0, wbB: 0, fade: 0, vig: 0,
  };
}

// Converte a receita em parâmetros de edição
export function specToState(sp) {
  const p = { ...blankSpec(), ...sp };
  const pick = (arr, i) => arr[Math.max(0, Math.min(arr.length - 1, i | 0))];
  return {
    look: p.film, mix: p.mix / 100, exp: p.expo,
    grain: pick([0, 0.32, 0.58, 0.9], p.grain),
    gsize: pick([1.25, 1.75, 2.5], p.gsize),
    grough: pick([0.25, 0.45, 0.75], p.gsize),
    gcolor: p.gcolor ? 0.35 : 0,
    sharp: p.sharp > 0 ? p.sharp * 0.13 : p.sharp * 0.11,   // negativo = desfoque
    clar: p.clarity * 0.08,
    halo: pick([0, 0.22, 0.5], p.halo),
    bloom: pick([0, 0.22, 0.5], p.bloom),
    paper: pick([0, 0.4, 0.8], p.paper),
    high: p.hl * 0.11,
    shad: -p.sh * 0.11,
    sat: p.color * 0.07,
    depth: pick([0, 0.4, 0.8], p.depth),
    temp: (p.wbR - p.wbB) * 0.028,
    tint: (p.wbR + p.wbB) * 0.022,
    fade: pick([0, 0.22, 0.45], p.fade),
    vig: pick([0, 0.22, 0.45], p.vig),
  };
}

export function fmtField(f, v) {
  if (f.opts) return f.opts[v] ?? f.opts[0];
  if (f.unit === '%') return `${Math.round(v)}%`;
  if (f.fmt === 'ev') {
    const t = Math.round(v * 3);
    if (!t) return '0';
    const sign = t > 0 ? '+' : '−', a = Math.abs(t), whole = Math.floor(a / 3), frac = a % 3;
    return sign + (whole ? String(whole) : '') + (frac ? `${whole ? ' ' : ''}${frac}/3` : '');
  }
  const r = Math.round(v * 10) / 10;
  return r > 0 ? `+${r}` : r < 0 ? `−${Math.abs(r)}` : '0';
}

// Receitas clássicas do Revela: cada uma recria a sensação de um tipo de filme analógico,
// sem copiar nomes ou receitas de terceiros.
export const CLASSICS = [
  { id: 'c_domingo', name: 'Domingo no Parque', note: 'Negativo de consumo quente, grão fino, dia de sol.',
    spec: { film: 'ambar200', grain: 1, gsize: 0, hl: 0.5, sh: 0.5, color: 1, wbR: 2, wbB: -3, halo: 1 } },
  { id: 'c_retrato', name: 'Retrato de Estúdio', note: 'Pele suave, contraste baixo, grão quase invisível.',
    spec: { film: 'retrato160', grain: 1, gsize: 0, sharp: -1, hl: -1, sh: -0.5, color: -1, wbR: 1, wbB: -1 } },
  { id: 'c_viagem', name: 'Slide de Viagem', note: 'Cromo saturado, céu denso, sem grão aparente.',
    spec: { film: 'vivido50', expo: -1 / 3, grain: 0, sharp: 1, hl: 1, sh: 1, color: 1, depth: 2, wbB: 1 } },
  { id: 'c_cromo', name: 'Cromo Clássico', note: 'Contraste firme de diapositivo, cores profundas.',
    spec: { film: 'cromo64', grain: 1, gsize: 0, hl: 0.5, sh: 1.5, color: 0, depth: 1, vig: 1 } },
  { id: 'c_praia', name: 'Férias de 1995', note: 'Filme de supermercado, amarelos vivos, cópia de laboratório.',
    spec: { film: 'praia200', grain: 2, gsize: 1, hl: 1, sh: 0.5, color: 1, wbR: 1, wbB: -2, paper: 1, fade: 1 } },
  { id: 'c_cais', name: 'Porto Cinza', note: 'Negativo pastel e frio para dias nublados.',
    spec: { film: 'cais400', grain: 2, gsize: 1, hl: -0.5, sh: -1, color: -1, wbR: -1, wbB: 1, fade: 1 } },
  { id: 'c_noite', name: 'Noite na Cidade', note: 'Alta sensibilidade, halação nas luzes de rua.',
    spec: { film: 'noturno800', expo: 1 / 3, grain: 3, gsize: 2, gcolor: 1, halo: 2, bloom: 1, hl: 1, sh: 1, color: 1, vig: 1 } },
  { id: 'c_cinema', name: 'Cinema Tungstênio', note: 'Filme de cinema em luz do dia: frio, brilho difuso.',
    spec: { film: 'tungst500', grain: 2, gsize: 1, halo: 1, bloom: 1, hl: -0.5, sh: 0.5, color: -1, wbR: -1 } },
  { id: 'c_verao', name: 'Verão Desbotado', note: 'Luz forte, cores lavadas, sombras abertas.',
    spec: { film: 'sal', expo: 1 / 3, grain: 1, gsize: 1, hl: -1, sh: -2, color: -1, wbR: 2, wbB: -2, fade: 2 } },
  { id: 'c_vencido', name: 'Rolo Esquecido', note: 'Filme vencido: base magenta, pretos lavados, grão grosso.',
    spec: { film: 'vencido', expo: 2 / 3, grain: 3, gsize: 2, gcolor: 1, sharp: -1, hl: -1, sh: -1, color: -1, fade: 2, vig: 1 } },
  { id: 'c_album', name: 'Álbum de Família', note: 'Cópia antiga em papel, cores amareladas.',
    spec: { film: 'arquivo70', grain: 2, gsize: 1, sharp: -2, hl: -1, sh: 0.5, paper: 2, fade: 1, vig: 1 } },
  { id: 'c_instant', name: 'Instantânea', note: 'Revelação instantânea: suave, pálida, sombras magenta.',
    spec: { film: 'polar', grain: 1, gsize: 1, sharp: -2, bloom: 1, hl: -1, sh: -1, paper: 1, vig: 1 } },
  { id: 'c_cruzado', name: 'Processo Cruzado', note: 'Cores trocadas e contraste duro, efeito anos 90.',
    spec: { film: 'cruzado', grain: 2, gsize: 1, hl: 1, sh: 1, color: 1, vig: 2 } },
  { id: 'c_prata', name: 'Prata Fina', note: 'P&B de grão fino e tons médios ricos.',
    spec: { film: 'prata100', grain: 1, gsize: 0, sharp: 1, hl: 0.5, sh: 0.5 } },
  { id: 'c_rua', name: 'Rua 400', note: 'P&B de reportagem: contraste firme e grão visível.',
    spec: { film: 'grafite400', grain: 2, gsize: 1, sharp: 2, clarity: 2, hl: 1, sh: 2 } },
  { id: 'c_push', name: 'Forçado 3200', note: 'P&B puxado na revelação: grão grosso e pretos fechados.',
    spec: { film: 'carvao3200', expo: 1 / 3, grain: 3, gsize: 2, sharp: 2, clarity: 3, hl: 2, sh: 3 } },
  { id: 'c_nitrato', name: 'Cinema Mudo', note: 'P&B antigo, céu escuro, imagem macia e vinheta.',
    spec: { film: 'nitrato', grain: 3, gsize: 2, sharp: -2, bloom: 1, hl: 1, sh: 1, vig: 2, fade: 1 } },
  { id: 'c_ciano', name: 'Cianotipia', note: 'Impressão azul sobre papel de algodão.',
    spec: { film: 'ciano', grain: 1, gsize: 1, sharp: -1, paper: 2, hl: -0.5 } },
];
