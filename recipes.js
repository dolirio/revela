// Filmes salvos em versões antigas do app guardavam uma "receita" curta em vez da edição inteira.
// specToState converte essas receitas para continuar funcionando em Minhas.

function blankSpec(film = 'none') {
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
