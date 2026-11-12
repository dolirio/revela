// Climas: receitas prontas do Pellicula. Cada uma parte de um filme clássico e soma o toque pessoal:
// afinar o filme (Tom e Cor), luz, textura e papel. Os nomes descrevem a cena, nunca uma marca.
// A força é média de propósito: dá para subir ou descer depois, e "+ salvar como meu" guarda a sua versão.
import { FILMS } from './films.js';

const ch = (id) => ({ ...(FILMS.find((f) => f.id === id)?.ch || {}) });
// papel: tipos do renderer (5 brilhante, 0 lustre, 6 fosco, 7 instantânea)
const BRILHANTE = 5, LUSTRE = 0, FOSCO = 6, INSTANT = 7;
const C = (id, name, note, film, o) => ({ id, name, note, film, s: { look: film, mix: 1, ...ch(film), ...o } });

export const CLIMAS = [
  C('c_tarde', 'Tarde dourada', 'fim de tarde: pele quente, luz que transborda', 'f_kg200',
    { fcol: 0.35, ftone: 0.15, shad: 0.15, bloom: 0.15, paper: 0.4, paperType: LUSTRE }),
  C('c_manha', 'Manhã fria', 'luz azulada da manhã, suave e limpa', 'f_fpn160',
    { fcol: -0.3, ftone: 0.3, high: -0.1, paper: 0.4, paperType: BRILHANTE }),
  C('c_retrato', 'Retrato macio', 'pele luminosa e macia, sombras abertas', 'f_kp400p2',
    { ftone: 0.2, sharp: -0.15, bloom: 0.12, paper: 0.5, paperType: LUSTRE }),
  C('c_album', 'Álbum de família', 'cópia de álbum: cor contida, papel com textura', 'f_kc200',
    { fade: 0.12, vig: 0.12, paper: 0.6, paperType: LUSTRE }),
  C('c_praia', 'Verão na praia', 'sol forte, cor viva, céu claro', 'f_ku400',
    { ftone: 0.35, fcol: 0.15, high: -0.15, paper: 0.3, paperType: BRILHANTE }),
  C('c_nublado', 'Inverno nublado', 'dia cinza, verdes densos, frio', 'f_fs400',
    { ftone: -0.1, fcol: -0.3, sat: -0.28, con: -0.1, shad: 0.1, fade: 0.08 }),
  C('c_cinema', 'Cinema de dia', 'luz do dia de filme de cinema: contraste baixo, cor suave', 'f_kv250',
    { shad: 0.1, con: -0.05 }),
  C('c_noite', 'Noite na cidade', 'luzes de rua, sombras azuladas, halação nas lâmpadas', 'f_kv500',
    { ftone: -0.2, shad: 0.1, halo: 0.25 }),
  C('c_festa', 'Festa instantânea', 'foto instantânea inspirada na instax mini', 'f_inst',
    { ftone: 0.1, paper: 0.5, paperType: INSTANT }),
  C('c_paisagem', 'Paisagem em slide', 'slide subexposto: céu denso, cor saturada', 'f_fv50',
    { mix: 0.85, ftone: -0.15, fcol: 0.05 }),
  C('c_rua', 'Rua em P&B', 'preto fechado, grão marcado', 'f_kt1600',
    { ftone: -0.1, clar: 0.15, paper: 0.4, paperType: FOSCO }),
  C('c_pbsuave', 'P&B macio', 'luzes amplas, grão macio, cópia em papel lustre', 'f_ix400',
    { ftone: 0.25, paper: 0.5, paperType: LUSTRE }),
];
