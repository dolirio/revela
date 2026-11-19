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
uniform float uPush, uVenc, uGrainMul; uniform vec3 uVencCor;
// ajustes finos (18/11/2026): agem DEPOIS do filme, na foto como você a vê (como ajustar o scan no laboratório)
uniform float uBri, uCon, uRea, uSom, uBra, uPre2, uSat, uVib, uPele, uFade, uVig, uNit, uClar, uDif, uTemCurva, uTemHsl;
uniform float uHslH[8]; uniform float uHslS[8]; uniform float uHslL[8];
uniform sampler2D uCurva; uniform mat3 uGeo; uniform vec2 uTexel;

vec3 dec(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 enc(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y); float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0*d + e)), d / (q.x + e), q.x); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
const float HC[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 225.0, 270.0, 315.0);   // vermelho, laranja, amarelo, verde, ciano, azul, roxo, magenta

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
// pontinhos: sempre redondos e pequenos (1 a 3 px na foto), sem contorno irregular, na mesma quantidade a cada sorteio
float dots(vec2 q, float sc, float p, float rpx, float off){
  vec2 gp = q * sc; vec2 cell = floor(gp) + off + uDustSeed * 13.7;
  if (hash(cell) >= p) return 0.0;
  vec2 dv = (fract(gp) - (0.2 + 0.6 * vec2(hash(cell + 1.7), hash(cell + 3.1)))) / sc * uRes.y;   // em pixels da foto
  float r = rpx * (0.5 + hash(cell + 5.3)) * (uRes.y / 2000.0);   // tamanho relativo à foto: a prévia reduzida mostra o mesmo que a exportação
  float px = max(fwidth(gp.y) / sc * uRes.y, 0.5);
  return (1.0 - smoothstep(r - px * 0.5, r + px * 0.5, length(dv))) * min(1.0, r / px) * mix(0.55, 1.0, hash(cell + 9.1));
}
// traços: curtinhos e finíssimos (pelinhos e marcas de papel)
float traco(vec2 q, float sc, float p, float off){
  vec2 gp = q * sc; vec2 cell = floor(gp) + off + uDustSeed * 13.7;
  if (hash(cell) >= p) return 0.0;
  vec2 dv = fract(gp) - (0.3 + 0.4 * vec2(hash(cell + 1.3), hash(cell + 2.9)));
  float ang = hash(cell + 6.1) * 6.283;
  dv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * dv * uRes.y / sc;              // em pixels da foto
  float esc = uRes.y / 2000.0, len = mix(6.0, 22.0, hash(cell + 8.2)) * esc, bend = (hash(cell + 3.7) - 0.5) * 0.08 / esc;
  float px = max(fwidth(gp.y) / sc * uRes.y, 0.5), w = 0.6 * esc;
  float d = abs(dv.y - bend * dv.x * dv.x);
  return (1.0 - smoothstep(w, w + px, d)) * (1.0 - smoothstep(len * 0.6, len, abs(dv.x))) * min(1.0, w * 2.0 / px) * 0.8;
}
float dustOf(vec2 q){   // como no RNI: pontinhos brancos e traços finos, sutis e constantes (sem manchas nem bloquinhos)
  float a = dots(q, 60.0, 0.16, 1.3, 41.0);
  a = max(a, dots(q, 140.0, 0.05, 0.8, 7.0));
  a = max(a, traco(q, 9.0, 0.14, 3.0));
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
vec3 leakRamp(float x, float warm, float cool){
  vec3 r = mix(vec3(0.72, 0.05, 0.04), vec3(0.92, 0.22, 0.05), warm), o = mix(vec3(1.0, 0.36, 0.07), vec3(1.0, 0.56, 0.12), warm);
  vec3 y = vec3(1.0, 0.86, 0.52), w = vec3(1.0, 0.97, 0.9);
  if (cool > 0.5) { r = vec3(0.2, 0.08, 0.42); o = vec3(0.3, 0.42, 0.95); y = vec3(0.78, 0.72, 1.0); w = vec3(0.95, 0.95, 1.0); }
  vec3 col = r * smoothstep(0.0, 0.45, x);
  col = mix(col, o, smoothstep(0.25, 0.75, x));
  col = mix(col, y, smoothstep(0.55, 1.05, x));
  return mix(col, w, smoothstep(0.9, 1.35, x));
}
// de onde a luz entrou: 0 tampa, 1 dobradiça, 2 ponta do rolo, 3 entre fotos, 4 frontal, 5 raios
float leakField(vec2 iu, out float cool){
  cool = 0.0;
  int t = int(uLeakType + 0.5); float sd = uLeakSeed, bit = uLeakP.x; bool land = uRes.x >= uRes.y;
  bool longEdge = t == 0 || t == 5 || (t == 4 && hash(vec2(sd, 4.0)) > 0.5);
  int side = longEdge ? (land ? (bit > 0.5 ? 2 : 3) : (bit > 0.5 ? 0 : 1)) : (land ? (bit > 0.5 ? 0 : 1) : (bit > 0.5 ? 2 : 3));
  float d, s;
  if (side == 0) { d = iu.x; s = iu.y; } else if (side == 1) { d = 1.0 - iu.x; s = iu.y; } else if (side == 2) { d = iu.y; s = iu.x; } else { d = 1.0 - iu.y; s = iu.x; }
  float sh = min(uRes.x, uRes.y), lenD = side < 2 ? uRes.x : uRes.y, lenS = side < 2 ? uRes.y : uRes.x;
  float dn = d * lenD / sh, sn = s * lenS / sh, tp = uLeakP.y * lenS / sh, w = uLeakP.z, v = uLeakP.w;
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
  } else if (t == 3) {
    float d0 = 0.03 + 0.12 * v, bw = 0.025 + 0.06 * w, wob = (gnoise(vec2(sn * 1.5 + sd, 0.5)) - 0.5) * 0.04;
    float band = exp(-pow((dn - d0 - wob) / bw, 2.0)) * (0.45 + 0.75 * fbm2(vec2(sn * 2.5 + sd, 2.0)));
    return 1.25 * band + 0.4 * exp(-dn / 0.06) * fbm2(vec2(sn * 4.0, sd));
  } else if (t == 4) {
    cool = 1.0;
    vec2 q = vec2(dn - (0.1 + 0.35 * v), sn - tp) / (0.45 + 0.45 * w);
    return 0.55 * exp(-dot(q, q)) * (0.8 + 0.3 * fbm2(vec2(sn, dn) * 2.0 + sd));
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
  vec2 fu = uv;                                   // posição no quadro final (vinheta, luz vazada, poeira)
  uv = (uGeo * vec3(uv, 1.0)).xy;                 // corte, giro, espelho e endireitar -> posição na foto
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { o = vec4(0.07, 0.066, 0.06, 1.0); return; }   // fora da foto (só aparece enquanto corta)
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
  // ---------- revelação: puxar/segurar e filme vencido agem na LUZ que chega ao filme, e a curva do próprio filme
  // faz o resto (o pé esmaga as sombras, o ombro segura as luzes)
  if (uPush != 0.0) x = 0.18 * pow(max(x, vec3(1e-7)) / 0.18, vec3(1.0 + 0.18 * uPush));   // puxado: mais contraste no meio-tom
  if (uVenc > 0.0) {
    // vencido (pesquisa/vencido.md): perde sensibilidade, cada camada envelhece num ritmo (tom do rolo, do dado),
    // a radiação vela o filme (luz extra igual em tudo, levanta o pé) e o contraste cai
    x *= exp2(-0.6 * uVenc) * (1.0 + 0.35 * uVenc * uVencCor);
    x = 0.18 * pow(max(x, vec3(1e-7)) / 0.18, vec3(1.0 - 0.18 * uVenc)) + 0.18 * exp2(-4.2) * uVenc;
  }
  // a foto sem filme (intensidade 0) vem DEPOIS da revelação: puxar e vencido valem também no Digital
  // (antes ficavam sem efeito quando nenhum filme estava escolhido)
  vec3 dig = enc(clamp(x * uPost, 0.0, 1.0));
  vec3 f = dig;
  if (uHasFilm > 0.5) {
    vec3 fl = dec(filme(x));
    // equilíbrio automático do laboratório: como o scanner faz foto a foto, o cinza médio desta exposição volta a
    // ser neutro (o brilho fica). Usa o cinza SEM a luz da cena, para a temperatura "na câmera" continuar valendo.
    if (uAuto > 0.0) {
      vec3 g = max(dec(filme(vec3(0.18) * exp2(uExp))), vec3(1e-5));
      fl *= mix(vec3(1.0), (uG0 / luma(uG0)) * luma(g) / g, uAuto);   // volta ao cinza do PRÓPRIO filme (mantém o tom dele)
    }
    if (uVenc > 0.0) fl = mix(fl, vec3(luma(fl)), 0.28 * uVenc);   // vencido: a cor desbota
    f = enc(fl * uPost);
  }
  vec3 col = mix(dig, f, uMix);
  // ================== ajustes finos (portados do app publicado, renderer.js, e afinados para depois do filme)
  // detalhe: o contraste local vem da foto original e entra na luminância do resultado (sem franjas de cor)
  if (uNit > 0.0) {
    float r = max(uTex / max(uOut, 1.0), 1.0) * 1.2, lod = max(0.0, log2(r) - 1.0), b = 0.0;
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854 + 0.39; b += luma(textureLod(uImg, uv + vec2(cos(a), sin(a)) * r * uTexel, lod).rgb); }
    float d = luma(textureLod(uImg, uv, max(0.0, lod - 1.0)).rgb) - b / 8.0;
    d = sign(d) * max(abs(d) - 0.004, 0.0); d = d / (1.0 + abs(d) * 4.0);   // ignora o ruído fino; contorno forte não ganha halo
    col = clamp(col + d * uNit * 2.2, 0.0, 1.0);
  }
  if (uClar != 0.0) {   // claridade: volume nos meios-tons, sem mexer no brilho geral nem nos contornos fortes
    float R = uTex * 0.022, lod = max(0.0, log2(R) - 1.5);
    float lb = luma(textureLod(uImg, uv, lod).rgb) * 0.2;
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854 + 0.2, rr = (i % 2 == 0) ? R : R * 0.55; lb += luma(textureLod(uImg, uv + vec2(cos(a), sin(a)) * rr * uTexel, lod).rgb) * 0.1; }
    float d = luma(texture(uImg, uv).rgb) - lb; d *= 1.0 / (1.0 + (d / 0.14) * (d / 0.14));
    float l = luma(col), m = 1.0 - pow(abs(l * 2.0 - 1.0), 2.0);
    col = clamp(col + d * uClar * (uClar > 0.0 ? 0.85 : 1.0) * m, 0.0, 1.0);
  }
  // tom
  if (uBri != 0.0) col = pow(col, vec3(exp2(-uBri * 0.8)));                    // brilho: só o meio-tom; preto e branco no lugar
  if (uBra != 0.0 || uPre2 != 0.0) col = clamp(col + uBra * 0.14 * smoothstep(0.4, 1.0, col) + uPre2 * 0.11 * (1.0 - smoothstep(0.0, 0.6, col)), 0.0, 1.0);
  if (uRea != 0.0 || uSom != 0.0) {
    // realces e sombras: a máscara olha a vizinhança (como Sombras/Realces do Photoshop): a área escura clareia
    // inteira e o detalhe dentro dela não achata
    float l = luma(col), ls = luma(texture(uImg, uv).rgb), lb = luma(textureLod(uImg, uv, max(0.0, log2(uTex * 0.012))).rgb);
    float m = clamp(l + clamp(lb - ls, -0.18, 0.18), 0.0, 1.0);
    float hw = smoothstep(0.42, 0.92, m), sw = 1.0 - smoothstep(0.08, 0.58, m);
    float dh = uRea > 0.0 ? uRea * 0.30 * hw * (1.0 - l) * 2.0 : uRea * 0.2 * hw * (1.0 - 0.7 * smoothstep(0.85, 1.0, l));
    float ds = uSom * 0.30 * sw * min(l * 2.0, 1.0);
    float nl = clamp(l + dh + ds, 0.0, 1.0);
    col = clamp(col * (nl / max(l, 1e-4)), 0.0, 1.0);
  }
  if (uCon > 0.0) {   // contraste: curva em S com as pontas suaves (o cinza médio fica parado)
    vec3 sc = col * col * (3.0 - 2.0 * col); col = mix(col, sc, uCon * 0.75);
  } else if (uCon < 0.0) col = 0.5 + (col - 0.5) * (1.0 + uCon * 0.55);
  // cor
  if (uSat != 0.0 || uVib != 0.0) {
    float l = luma(col), sa = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
    float vb = uVib * (1.0 - sa) * (uVib > 0.0 ? 1.1 : 0.8);                   // vibração: mais nas cores apagadas
    col = clamp(mix(vec3(l), col, 1.0 + uSat + vb), 0.0, 1.0);
  }
  if (uPele != 0.0 || uTemHsl > 0.5) {
    vec3 h = rgb2hsv(col); float hd = h.x * 360.0, dh = 0.0, ds = 0.0, dl = 0.0;
    if (uTemHsl > 0.5) {
      float wsum = 0.0;
      for (int i = 0; i < 8; i++) {
        float d = abs(hd - HC[i]); d = min(d, 360.0 - d);
        float w = max(0.0, 1.0 - d / 45.0); w = w * w * (3.0 - 2.0 * w);
        dh += w * uHslH[i]; ds += w * uHslS[i]; dl += w * uHslL[i]; wsum += w;
      }
      if (wsum > 0.0) { dh /= wsum; ds /= wsum; dl /= wsum; }
      dh *= 30.0;                                                                // matiz: até 30° para cada lado
    }
    if (uPele != 0.0) {   // tom de pele: a faixa laranja pouco saturada (pele de todos os tons) vai para o rosado (−) ou o dourado (+)
      float d = abs(hd - 25.0); d = min(d, 360.0 - d);
      float w = (1.0 - smoothstep(10.0, 32.0, d)) * smoothstep(0.08, 0.2, h.y) * (1.0 - smoothstep(0.55, 0.85, h.y)) * smoothstep(0.12, 0.3, h.z);
      dh += uPele * 9.0 * w; ds += uPele * 0.08 * w;
    }
    h.x = fract(h.x + dh / 360.0);
    h.y = clamp(h.y * (1.0 + ds), 0.0, 1.0);
    h.z = clamp(h.z * (1.0 + dl * 0.6 * smoothstep(0.03, 0.3, h.y)), 0.0, 1.0);
    col = hsv2rgb(h);
  }
  if (uTemCurva > 0.5) col = vec3(texture(uCurva, vec2(col.r * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).r,
                                  texture(uCurva, vec2(col.g * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).g,
                                  texture(uCurva, vec2(col.b * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).b);
  if (uDif > 0.0) {   // difusão (bloom, "vintage glow"): as luzes se espalham num brilho levemente quente, como filtro de difusão
    float lod = log2(uTex * 0.022), bl = 0.0; vec3 acc = vec3(0.0), avg = vec3(0.0);   // borrão largo: sem fantasma (cópias deslocadas)
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236 + 0.26;
      for (int j = 1; j <= 2; j++) {
        vec3 s = textureLod(uImg, uv + vec2(cos(a), sin(a)) * 0.011 * float(j) * vec2(uTexel.x / uTexel.y, 1.0), max(lod, 0.0)).rgb;
        acc += s * smoothstep(0.42, 1.0, luma(s)); avg += s;
      }
    }
    vec3 gl = acc / 24.0 * uDif * vec3(1.0, 0.95, 0.86);
    col = 1.0 - (1.0 - col) * (1.0 - gl * 2.2);
    col = mix(col, max(col, avg / 24.0), uDif * 0.4);
    col = col * (1.0 - uDif * 0.05) + uDif * vec3(0.035, 0.03, 0.024);
  }
  // ---------- tempo: luz vazada (exposta no filme), poeira e riscos (na hora de escanear)
  if (uLeak > 0.0) {
    float cool, x = leakField(fu, cool) * uLeak * 1.15;
    vec3 lk = leakRamp(min(x, 1.25), hash(vec2(uLeakSeed, 7.0)), cool);
    col = mix(col, col * 0.88 + 0.1, clamp(x, 0.0, 1.0) * 0.25);
    col = 1.0 - (1.0 - col) * (1.0 - lk);
  }
  if (uDust != 0.0) {   // direita (+) = poeira branca, como no negativo escaneado; esquerda (−) = preta, como na cópia em papel
    float d = dustOf(fu * vec2(uRes.x / uRes.y, 1.0));
    if (d > 0.0) col = mix(col, uDust > 0.0 ? 1.0 - (1.0 - col) * 0.06 : col * 0.06, d * min(1.0, abs(uDust)) * 0.95);   // clareia o que está embaixo
  }
  if (uScratch > 0.0) {
    float sa = scratchOf(fu);
    if (sa > 0.0) col = mix(col, 1.0 - (1.0 - col) * 0.35, clamp(sa * uScratch * 0.6, 0.0, 1.0));   // risco na base: clareia, não pinta
  }
  if (uFade != 0.0) col = col * (1.0 - 0.22 * uFade) + 0.09 * uFade;   // esmaecer: o preto vira cinza, como cópia velha
  if (uVig != 0.0) {   // vinheta: bordas mais escuras (+) ou mais claras (−), no formato da foto
    vec2 q = (fu - 0.5) * 2.0; float rr = length(q) / 1.25;
    float v = smoothstep(0.35, 1.05, rr);
    col = uVig > 0.0 ? col * (1.0 - uVig * 0.7 * v) : 1.0 - (1.0 - col) * (1.0 + uVig * 0.6 * v);
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
    float amp = uGrain * uGrainMul * 0.16 * (0.35 + 0.65 * vis) * (0.4 + 2.4 * l * (1.0 - l));
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
    for (const n of ['uImg', 'uLut', 'uLutN', 'uLutMin', 'uLutMax', 'uMix', 'uExp', 'uHalo', 'uGrain', 'uGrainSize', 'uSoft', 'uSeed', 'uLong', 'uTex', 'uOut', 'uHasFilm', 'uBypass', 'uAuto', 'uPre', 'uPost', 'uSoftCh', 'uRes', 'uRet', 'uSep', 'uPele6', 'uPele5', 'uFaceLod', 'uFace', 'uG0', 'uDust', 'uScratch', 'uLeak', 'uDustSeed', 'uScrSeed', 'uLeakSeed', 'uLeakType', 'uFr', 'uLeakP', 'uFrm', 'uCan', 'uPush', 'uVenc', 'uGrainMul', 'uVencCor', 'uBri', 'uCon', 'uRea', 'uSom', 'uBra', 'uPre2', 'uSat', 'uVib', 'uPele', 'uFade', 'uVig', 'uNit', 'uClar', 'uDif', 'uTemCurva', 'uTemHsl', 'uHslH', 'uHslS', 'uHslL', 'uCurva', 'uGeo', 'uTexel'])
      this.u[n] = gl.getUniformLocation(p, n);
    gl.uniform1i(this.u.uImg, 0); gl.uniform1i(this.u.uLut, 1); gl.uniform1i(this.u.uCurva, 2);
    this.img = gl.createTexture(); this.lut = gl.createTexture(); this.curva = gl.createTexture(); this.curvaChave = '';
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
    const sorte = s.sorte ?? 7, sl = s.sorteLuz ?? 3, lp = leakParams(sl);
    gl.uniform1f(u.uDust, bypass ? 0 : s.poeira || 0); gl.uniform1f(u.uScratch, bypass ? 0 : s.riscos || 0); gl.uniform1f(u.uLeak, bypass ? 0 : s.luzVazada || 0);
    gl.uniform1f(u.uDustSeed, sorte % 97); gl.uniform1f(u.uScrSeed, (sorte * 1.7) % 89); gl.uniform1f(u.uLeakSeed, (sl * 2.3) % 83);
    gl.uniform1f(u.uLeakType, +(s.luzTipo ?? 0));
    // revelação: puxar (−1 a +3 pontos) e vencido (0 a 1, tom do rolo sorteado)
    const pu = bypass ? 0 : s.puxar || 0, ve = bypass ? 0 : s.vencido || 0, rv = rnd((s.sorteVenc ?? 5) + 0.5);
    gl.uniform1f(u.uPush, pu); gl.uniform1f(u.uVenc, ve);
    gl.uniform3f(u.uVencCor, rv() * 2 - 1, rv() * 2 - 1, rv() * 2 - 1);
    gl.uniform1f(u.uGrainMul, Math.pow(1.45, pu) * (1 + 0.7 * ve));   // puxado e vencido: mais grão; segurado: menos
    gl.uniform4f(u.uLeakP, lp[0], lp[1], lp[2], lp[3]);   // (antes ficava dentro do comentário acima e a posição da luz vazada não era sorteada)
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
      // oval desenhado (a, b em fração da foto) ou o padrão de um toque; × "Tamanho do rosto"
      const k = s.rostoTam ?? 1, mm = Math.min(this.w, this.h);
      const fa = (s.rosto.a ?? 0.16 * mm / this.w) * k, fb = (s.rosto.b ?? 0.2 * mm / this.h) * k;
      gl.uniform4f(u.uFace, s.rosto.x, s.rosto.y, fa * 1.1, fb * 1.1);
      gl.uniform1f(u.uFaceLod, Math.max(0, Math.log2(Math.min(fa * this.w, fb * this.h) * 0.7)));
      gl.uniform1f(u.uSep, s.separacao ?? 0.5); gl.uniform1f(u.uPele6, m.retrato.pele_v6); gl.uniform1f(u.uPele5, m.retrato.pele_v5);
    }
    // ajustes finos
    const z = (k) => (bypass ? 0 : s[k] || 0);
    for (const [n, k] of [['uBri', 'brilho'], ['uCon', 'contraste'], ['uRea', 'realces'], ['uSom', 'sombras'], ['uBra', 'brancos'], ['uPre2', 'pretos'], ['uSat', 'saturacao'], ['uVib', 'vibracao'],
      ['uPele', 'pele'], ['uFade', 'esmaecer'], ['uVig', 'vinheta'], ['uNit', 'nitidez'], ['uClar', 'clareza'], ['uDif', 'difusao']]) gl.uniform1f(u[n], z(k));
    const hs = s.hsl || HSL0, temHsl = !bypass && hs.some((c) => c[0] || c[1] || c[2]);
    gl.uniform1f(u.uTemHsl, temHsl ? 1 : 0);
    if (temHsl) { gl.uniform1fv(u.uHslH, hs.map((c) => c[0])); gl.uniform1fv(u.uHslS, hs.map((c) => c[1])); gl.uniform1fv(u.uHslL, hs.map((c) => c[2])); }
    const temCurva = !bypass && curvaMexida(s.curvas);
    gl.uniform1f(u.uTemCurva, temCurva ? 1 : 0);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.curva);
    if (temCurva) {
      const ch = JSON.stringify(s.curvas);
      if (ch !== this.curvaChave) {
        this.curvaChave = ch;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, tabelaCurva(s.curvas));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
    }
    // geometria (corte, giro, espelho, endireitar): da saída para a foto; a comparação com a original mantém o corte
    const G = geometria(s, this.w, this.h, !!s.semCorte);
    gl.uniformMatrix3fv(u.uGeo, false, G.m); gl.uniform2f(u.uTexel, 1 / this.w, 1 / this.h);
    this.geo = G;
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

// ------------------------------------------------------------ cor por faixa (HSL) e curvas
export const HSL0 = Array.from({ length: 8 }, () => [0, 0, 0]);
export const CURVA0 = { l: [[0, 0], [1, 1]], r: [[0, 0], [1, 1]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] };
export function curvaMexida(c) {
  if (!c) return false;
  return Object.values(c).some((p) => p.length !== 2 || p[0][0] !== 0 || p[0][1] !== 0 || p[1][0] !== 1 || p[1][1] !== 1);
}
// curva suave que passa pelos pontos e nunca volta para trás (cúbica monótona de Fritsch–Carlson)
export function amostraCurva(pts, n = 256) {
  const p = [...pts].sort((a, b) => a[0] - b[0]), N = p.length, out = new Float32Array(n);
  const d = [], m = new Array(N).fill(0);
  for (let i = 0; i < N - 1; i++) d.push((p[i + 1][1] - p[i][1]) / Math.max(p[i + 1][0] - p[i][0], 1e-6));
  m[0] = d[0]; m[N - 1] = d[N - 2];
  for (let i = 1; i < N - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < N - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  for (let j = 0; j < n; j++) {
    const x = j / (n - 1);
    let y;
    if (x <= p[0][0]) y = p[0][1]; else if (x >= p[N - 1][0]) y = p[N - 1][1];
    else {
      let i = 0; while (x > p[i + 1][0]) i++;
      const h = p[i + 1][0] - p[i][0], t = (x - p[i][0]) / h, t2 = t * t, t3 = t2 * t;
      y = (2 * t3 - 3 * t2 + 1) * p[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * p[i + 1][1] + (t3 - t2) * h * m[i + 1];
    }
    out[j] = Math.min(1, Math.max(0, y));
  }
  return out;
}
// tabela 256×1: cada canal passa primeiro pela curva de luz (as três cores juntas) e depois pela sua
function tabelaCurva(c) {
  const L = amostraCurva(c.l), ch = ['r', 'g', 'b'].map((k) => amostraCurva(c[k])), t = new Uint8Array(256 * 4);
  const at = (a, x) => { const f = x * 255, i = Math.min(254, Math.floor(f)), k = f - i; return a[i] * (1 - k) + a[i + 1] * k; };
  for (let i = 0; i < 256; i++) { for (let j = 0; j < 3; j++) t[i * 4 + j] = Math.round(at(ch[j], L[i]) * 255); t[i * 4 + 3] = 255; }
  return t;
}

// ------------------------------------------------------------ geometria: corte, giro (90°), espelho e endireitar
// s.giro: 0..3 (×90° no sentido do relógio); s.espelho: 0/1; s.endireitar: graus (−45..45);
// s.corte: {x, y, w, h} em fração do quadro já girado (null = a foto inteira, encaixada se estiver endireitada)
// Devolve a matriz saída(0..1) -> foto(0..1), o tamanho do corte em pixels da foto e o quadro girado (QW×QH).
export function quadroGirado(s, W, H) { return (s.giro || 0) % 2 ? [H, W] : [W, H]; }
export function dentro(s, W, H, c) {   // o corte cabe dentro da foto endireitada?
  const [QW, QH] = quadroGirado(s, W, H), th = -(s.endireitar || 0) * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
  for (const [fx, fy] of [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]]) {
    const px = fx * QW - QW / 2, py = fy * QH - QH / 2, rx = co * px - si * py + QW / 2, ry = si * px + co * py + QH / 2;
    if (rx < -0.5 || ry < -0.5 || rx > QW + 0.5 || ry > QH + 0.5) return false;
  }
  return true;
}
export function encaixa(s, W, H, c) {   // diminui o corte em volta do centro até caber (endireitar dá zoom, como no iPhone)
  if (dentro(s, W, H, c)) return c;
  let lo = 0, hi = 1;
  const em = (k) => ({ x: c.x + c.w * (1 - k) / 2, y: c.y + c.h * (1 - k) / 2, w: c.w * k, h: c.h * k });
  for (let i = 0; i < 30; i++) { const k = (lo + hi) / 2; if (dentro(s, W, H, em(k))) lo = k; else hi = k; }
  // se nem pequeno cabe (o centro saiu da foto), volta para o centro do quadro
  const r = em(lo); if (lo > 0.02) return r;
  return encaixa(s, W, H, { x: 0.5 - c.w / 2, y: 0.5 - c.h / 2, w: c.w, h: c.h });
}
export function geometria(s, W, H, semCorte = false) {
  const [QW, QH] = quadroGirado(s, W, H), g = (s.giro || 0) % 4;
  const c = semCorte ? { x: 0, y: 0, w: 1, h: 1 } : encaixa(s, W, H, s.corte || { x: 0, y: 0, w: 1, h: 1 });
  const th = -(s.endireitar || 0) * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
  // composição de afins 2D [a b c; d e f] (linha) — saída -> quadro (px) -> desfaz endireitar -> desfaz espelho -> desfaz giro -> foto (0..1)
  const mul = (A, B) => [A[0] * B[0] + A[1] * B[3], A[0] * B[1] + A[1] * B[4], A[0] * B[2] + A[1] * B[5] + A[2],
                         A[3] * B[0] + A[4] * B[3], A[3] * B[1] + A[4] * B[4], A[3] * B[2] + A[4] * B[5] + A[5]];
  let M = [c.w * QW, 0, c.x * QW, 0, c.h * QH, c.y * QH];
  M = mul([1, 0, -QW / 2, 0, 1, -QH / 2], M); M = mul([co, -si, 0, si, co, 0], M); M = mul([1, 0, QW / 2, 0, 1, QH / 2], M);
  if (s.espelho) M = mul([-1, 0, QW, 0, 1, 0], M);
  const G = [[1, 0, 0, 0, 1, 0], [0, 1, 0, -1, 0, H], [-1, 0, W, 0, -1, H], [0, -1, W, 1, 0, 0]][g];   // quadro -> foto (px)
  M = mul(G, M); M = mul([1 / W, 0, 0, 0, 1 / H, 0], M);
  return { m: new Float32Array([M[0], M[3], 0, M[1], M[4], 0, M[2], M[5], 1]), w: c.w * QW, h: c.h * QH, QW, QH, corte: c, a: M };
}
