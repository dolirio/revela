// Gera a LUT dos filmes KP 400 e KG 200 do motor ATUAL do Revela (films.js + looks.js), para comparação.
// Uso: node pesquisa/motor/lut_atual.mjs   (grava pesquisa/motor/saida/revela_atual_lut.json)
import { writeFileSync } from 'fs';
import { FILMS } from '../../films.js';
import { buildLutData } from '../../looks.js';

const n = 33, out = {};
for (const id of ['f_kp400', 'f_kg200']) {
  const f = FILMS.find((x) => x.id === id);
  const d = buildLutData(f.look, n), a = [];
  for (let i = 0; i < d.length; i += 4) a.push([d[i], d[i + 1], d[i + 2]]);
  out[id] = { n, data: a, code: f.code };
}
writeFileSync(new URL('./saida/revela_atual_lut.json', import.meta.url), JSON.stringify(out));
console.log('ok');
