// Renderizador do Revela novo (WebGL2). A foto atravessa o filme como luz:
//   foto (sRGB) -> luz linear -> nitidez do filme por camada -> halação (luz que volta pela base)
//   -> equilíbrio da luz da cena (ANTES do filme) -> exposição do negativo
//   -> tabela do filme (negativo + scanner + laboratório, gerada pelo motor espectral)
//   -> equilíbrio automático do cinza (como o scanner, foto a foto) -> equilíbrio do laboratório (DEPOIS) -> grão -> tela
// A tabela do filme recebe luz da cena em paradas (log2), por isso a exposição empurra a foto pela curva real do filme.

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 vUv; out vec4 o;
uniform sampler2D uImg; uniform sampler3D uLut;
uniform float uLutN, uLutMin, uLutMax, uMix, uExp, uHalo, uGrain, uGrainSize, uSoft, uSeed, uLong, uTex, uOut, uHasFilm, uBypass, uAuto;
uniform float uRet, uSep, uPele6, uPele5, uFaceLod; uniform vec4 uFace;
uniform vec3 uPre, uPost, uSoftCh, uG0;
uniform vec2 uRes;
uniform float uDust, uScratch, uLeak, uDustSeed, uScrSeed, uLeakSeed, uLeakType, uFr;
uniform vec4 uLeakP, uFrm; uniform vec2 uCan;

vec3 dec(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 enc(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// ---- grão: grãos de prata sorteados em células; mais grãos onde o negativo é mais denso
vec4 hash4(vec3 p){
  vec4 q = fract(vec4(p.xyzx) * vec4(0.1031, 0.103, 0.0973, 0.1099));
  q += dot(q, q.wzxy + 33.33);
  return fract((q.xxyz + q.yzzw) * q.zywx);
}
float grainLayer(vec2 p, float D, float sd){
  const float N = 2.0, RM = 0.42, rough = 0.45;
  float a0 = 1.0 - 0.45 * rough, a1 = 0.9 * rough;
  float area = 3.14159 * RM * RM * (a0 * a0 + a0 * a1 + a1 * a1 / 3.0);
  float q = clamp(-log(max(1.0 - D, 0.001)) / (N * area), 0.0, 1.0);
  vec2 ip = floor(p); float keep = 1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cell = ip + vec2(i, j);
    for (int k = 0; k < 2; k++) {
      vec4 h = hash4(vec3(cell, float(k) * 7.31 + sd));
      if (h.w >= q) continue;
      float r = RM * (a0 + a1 * h.z), d = length(p - cell - h.xy);
      keep *= 1.0 - (1.0 - smoothstep(r - 0.15, r + 0.15, d));
    }
  }
  return (1.0 - exp(-N * q * area)) - (1.0 - keep);
}

vec3 filme(vec3 x){
  vec3 t = (log2(max(x, vec3(1e-7)) / 0.18) - uLutMin) / (uLutMax - uLutMin);
  t = clamp(t, 0.0, 1.0);
  return texture(uLut, t * ((uLutN - 1.0) / uLutN) + 0.5 / uLutN).rgb;
}


// ================== tempo e textura (trazido do app publicado, renderer.js; mesma física, controles simplificados)
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
vec2 grad2(vec2 i){ float a = hash(i) * 6.2832; return vec2(cos(a), sin(a)); }
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n = mix(mix(dot(grad2(i), f), dot(grad2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
                mix(dot(grad2(i + vec2(0, 1)), f - vec2(0, 1)), dot(grad2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
  return clamp(0.5 + 0.75 * n, 0.0, 1.0);
}
float fbm2(vec2 p){ return 0.55 * gnoise(p) + 0.3 * gnoise(p * 2.03 + 7.1) + 0.15 * gnoise(p * 4.1 + 3.7); }
// poeira: pontos de contorno irregular e fiapos finos e curvos
vec2 specks(vec2 q, float sc, float p, float rmin, float rmax, float elong, float soft, float off){
  vec2 gp = q * sc; vec2 cell = floor(gp) + off + uDustSeed * 13.7;
  if (hash(cell) >= p) return vec2(0.0);
  vec2 dv = fract(gp) - (0.25 + 0.5 * vec2(hash(cell + 1.7), hash(cell + 3.1)));
  float ang = hash(cell + 7.7) * 6.283;
  dv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * dv;
  dv.x /= mix(1.0, elong, step(0.6, hash(cell + 4.4)));
  float rr = mix(rmin, rmax, hash(cell + 5.3)) * (0.8 + 0.4 * vnoise(dv * 24.0 + cell * 3.1));
  float d = length(dv) / rr;
  return vec2(1.0 - smoothstep(1.0 - max(fwidth(d) * 1.5, soft), 1.0, d), hash(cell + 9.1));
}
vec2 hairs(vec2 q, float sc, float p, float off){
  vec2 gp = q * sc; vec2 cell = floor(gp) + off + uDustSeed * 13.7;
  if (hash(cell) >= p) return vec2(0.0);
  vec2 dv = fract(gp) - (0.38 + 0.24 * vec2(hash(cell + 1.3), hash(cell + 2.9)));
  float ang = hash(cell + 6.1) * 6.283;
  dv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * dv;
  float len = mix(0.12, 0.3, hash(cell + 8.2)), bend = (hash(cell + 3.7) - 0.5) * 2.4;
  float y = bend * dv.x * dv.x + 0.006 * sin(dv.x * 18.0 + hash(cell) * 6.0);
  float px = fwidth(gp.y), w = max(0.0035, px * 0.45);
  float aa = (1.0 - smoothstep(w, w + px * 1.2, abs(dv.y - y))) * (1.0 - smoothstep(len * 0.75, len, abs(dv.x)));
  return vec2(aa, hash(cell + 9.1));
}
vec2 dustOf(vec2 q){   // sutil, como no negativo bem cuidado: pó fino, alguns grãos alongados pequenos e raros fiapos.
  // (sem as manchas grandes e macias do app publicado: pareciam sujeira na imagem, não no filme)
  vec2 a = specks(q, 90.0, 0.16, 0.05, 0.11, 1.5, 0.0, 41.0), b;
  b = specks(q, 34.0, 0.10, 0.025, 0.06, 2.5, 0.0, 0.0); b.x *= 0.8; if (b.x > a.x) a = b;
  b = hairs(q, 4.0, 0.12, 3.0); b.x *= 0.7; if (b.x > a.x) a = b;
  return a;
}
float lineAA(float d, float w, float px){ float ww = max(w, px); return (1.0 - smoothstep(ww * 0.5, ww * 0.5 + px, d)) * min(1.0, w / max(px, 1e-4)); }
// riscos longos no sentido em que o filme corre (o lado maior da foto), como os da câmera
float scratchOf(vec2 iu){
  float sd = uScrSeed; bool land = uRes.x >= uRes.y; vec2 P = iu * uRes;
  float A = land ? P.x : P.y, B = land ? P.y : P.x, LA = land ? uRes.x : uRes.y, LB = land ? uRes.y : uRes.x, sh = min(uRes.x, uRes.y);
  float pxB = max(fwidth(B), 1e-3), a = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (hash(vec2(fi, sd + 9.0)) > 0.5) continue;   // poucos riscos
    float pos = LB * (0.06 + 0.88 * hash(vec2(fi, sd + 1.0)));
    float wob = (gnoise(vec2(A / LA * 1.7 + fi * 7.0, sd)) - 0.5) * sh * 0.008;
    float wd = (0.35 + 0.8 * hash(vec2(fi, sd + 2.0))) * (0.6 + 0.8 * gnoise(vec2(A / LA * 9.0, fi + sd))) * max(1.0, sh / 1500.0);   // finos como fio de cabelo
    float seg = smoothstep(0.22, 0.42, gnoise(vec2(A / LA * 3.5 + fi * 3.3, sd + 5.0)));
    float st = LA * hash(vec2(fi, sd + 3.0)) * 0.6 * step(0.55, hash(vec2(fi, sd + 4.0)));
    float l = lineAA(abs(B - pos - wob), wd, pxB) * seg * step(st, A);
    if (hash(vec2(fi, sd + 6.0)) > 0.6) l = max(l, 0.7 * lineAA(abs(B - pos - wob - (3.0 + 4.0 * hash(vec2(fi, sd + 7.0))) * max(1.0, sh / 1500.0)), wd * 0.6, pxB) * seg * step(st, A));
    a = max(a, l);
  }
  return clamp(a, 0.0, 1.0);
}
// luz vazada: fraca = vermelha, média = laranja, forte = amarela, queimada = quase branca
vec3 leakRamp(float x, float warm){
  vec3 r = mix(vec3(0.72, 0.05, 0.04), vec3(0.92, 0.22, 0.05), warm), o = mix(vec3(1.0, 0.36, 0.07), vec3(1.0, 0.56, 0.12), warm);
  vec3 col = r * smoothstep(0.0, 0.45, x);
  col = mix(col, o, smoothstep(0.25, 0.75, x));
  col = mix(col, vec3(1.0, 0.86, 0.52), smoothstep(0.55, 1.05, x));
  return mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.9, 1.35, x));
}
// de onde a luz entrou: 0 tampa (faixa pela borda do filme), 1 dobradiça (mancha lateral), 2 ponta do rolo, 5 raios
float leakField(vec2 iu){
  int t = int(uLeakType + 0.5); float sd = uLeakSeed, bit = uLeakP.x; bool land = uRes.x >= uRes.y;
  bool longEdge = t == 0 || t == 5;
  int side = longEdge ? (land ? (bit > 0.5 ? 2 : 3) : (bit > 0.5 ? 0 : 1)) : (land ? (bit > 0.5 ? 0 : 1) : (bit > 0.5 ? 2 : 3));
  float d, s;
  if (side == 0) { d = iu.x; s = iu.y; } else if (side == 1) { d = 1.0 - iu.x; s = iu.y; } else if (side == 2) { d = iu.y; s = iu.x; } else { d = 1.0 - iu.y; s = iu.x; }
  float sh = min(uRes.x, uRes.y), lenD = side < 2 ? uRes.x : uRes.y, lenS = side < 2 ? uRes.y : uRes.x;
  float dn = d * lenD / sh, sn = s * lenS / sh, tp = uLeakP.y * lenS / sh, w = uLeakP.z;
  if (t == 0) {
    float along = exp(-pow((sn - tp) / (0.5 + 0.9 * w), 2.0)), plume = 0.5 + 0.5 * fbm2(vec2(sn * 7.0 + sd, dn * 1.3));
    float depth = (0.1 + 0.22 * w) * (0.55 + 0.9 * fbm2(vec2(sn * 2.2 + sd * 3.0, 0.5)));
    return 1.75 * along * exp(-dn / depth) * plume;
  } else if (t == 1) {
    vec2 q = vec2(dn / (0.22 + 0.28 * w), (sn - tp) / (0.3 + 0.35 * w)); float n = fbm2(vec2(sn, dn) * 3.5 + sd);
    return 1.65 * exp(-dot(q, q) * 1.3) * (0.7 + 0.45 * n) + 0.25 * exp(-dn / 0.05) * n;
  } else if (t == 2) {
    float bnd = 0.2 + 0.35 * w + (fbm2(vec2(sn * 1.8 + sd, 1.0)) - 0.5) * 0.3;
    return 1.4 * (1.0 - smoothstep(bnd - 0.4, bnd + 0.06, dn)) * (0.8 + 0.3 * fbm2(vec2(sn * 3.0, dn * 3.0) + sd));
  }
  vec2 rel = vec2(dn, sn - tp); float ang = atan(rel.y, rel.x + 1e-4), dist = length(rel);
  float rays = smoothstep(0.42, 0.9, gnoise(vec2(ang * 2.6 + sd, sd * 0.37))), soft = 0.35 + 0.65 * gnoise(vec2(dist * 3.0 + sd, ang * 1.5));
  return 1.1 * rays * soft * exp(-dist / (0.3 + 0.45 * w)) + 1.2 * exp(-dist * dist / (0.02 + 0.03 * w));
}
// moldura do negativo escaneado (35 mm): borda preta e os furos, por onde a luz do scanner passa
float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 moldura(vec2 P){
  vec2 q = P - uFrm.xy; float sh = min(uFrm.z, uFrm.w); bool land = uFrm.z >= uFrm.w;
  float A = land ? q.x : q.y;                                        // ao longo do filme
  float dTop = land ? -q.y : -q.x, dBot = land ? q.y - uFrm.w : q.x - uFrm.z;
  float d = max(dTop, dBot);                                         // distância da borda da foto, do lado dos furos
  float pitch = 0.198 * sh;
  vec2 hp = vec2(mod(A, pitch) - pitch * 0.5, d - 0.146 * sh);
  float hole = 1.0 - smoothstep(-1.0, 1.0, rbox(hp, vec2(0.058, 0.041) * sh, 0.016 * sh));
  vec3 base = vec3(0.03, 0.026, 0.022) + (hash(floor(P * 0.5)) - 0.5) * 0.012;
  return mix(base, vec3(0.93, 0.91, 0.87), hole * step(0.0, d));
}
void main(){
  vec2 uv = vUv;
  if (uFr > 0.5) {
    vec2 P = vUv * uCan, q = P - uFrm.xy;
    float sh = min(uFrm.z, uFrm.w);
    if (rbox(q - uFrm.zw * 0.5, uFrm.zw * 0.5, 0.012 * sh) > 0.0) { o = vec4(moldura(P), 1.0); return; }   // janela de cantos levemente arredondados
    uv = q / uFrm.zw;
  }
  vec3 c = texture(uImg, uv).rgb;
  if (uBypass > 0.5) { o = vec4(c, 1.0); return; }
  vec3 lin = dec(c);
  // nitidez do filme: cada camada perde detalhe fino de um jeito (o vermelho, mais funda, é a mais macia)
  if (uSoft > 0.0) {
    float lod = clamp(log2(uTex / 1500.0) + 0.6, 0.0, 4.0);   // uTex: lado da textura (o desfoque segue a foto)
    vec3 b = dec(textureLod(uImg, uv, lod).rgb);
    lin = mix(lin, b, clamp(uSoft * uSoftCh, 0.0, 1.0));
  }
  // halação: a luz forte atravessa o filme, reflete na base e volta expondo de novo a camada vermelha
  if (uHalo > 0.0) {
    // pontos de luz forte (abajur, janela, neon, sol) em três raios: perto, médio e longe. Cada nível já é a média
    // da vizinhança, então a luz que "vaza" forma um brilho vermelho-alaranjado em volta, como no filme sem anti-halo.
    float b = log2(uTex / 1500.0);
    float hs = 0.0;
    for (int i = 0; i < 3; i++) {
      float lod = clamp(b + 2.0 + 1.6 * float(i), 0.0, 10.0);
      float y = luma(dec(textureLod(uImg, uv, lod).rgb));
      hs += max(y - 0.28, 0.0) * (i == 0 ? 0.5 : i == 1 ? 0.35 : 0.25);
    }
    lin += uHalo * 2.6 * hs * vec3(1.0, 0.28, 0.06);
  }
  vec3 x = lin * uPre * exp2(uExp);                 // luz que chega ao filme
  vec3 dig = enc(clamp(x * uPost, 0.0, 1.0));       // a mesma foto sem filme (intensidade 0)
  vec3 f = dig;
  // retrato (receita Lindbergh): rosto marcado -> contraste centrado no rosto, pele exposta para o alvo e o
  // entorno escurecido por máscara suave, como na ampliação com máscara (referencias/lindbergh/README.md, v3/v6/v5)
  if (uRet > 0.5) {
    float fx = max(luma(dec(textureLod(uImg, uFace.xy, uFaceLod).rgb)) * exp2(uExp), 1e-5);
    float t = uSep, a = clamp(t * 2.0, 0.0, 1.0), b = clamp(t * 2.0 - 1.0, 0.0, 1.0);
    float c = mix(mix(1.0, 1.12, a), 1.25, b);
    float burn = mix(mix(0.0, 0.55, a), 1.5, b);
    float ef = clamp(log2(mix(uPele6, uPele5, b) / fx), -3.0, 3.0) * a;
    vec2 d = (uv - uFace.xy) / uFace.zw;
    float mask = exp(-0.5 * dot(d, d));
    x *= exp2((c - 1.0) * log2(max(luma(x), 1e-7) / fx) + ef - burn * (1.0 - mask));
  }
  if (uHasFilm > 0.5) {
    vec3 fl = dec(filme(x));
    // equilíbrio automático do laboratório: como o scanner faz foto a foto, o cinza médio desta exposição volta a
    // ser neutro (o brilho fica). Usa o cinza SEM a luz da cena, para a temperatura "na câmera" continuar valendo.
    if (uAuto > 0.0) {
      vec3 g = max(dec(filme(vec3(0.18) * exp2(uExp))), vec3(1e-5));
      fl *= mix(vec3(1.0), (uG0 / luma(uG0)) * luma(g) / g, uAuto);   // volta ao cinza do PRÓPRIO filme (mantém o tom dele)
    }
    f = enc(fl * uPost);
  }
  vec3 col = mix(dig, f, uMix);
  // ---------- tempo: luz vazada (exposta no filme), poeira e riscos (na hora de escanear)
  if (uLeak > 0.0) {
    float x = leakField(uv) * uLeak * 1.15;
    vec3 lk = leakRamp(min(x, 1.25), hash(vec2(uLeakSeed, 7.0)));
    col = mix(col, col * 0.88 + 0.1, clamp(x, 0.0, 1.0) * 0.25);
    col = 1.0 - (1.0 - col) * (1.0 - lk);
  }
  if (uDust > 0.0) {   // poeira na base do negativo: no escaneado sai CLARA
    vec2 d = dustOf(uv * vec2(uRes.x / uRes.y, 1.0));
    // não é branco chapado: o pó clareia o que está embaixo (luz do scanner contornando a partícula)
    if (d.x > 0.0) col = mix(col, 1.0 - (1.0 - col) * 0.25, d.x * min(1.0, uDust) * mix(0.45, 0.8, d.y));
  }
  if (uScratch > 0.0) {
    float sa = scratchOf(uv);
    if (sa > 0.0) col = mix(col, 1.0 - (1.0 - col) * 0.35, clamp(sa * uScratch * 0.6, 0.0, 1.0));   // risco na base: clareia, não pinta
  }
  // grão: o tamanho segue a foto inteira (igual na prévia e na exportação)
  if (uGrain > 0.0) {
    // célula do grão em pixels DA SAÍDA: o mesmo tamanho relativo à foto na prévia e na exportação
    // (antes usava o lado da foto original e a prévia mostrava o grão ~5× maior que o exportado)
    float cellPx = uGrainSize * 1.6 * (uOut / 4000.0);
    float vis = smoothstep(0.35, 1.2, cellPx);          // células menores que um pixel viram ruído fino
    vec2 p = gl_FragCoord.xy / max(cellPx, 0.6);
    float l = luma(col);
    float n = grainLayer(p, clamp(1.0 - l, 0.02, 0.98), uSeed);
    float amp = uGrain * 0.16 * (0.35 + 0.65 * vis) * (0.4 + 2.4 * l * (1.0 - l));
    col += n * amp;
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Render {
  constructor(canvas, opt = {}) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: !!opt.preserve, antialias: false });
    if (!gl) throw new Error('Este navegador não tem WebGL2.');
    this.gl = gl; this.canvas = canvas;
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.p = p; gl.useProgram(p);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'aPos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['uImg', 'uLut', 'uLutN', 'uLutMin', 'uLutMax', 'uMix', 'uExp', 'uHalo', 'uGrain', 'uGrainSize', 'uSoft', 'uSeed', 'uLong', 'uTex', 'uOut', 'uHasFilm', 'uBypass', 'uAuto', 'uPre', 'uPost', 'uSoftCh', 'uRes', 'uRet', 'uSep', 'uPele6', 'uPele5', 'uFaceLod', 'uFace', 'uG0', 'uDust', 'uScratch', 'uLeak', 'uDustSeed', 'uScrSeed', 'uLeakSeed', 'uLeakType', 'uFr', 'uLeakP', 'uFrm', 'uCan'])
      this.u[n] = gl.getUniformLocation(p, n);
    gl.uniform1i(this.u.uImg, 0); gl.uniform1i(this.u.uLut, 1);
    this.img = gl.createTexture(); this.lut = gl.createTexture();
    this.film = null; this.w = 0; this.h = 0;
  }

  setImage(src) {   // ImageBitmap ou canvas, já no tamanho de trabalho
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.w = src.width; this.h = src.height;
  }

  setFilm(pkg) {   // pkg: { meta, data: Uint16Array } ou null (digital)
    this.film = pkg;
    if (!pkg) return;
    const gl = this.gl, n = pkg.meta.tabela.n, src = pkg.data;
    const f = new Float32Array(n * n * n * 4);
    for (let i = 0, j = 0; i < src.length; i += 3, j += 4) { f[j] = src[i] / 65535; f[j + 1] = src[i + 1] / 65535; f[j + 2] = src[i + 2] / 65535; f[j + 3] = 1; }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.lut);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, n, n, n, 0, gl.RGBA, gl.FLOAT, f);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]])
      gl.texParameteri(gl.TEXTURE_3D, k, v);
  }

  // s: estado da edição; longSide: lado maior da foto ORIGINAL (o grão e a halação seguem a foto, não a tela)
  // outW×outH = tamanho da FOTO; com a moldura do filme o quadro cresce em volta (ver quadro())
  draw(s, outW, outH, longSide, bypass = false) {
    const gl = this.gl, u = this.u;
    const Q = quadro(s, outW, outH), CW = Q.W, CH = Q.H;
    if (this.canvas.width !== CW || this.canvas.height !== CH) { this.canvas.width = CW; this.canvas.height = CH; }
    gl.viewport(0, 0, CW, CH);
    this.janela = [Q.x / CW, Q.y / CH, outW / CW, outH / CH];   // onde a foto fica dentro do quadro (para tocar no rosto)
    gl.uniform1f(u.uFr, Q.moldura && !bypass ? 1 : 0); gl.uniform2f(u.uCan, CW, CH); gl.uniform4f(u.uFrm, Q.x, Q.y, outW, outH);
    const sorte = s.sorte ?? 7, lp = leakParams(sorte);
    gl.uniform1f(u.uDust, bypass ? 0 : s.poeira || 0); gl.uniform1f(u.uScratch, bypass ? 0 : s.riscos || 0); gl.uniform1f(u.uLeak, bypass ? 0 : s.luzVazada || 0);
    gl.uniform1f(u.uDustSeed, sorte % 97); gl.uniform1f(u.uScrSeed, (sorte * 1.7) % 89); gl.uniform1f(u.uLeakSeed, (sorte * 2.3) % 83);
    gl.uniform1f(u.uLeakType, lp[4]); gl.uniform4f(u.uLeakP, lp[0], lp[1], lp[2], lp[3]); gl.useProgram(this.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.img);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.lut);
    const m = this.film?.meta, a = m?.analogico || {};
    gl.uniform1f(u.uLutN, m ? m.tabela.n : 2); gl.uniform1f(u.uLutMin, m ? m.tabela.min : -9); gl.uniform1f(u.uLutMax, m ? m.tabela.max : 7);
    const g0 = (m?.cinza_medio_saida || [0.47, 0.47, 0.47]).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    gl.uniform3fv(u.uG0, g0);
    gl.uniform1f(u.uHasFilm, m ? 1 : 0); gl.uniform1f(u.uAuto, s.labAuto ?? 1); gl.uniform1f(u.uBypass, bypass ? 1 : 0);
    gl.uniform1f(u.uMix, s.intensidade); gl.uniform1f(u.uExp, s.exposicao);
    gl.uniform3fv(u.uPre, wb(s.cenaTemp, s.cenaMatiz)); gl.uniform3fv(u.uPost, m?.cat === 'pb' ? [1, 1, 1] : wb(s.labTemp, s.labMatiz));   // P&B: o scan é cinza, não há o que equilibrar
    gl.uniform1f(u.uHalo, s.halacao); gl.uniform1f(u.uGrain, s.grao); gl.uniform1f(u.uGrainSize, s.graoTamanho);
    gl.uniform1f(u.uSoft, m ? s.caraterFilme : 0); gl.uniform3fv(u.uSoftCh, a.nitidez_canal ? a.nitidez_canal.map((v) => 1 - v) : [0, 0, 0]);
    // retrato: só com filme de retrato e rosto marcado (posição em fração da foto)
    const ret = m?.retrato && s.rosto;
    gl.uniform1f(u.uRet, ret ? 1 : 0);
    if (ret) {
      const raio = 0.16 * (s.rostoTam ?? 1) * Math.min(this.w, this.h);
      gl.uniform4f(u.uFace, s.rosto.x, s.rosto.y, raio / this.w, raio * 1.25 / this.h);
      gl.uniform1f(u.uFaceLod, Math.max(0, Math.log2(raio * 0.7)));
      gl.uniform1f(u.uSep, s.separacao ?? 0.5); gl.uniform1f(u.uPele6, m.retrato.pele_v6); gl.uniform1f(u.uPele5, m.retrato.pele_v5);
    }
    gl.uniform1f(u.uSeed, s.semente); gl.uniform1f(u.uLong, longSide); gl.uniform1f(u.uTex, Math.max(this.w, this.h)); gl.uniform1f(u.uOut, Math.max(outW, outH)); gl.uniform2f(u.uRes, outW, outH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// moldura do negativo 35 mm: furos nas bordas longas (24 mm de foto, 5,5 mm de filme de cada lado) e a divisa entre fotos
export function quadro(s, w, h) {
  if (!s.moldura) return { W: w, H: h, x: 0, y: 0, moldura: false };
  const sh = Math.min(w, h), b1 = Math.round(0.23 * sh), b2 = Math.round(0.07 * sh);
  return w >= h ? { W: w + 2 * b2, H: h + 2 * b1, x: b2, y: b1, moldura: true } : { W: w + 2 * b1, H: h + 2 * b2, x: b1, y: b2, moldura: true };
}
// luz vazada sorteada: [lado, posição ao longo da borda, largura, variação, tipo]
function rnd(seed) { let x = Math.sin(seed * 9301 + 49297) * 233280; return () => { x = Math.sin(x) * 10000; return x - Math.floor(x); }; }
export function leakParams(seed) {
  const r = rnd(seed + 1);
  return [r() > 0.5 ? 1 : 0, 0.15 + 0.7 * r(), r(), r(), [0, 0, 1, 2, 5][Math.floor(r() * 5)]];
}

// temperatura (−1 frio .. +1 quente) e matiz (−1 verde .. +1 magenta) -> multiplicadores RGB em luz linear
export function wb(temp, matiz) {
  const t = temp * 0.35, m = matiz * 0.25;
  const r = Math.exp(t + m * 0.5), g = Math.exp(-m), b = Math.exp(-t + m * 0.5);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;   // mantém o brilho
  return [r / y, g / y, b / y];
}
