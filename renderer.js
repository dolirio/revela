import { identityLut } from './looks.js';

// Valores padrão de todos os parâmetros que o shader entende.
export const RDEF = {
  mix: 1, ftone: 0, fcol: 0, exp: 0, con: 0, high: 0, shad: 0, white: 0, black: 0, temp: 0, tint: 0, sat: 0, vib: 0, depth: 0,
  clar: 0, sharp: 0, srad: 1, soft: 0, eblur: 0, bloom: 0, bloomR: 0.5, chroma: 0, vlens: 0,
  grain: 0, gsize: 1.6, grough: 0.4, gcolor: 0, gfmt: 0, paper: 0, paperType: 0, paperSeed: 0,
  gfx: 0, gfxAmt: 1, gfxSize: 0.5, gfxCon: 0,
  fade: 0, halo: 0, haloR: 0.5, haloT: 0.5, vig: 0, leak: 0, dust: 0, scratch: 0,
};
const HSL_ZERO = new Float32Array(8);

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv; out vec4 o;
uniform sampler2D uImg; uniform sampler2D uCurve; uniform sampler3D uLut; uniform sampler2D uOver;
uniform float uLutN, uMix, uExp, uBright, uCon, uHigh, uShad, uWhite, uBlack, uTemp, uTint, uSat, uVib, uDepth, uClar;
uniform float uSharp, uSRad, uSoft, uEBlur, uBloom, uBloomR, uChroma, uSrcScale, uTexLong, uVLens, uHaloR, uHaloT, uClarR;
uniform float uFade, uGrain, uGrainSize, uGRough, uGColor, uPaper, uPaperType, uPaperSeed, uPxScale;
uniform float uGfx, uGfxAmt, uGfxSize, uGfxCon; uniform vec3 uGfxA, uGfxB, uGfxC;
uniform float uVig, uHalo, uHaloLod, uClarLod, uBypass, uDust, uDustType, uDustSeed, uScratch, uLeak, uSeed;
uniform vec2 uRes, uTexel, uOut;
uniform mat3 uGeo, uPersp; uniform float uLens;
uniform vec4 uInner, uZoom, uBorder;
uniform vec3 uFrameCol; uniform float uFrameRound, uFrameRough, uHoles, uOverOn;
uniform float uHslH[8]; uniform float uHslS[8]; uniform float uHslL[8];
uniform float uGFmt;
uniform float uFTone, uFCol;   // afinar o filme: Tom (exposição do negativo) e Cor (filtro na frente da lente)   // formato do filme: 1 = 35 mm; menor = quadro maior (grão menor na foto)
uniform vec4 uPrint;   // cópia em papel: x = maciez, y = acutância, z = luz espalhada no papel, w = maciez na borda (lente)
uniform vec4 uLeakP; uniform float uLeakType, uLeakSeed, uScrType, uScrSeed, uChromaType;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y); float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0*d + e)), d / (q.x + e), q.x); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
const float HC[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 225.0, 270.0, 315.0);

// saída (0..1 da área da foto) -> coordenada na textura: corte, endireitar, perspectiva, lente, giro/espelho
vec2 srcUv(vec2 iu){
  vec3 h = uPersp * vec3(iu, 1.0);
  vec2 p = h.xy / h.z;
  p *= 1.0 + uLens * dot(p, p);
  return (uGeo * vec3(p, 1.0)).xy;
}
// desfoque em disco (16 amostras), raio em pixels da textura
vec3 blurAt(vec2 su, float r){
  float lod = max(0.0, log2(r) - 2.0);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 2.39996, d = sqrt((float(i) + 0.5) / 16.0);
    acc += textureLod(uImg, su + vec2(cos(a), sin(a)) * d * r * uTexel, lod).rgb;
  }
  return acc / 16.0;
}
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
// textura de papel: fibras + relevo, devolve variação em torno de 0
float paperTex(vec2 p){
  float h = vnoise(p * 0.9) * 0.5 + vnoise(p * 2.3 + 5.1) * 0.3 + vnoise(vec2(p.x * 7.0, p.y * 1.6) + 9.7) * 0.2;
  float h2 = vnoise((p + vec2(0.35, 0.25)) * 0.9) * 0.5 + vnoise((p + vec2(0.35, 0.25)) * 2.3 + 5.1) * 0.3
           + vnoise(vec2((p.x + 0.35) * 7.0, (p.y + 0.25) * 1.6) + 9.7) * 0.2;
  return (h - h2) * 1.6 + (h - 0.5) * 0.35;
}
// tela: fios de trama e urdidura que passam um por cima do outro; devolve relevo em torno de 0
float canvasTex(vec2 p){
  vec2 cell = floor(p), f = fract(p);
  float jx = (vnoise(vec2(p.y * 0.35, cell.x * 1.7)) - 0.5) * 0.35, jy = (vnoise(vec2(p.x * 0.35, cell.y * 1.3 + 40.0)) - 0.5) * 0.35;
  float wx = sin(clamp(f.x + jx, 0.0, 1.0) * 3.14159), wy = sin(clamp(f.y + jy, 0.0, 1.0) * 3.14159);
  float top = mod(cell.x + cell.y, 2.0);
  float th = 0.75 + 0.5 * vnoise(cell * 0.7 + 3.0);                  // espessura irregular do fio
  float h = mix(wy * sin(f.x * 3.14159), wx * sin(f.y * 3.14159), top) * th;
  return (h - 0.42) + (vnoise(p * 3.1) - 0.5) * 0.25;
}
// retícula CMYK: g = posição na grade de pontos, w = 0 quando o ponto é pequeno demais na tela
vec3 cmykScreen(vec3 x, vec2 g, float w, float aj, vec3 paperW);
// um canal da retícula: grade girada, ponto redondo do tamanho da cobertura
float htDot(vec2 p, float ang, float v, float sharpW){
  vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  vec2 f = fract(q) - 0.5;
  float d = length(f), r = sqrt(clamp(v, 0.0, 1.0)) * 0.7071;
  float aa = max(fwidth(d), 1e-4) * 0.8;
  float dot = 1.0 - smoothstep(r - aa, r + aa, d);
  return mix(v, dot, sharpW);                                        // pequeno demais na tela: vira a cobertura média
}
vec3 cmykScreen(vec3 x, vec2 g, float w, float aj, vec3 paperW){
  x = clamp(x, 0.0, 1.0);
  float k = 1.0 - max(max(x.r, x.g), x.b), kk = k * 0.75;
  vec3 cmy = clamp((1.0 - x - kk) / max(1.0 - kk, 1e-3), 0.0, 1.0);
  float dc = htDot(g, 0.2618 + aj, cmy.r, w), dm = htDot(g, 1.309 + aj, cmy.g, w);
  float dy = htDot(g, 0.0 + aj, cmy.b, w), dk = htDot(g, 0.7854 + aj, kk, w);
  vec3 r = paperW * mix(vec3(1.0), vec3(0.05, 0.6, 0.88), dc) * mix(vec3(1.0), vec3(0.9, 0.12, 0.52), dm)
         * mix(vec3(1.0), vec3(1.0, 0.9, 0.08), dy) * mix(vec3(1.0), vec3(0.1, 0.1, 0.11), dk);
  return pow(r, vec3(0.88));                       // ganho de ponto e tinta um pouco mais clara
}

// ---------- poeira: cada modelo é uma combinação fixa de camadas; a intensidade só muda a opacidade
// pontos (alfa, tom). sc = células por altura; p = chance de ter partícula na célula
vec2 specks(vec2 q, float sc, float p, float rmin, float rmax, float elong, float soft, float off){
  vec2 gp = q * sc;
  vec2 cell = floor(gp) + off + uDustSeed * 13.7;
  if (hash(cell) >= p) return vec2(0.0);
  vec2 dv = fract(gp) - (0.25 + 0.5 * vec2(hash(cell + 1.7), hash(cell + 3.1)));
  float ang = hash(cell + 7.7) * 6.283;
  dv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * dv;
  dv.x /= mix(1.0, elong, step(0.6, hash(cell + 4.4)));
  float rr = mix(rmin, rmax, hash(cell + 5.3)) * (0.8 + 0.4 * vnoise(dv * 24.0 + cell * 3.1)); // contorno irregular
  float d = length(dv) / rr;
  float aa = 1.0 - smoothstep(1.0 - max(fwidth(d) * 1.5, soft), 1.0, d);
  return vec2(aa, hash(cell + 9.1));
}
// fiapos e pelos: traço fino e curvo com pontas afinando
vec2 hairs(vec2 q, float sc, float p, float off){
  vec2 gp = q * sc;
  vec2 cell = floor(gp) + off + uDustSeed * 13.7;
  if (hash(cell) >= p) return vec2(0.0);
  vec2 dv = fract(gp) - (0.38 + 0.24 * vec2(hash(cell + 1.3), hash(cell + 2.9)));
  float ang = hash(cell + 6.1) * 6.283;
  dv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * dv;
  float len = mix(0.12, 0.3, hash(cell + 8.2));
  float bend = (hash(cell + 3.7) - 0.5) * 2.4;
  float y = bend * dv.x * dv.x + 0.006 * sin(dv.x * 18.0 + hash(cell) * 6.0);
  float px = fwidth(gp.y);
  float w = max(0.0035, px * 0.45);
  float d = abs(dv.y - y);
  float aa = (1.0 - smoothstep(w, w + px * 1.2, d)) * (1.0 - smoothstep(len * 0.75, len, abs(dv.x)));
  return vec2(aa, hash(cell + 9.1));
}

// ruído de gradiente (Perlin): sem as "dobras" do ruído de valor, que viram linhas em áreas grandes e lisas
vec2 grad2(vec2 i){ float a = hash(i) * 6.2832; return vec2(cos(a), sin(a)); }
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n = mix(mix(dot(grad2(i), f), dot(grad2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
                mix(dot(grad2(i + vec2(0, 1)), f - vec2(0, 1)), dot(grad2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
  return clamp(0.5 + 0.75 * n, 0.0, 1.0);
}
// ---------- etapa B: light leaks, arranhões (bibliotecas com dado) ----------
float fbm2(vec2 p){ return 0.55 * gnoise(p) + 0.3 * gnoise(p * 2.03 + 7.1) + 0.15 * gnoise(p * 4.1 + 3.7); }
// rampa de cor de um light leak: fraco = vermelho, médio = laranja, forte = amarelo, queimado = quase branco
vec3 leakRamp(float x, float warm, float cool){
  vec3 r = mix(vec3(0.72, 0.05, 0.04), vec3(0.92, 0.22, 0.05), warm);
  vec3 o = mix(vec3(1.0, 0.36, 0.07), vec3(1.0, 0.56, 0.12), warm);
  vec3 y = vec3(1.0, 0.86, 0.52), w = vec3(1.0, 0.97, 0.9);
  if (cool > 0.5) { r = vec3(0.2, 0.08, 0.42); o = vec3(0.3, 0.42, 0.95); y = vec3(0.78, 0.72, 1.0); w = vec3(0.95, 0.95, 1.0); }
  // transições suaves (sem quinas na rampa, que viravam linhas visíveis nas curvas de nível)
  vec3 col = r * smoothstep(0.0, 0.45, x);
  col = mix(col, o, smoothstep(0.25, 0.75, x));
  col = mix(col, y, smoothstep(0.55, 1.05, x));
  return mix(col, w, smoothstep(0.9, 1.35, x));
}
// intensidade do vazamento (0 a ~1.3). O filme corre no sentido do lado maior da foto: a tampa vaza pelas bordas
// longas (onde fica a borda do filme); dobradiça, ponta do rolo e divisa entre fotos ficam nas bordas curtas.
float leakField(vec2 iu, out float cool){
  cool = 0.0;
  int t = int(uLeakType + 0.5);
  float sd = uLeakSeed, bit = uLeakP.x;
  bool land = uRes.x >= uRes.y;
  bool longEdge = t == 0 || t == 5 || (t == 4 && hash(vec2(sd, 4.0)) > 0.5);
  int side = longEdge ? (land ? (bit > 0.5 ? 2 : 3) : (bit > 0.5 ? 0 : 1)) : (land ? (bit > 0.5 ? 0 : 1) : (bit > 0.5 ? 2 : 3));
  float d, s;
  if (side == 0) { d = iu.x; s = iu.y; } else if (side == 1) { d = 1.0 - iu.x; s = iu.y; }
  else if (side == 2) { d = iu.y; s = iu.x; } else { d = 1.0 - iu.y; s = iu.x; }
  float sh = min(uRes.x, uRes.y);
  float lenD = side < 2 ? uRes.x : uRes.y, lenS = side < 2 ? uRes.y : uRes.x;
  float dn = d * lenD / sh, sn = s * lenS / sh, tp = uLeakP.y * lenS / sh, w = uLeakP.z, v = uLeakP.w;
  if (t == 0) {          // tampa: faixa irregular entrando pela borda do filme, com plumas
    float along = exp(-pow((sn - tp) / (0.5 + 0.9 * w), 2.0));
    float plume = 0.5 + 0.5 * fbm2(vec2(sn * 7.0 + sd, dn * 1.3));
    float depth = (0.1 + 0.22 * w) * (0.55 + 0.9 * fbm2(vec2(sn * 2.2 + sd * 3.0, 0.5)));
    return 1.75 * along * exp(-dn / depth) * plume;
  } else if (t == 1) {   // dobradiça: mancha forte numa borda curta, com núcleo queimado
    vec2 q = vec2(dn / (0.22 + 0.28 * w), (sn - tp) / (0.3 + 0.35 * w));
    float n = fbm2(vec2(sn, dn) * 3.5 + sd);
    return 1.65 * exp(-dot(q, q) * 1.3) * (0.7 + 0.45 * n) + 0.25 * exp(-dn / 0.05) * n;
  } else if (t == 2) {   // ponta do rolo: parte da foto queimada, fronteira ondulada
    float bnd = 0.2 + 0.35 * w + (fbm2(vec2(sn * 1.8 + sd, 1.0)) - 0.5) * 0.3;
    return 1.4 * (1.0 - smoothstep(bnd - 0.4, bnd + 0.06, dn)) * (0.8 + 0.3 * fbm2(vec2(sn * 3.0, dn * 3.0) + sd));
  } else if (t == 3) {   // entre fotos: faixa vertical estreita perto da divisa, que some e volta
    float d0 = 0.03 + 0.12 * v, bw = 0.025 + 0.06 * w;
    float wob = (gnoise(vec2(sn * 1.5 + sd, 0.5)) - 0.5) * 0.04;
    float band = exp(-pow((dn - d0 - wob) / bw, 2.0)) * (0.45 + 0.75 * fbm2(vec2(sn * 2.5 + sd, 2.0)));
    return 1.25 * band + 0.4 * exp(-dn / 0.06) * fbm2(vec2(sn * 4.0, sd));
  } else if (t == 4) {   // frontal: véu frio e macio (luz entrando pela frente da câmera)
    cool = 1.0;
    vec2 q = vec2(dn - (0.1 + 0.35 * v), sn - tp) / (0.45 + 0.45 * w);
    return 0.55 * exp(-dot(q, q)) * (0.8 + 0.3 * fbm2(vec2(sn, dn) * 2.0 + sd));
  }
  // raios: furinho na vedação, feixes saindo de um ponto da borda
  vec2 rel = vec2(dn, sn - tp);
  float ang = atan(rel.y, rel.x + 1e-4), dist = length(rel);
  // poucos feixes largos e macios que se abrem com a distância (não uma estrela desenhada)
  float rays = smoothstep(0.42, 0.9, gnoise(vec2(ang * 2.6 + sd, sd * 0.37)));
  float soft = 0.35 + 0.65 * gnoise(vec2(dist * 3.0 + sd, ang * 1.5));
  return 1.1 * rays * soft * exp(-dist / (0.3 + 0.45 * w)) + 1.2 * exp(-dist * dist / (0.02 + 0.03 * w));
}
// linha com espessura real (em pixels da foto final): fina demais para a tela vira linha mais clara, como na foto reduzida
float lineAA(float d, float w, float px){ float ww = max(w, px); return (1.0 - smoothstep(ww * 0.5, ww * 0.5 + px, d)) * min(1.0, w / max(px, 1e-4)); }
// arranhões: alfa (0..1); colored = 1 nos riscos coloridos de emulsão
float scratchOf(vec2 iu, float am, out float colored){
  colored = 0.0;
  int t = int(uScrType + 0.5);
  float sd = uScrSeed;
  bool land = uRes.x >= uRes.y;
  vec2 P = iu * uRes;
  float A = land ? P.x : P.y, B = land ? P.y : P.x;      // A: sentido em que o filme corre (lado maior); B: atravessado
  float LA = land ? uRes.x : uRes.y, LB = land ? uRes.y : uRes.x, sh = min(uRes.x, uRes.y);
  float pxA = max(fwidth(A), 1e-3), pxB = max(fwidth(B), 1e-3);
  float a = 0.0;
  if (t == 0 || t == 4) {   // câmera: riscos longos no sentido do filme; emulsão (slide): poucos, largos e coloridos
    colored = t == 4 ? 1.0 : 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      if (hash(vec2(fi, sd + 9.0)) > (t == 4 ? 0.15 + 0.35 * am : 0.3 + 0.7 * am) || (t == 4 && i > 2)) continue;
      float pos = LB * (0.06 + 0.88 * hash(vec2(fi, sd + 1.0)));
      float wob = (gnoise(vec2(A / LA * 1.7 + fi * 7.0, sd)) - 0.5) * sh * 0.008;
      float wd = (t == 4 ? 3.0 + 5.0 * hash(vec2(fi, sd + 2.0)) : 0.7 + 2.0 * hash(vec2(fi, sd + 2.0))) * (0.6 + 0.8 * gnoise(vec2(A / LA * 9.0, fi + sd)));
      float seg = smoothstep(0.22, 0.42, gnoise(vec2(A / LA * 3.5 + fi * 3.3, sd + 5.0)));
      float st = LA * hash(vec2(fi, sd + 3.0)) * 0.6 * step(0.55, hash(vec2(fi, sd + 4.0)));
      float l = lineAA(abs(B - pos - wob), wd, pxB) * seg * step(st, A);
      if (hash(vec2(fi, sd + 6.0)) > 0.6) l = max(l, 0.7 * lineAA(abs(B - pos - wob - (3.0 + 4.0 * hash(vec2(fi, sd + 7.0)))), wd * 0.6, pxB) * seg * step(st, A));
      a = max(a, l);
    }
  } else if (t == 1) {      // projeção (cinema): riscos atravessados que tremem e aparecem em trechos
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      if (hash(vec2(fi, sd + 9.0)) > 0.25 + 0.75 * am) continue;
      float pos = LA * (0.04 + 0.92 * hash(vec2(fi, sd + 1.0)));
      float wob = (gnoise(vec2(B / LB * 3.0 + fi * 5.0, sd)) - 0.5) * sh * 0.018;
      float wd = 0.8 + 1.8 * hash(vec2(fi, sd + 2.0));
      float seg = smoothstep(0.42, 0.58, gnoise(vec2(B / LB * 10.0 + fi * 5.1, sd + 3.0)));
      a = max(a, lineAA(abs(A - pos - wob), wd, pxA) * seg * (0.6 + 0.4 * hash(vec2(fi, sd + 4.0))));
    }
  } else if (t == 2) {      // manuseio: microarranhões curtos em todas as direções
    vec2 N = P / sh;
    for (int L = 0; L < 2; L++) {
      float sc = L == 0 ? 7.0 : 15.0;
      vec2 g = N * sc, cell = floor(g) + float(L) * 37.0 + sd * 3.1;
      if (hash(cell) > 0.12 + 0.45 * am) continue;
      vec2 dv = fract(g) - (0.4 + 0.2 * vec2(hash(cell + 1.1), hash(cell + 2.3)));
      float an = hash(cell + 3.7) * 3.1416;
      vec2 uv = mat2(cos(an), -sin(an), sin(an), cos(an)) * dv;
      float hl = 0.12 + 0.22 * hash(cell + 4.9);
      float bend = (hash(cell + 5.3) - 0.5) * 1.6;
      float dd = abs(uv.y - bend * uv.x * uv.x) * sh / sc;
      float taper = 1.0 - smoothstep(hl * 0.55, hl, abs(uv.x));
      a = max(a, lineAA(dd, 0.5 + 1.1 * hash(cell + 6.1), pxA) * taper * 0.85);
    }
  } else if (t == 3) {      // vinco: dobra curva com rachadura fina e um leve halo
    vec2 N = P / sh, mid = uRes / sh * 0.5;
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      if (i == 1 && hash(vec2(sd, 3.0)) > am) continue;
      float th = hash(vec2(sd + fi, 1.0)) * 6.2832, Rr = 1.1 + 1.6 * hash(vec2(sd + fi, 2.0));
      vec2 C = mid + vec2(cos(th), sin(th)) * Rr + (vec2(hash(vec2(sd, fi + 5.0)), hash(vec2(sd, fi + 6.0))) - 0.5) * 0.6;
      float dist = length(N - C) - Rr + (fbm2(N * 9.0 + sd + fi) - 0.5) * 0.012;
      float dp = abs(dist) * sh;
      a = max(a, lineAA(dp, 1.3 + fi * 0.5, pxA) + 0.22 * exp(-dp / (4.0 + 6.0 * am)));
    }
  } else {                  // marca de dedo: digital leve e oleosa
    vec2 N = P / sh, C = vec2(0.2 + 0.6 * hash(vec2(sd, 1.0)), 0.2 + 0.6 * hash(vec2(sd, 2.0))) * uRes / sh;
    float an = hash(vec2(sd, 3.0)) * 3.1416;
    vec2 rel = mat2(cos(an), -sin(an), sin(an), cos(an)) * (N - C);
    float e = length(rel / vec2(0.07, 0.095));
    float mask = 1.0 - smoothstep(0.65, 1.0, e);
    float rr = e * 20.0 + (fbm2(rel * 30.0 + sd) - 0.5) * 3.0;
    float ridge = smoothstep(0.5, 0.95, 0.5 + 0.5 * sin(rr * 6.2832));
    float ridgePx = 0.095 * sh / 20.0;                   // largura de cada sulco em pixels da foto final
    ridge = mix(0.5, ridge, clamp(ridgePx / (pxA * 2.0), 0.0, 1.0));   // reduzida, a digital vira só uma mancha
    a = mask * (0.08 + 0.24 * ridge);
  }
  return clamp(a, 0.0, 1.0);
}
vec2 dustOf(vec2 q){
  int t = int(uDustType + 0.5);
  vec2 a = vec2(0.0), b;
  if (t == 0) {        // fina: muitos pontinhos
    a = specks(q, 70.0, 0.32, 0.05, 0.13, 2.0, 0.0, 0.0);
    b = specks(q, 150.0, 0.25, 0.05, 0.1, 1.0, 0.0, 31.0); if (b.x > a.x) a = b;
  } else if (t == 1) { // média: pontos e grãos alongados
    a = specks(q, 16.0, 0.3, 0.02, 0.07, 4.0, 0.0, 0.0);
    b = specks(q, 45.0, 0.38, 0.04, 0.1, 2.0, 0.0, 91.0); if (b.x > a.x) a = b;
  } else if (t == 2) { // fiapos
    a = hairs(q, 4.0, 0.35, 0.0);
    b = hairs(q, 7.0, 0.2, 17.0); if (b.x > a.x) a = b;
    b = specks(q, 40.0, 0.12, 0.05, 0.1, 2.0, 0.0, 5.0); if (b.x > a.x) a = b;
  } else if (t == 3) { // manchas: marcas grandes e macias de scanner
    a = specks(q, 6.0, 0.32, 0.05, 0.14, 1.8, 0.45, 0.0); a.x *= 0.7;
    b = specks(q, 30.0, 0.2, 0.04, 0.1, 2.0, 0.0, 7.0); if (b.x > a.x) a = b;
  } else if (t == 4) { // mista
    a = specks(q, 18.0, 0.25, 0.02, 0.07, 3.0, 0.0, 0.0);
    b = hairs(q, 5.0, 0.3, 3.0); if (b.x > a.x) a = b;
    b = specks(q, 80.0, 0.2, 0.05, 0.12, 1.5, 0.0, 41.0); if (b.x > a.x) a = b;
    b = specks(q, 7.0, 0.15, 0.05, 0.12, 1.6, 0.4, 61.0); b.x *= 0.6; if (b.x > a.x) a = b;
  } else {             // pesada: rolo muito sujo
    a = specks(q, 22.0, 0.55, 0.02, 0.08, 3.0, 0.0, 0.0);
    b = specks(q, 60.0, 0.5, 0.05, 0.12, 2.0, 0.0, 23.0); if (b.x > a.x) a = b;
    b = hairs(q, 6.0, 0.45, 11.0); if (b.x > a.x) a = b;
    b = hairs(q, 3.0, 0.4, 29.0); if (b.x > a.x) a = b;
  }
  return a;
}

// ---------- grão de filme
// A imagem do filme é feita de grãos: pontos de tamanhos variados, espalhados ao acaso, e quanto mais escuro o tom,
// mais grãos revelados (modelo booleano, como no trabalho de Newson, Delon e Galerne sobre grão realista).
// O desenho nasce do próprio tom: o grão é máximo nos meios-tons e some sozinho no branco.
vec4 hash4(vec3 p){
  vec4 q = fract(vec4(p.xyzx) * vec4(0.1031, 0.103, 0.0973, 0.1099));
  q += dot(q, q.wzxy + 33.33);
  return fract((q.xxyz + q.yzzw) * q.zywx);
}
// p: posição em "células" (espaçamento médio entre grãos); D: cobertura pedida (0 branco .. 1 preto);
// e: maciez da borda (em células); devolve (esperado - cobertura): positivo = mais claro que a média
float grainLayer(vec2 p, float D, float rough, float e, float sd){
  const float N = 2.0, RM = 0.42;
  float a0 = 1.0 - 0.45 * rough, a1 = 0.9 * rough;               // aspereza = tamanhos mais variados
  float area = 3.14159 * RM * RM * (a0 * a0 + a0 * a1 + a1 * a1 / 3.0);
  float q = clamp(-log(max(1.0 - D, 0.001)) / (N * area), 0.0, 1.0);
  vec2 ip = floor(p);
  float clump = 1.0 + rough * 0.9 * (vnoise(p * 0.23 + sd) - 0.5);  // aglomerados: grãos se juntam em nuvens
  float qq = clamp(q * clump, 0.0, 1.0);
  float keep = 1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cell = ip + vec2(i, j);
    for (int k = 0; k < 2; k++) {
      vec4 h = hash4(vec3(cell, float(k) * 7.31 + sd));
      if (h.w >= qq) continue;                                    // grão não revelado neste tom
      float r = RM * (a0 + a1 * h.z);
      float d = length(p - cell - h.xy);
      float a = 1.0 - smoothstep(r - e, r + e, d);
      keep *= 1.0 - a;
    }
  }
  float cov = 1.0 - keep, ex = 1.0 - exp(-N * q * area);
  return ex - cov;
}

void main(){
  vec2 ou = vUv, op = ou * uOut;
  // ---------- moldura
  vec4 e = vec4(op.y - uBorder.x, (uOut.x - uBorder.y) - op.x, (uOut.y - uBorder.z) - op.y, op.x - uBorder.w); // topo, dir, baixo, esq
  if (uFrameRough > 0.0) {
    float bw = max(min(uOut.x, uOut.y) * 0.012, 1.0);
    e.x -= uFrameRough * bw * (vnoise(vec2(op.x / bw * 0.35, 1.0)) + 0.6 * vnoise(vec2(op.x / bw * 1.7, 4.0)));
    e.z -= uFrameRough * bw * (vnoise(vec2(op.x / bw * 0.35, 7.0)) + 0.6 * vnoise(vec2(op.x / bw * 1.7, 9.0)));
    e.y -= uFrameRough * bw * (vnoise(vec2(op.y / bw * 0.35, 3.0)) + 0.6 * vnoise(vec2(op.y / bw * 1.7, 5.0)));
    e.w -= uFrameRough * bw * (vnoise(vec2(op.y / bw * 0.35, 6.0)) + 0.6 * vnoise(vec2(op.y / bw * 1.7, 8.0)));
  }
  bool frame = min(min(e.x, e.y), min(e.z, e.w)) < 0.0;
  vec2 iu = (ou - uInner.xy) / (uInner.zw - uInner.xy);
  if (!frame && uFrameRound > 0.0) {
    float r = uFrameRound * min(uRes.x, uRes.y);
    vec2 d = min(iu, 1.0 - iu) * uRes;
    if (d.x < r && d.y < r && length(vec2(r) - d) > r) frame = true;
  }
  if (frame) {
    vec3 c = uFrameCol;
    if (uHoles > 0.0) {
      float u = uHoles;                      // largura da foto em px finais
      float pitch = u * 0.132, hw = u * 0.0275, hh = u * 0.039, rr = u * 0.008;
      float x = mod(op.x - uBorder.w + pitch * 0.5, pitch) - pitch * 0.5;
      float yt = uBorder.x - u * 0.06, yb = uOut.y - uBorder.z + u * 0.06;
      float d = min(sdBox(vec2(x, op.y - yt), vec2(hw, hh), rr), sdBox(vec2(x, op.y - yb), vec2(hw, hh), rr));
      c = mix(c, vec3(0.93, 0.92, 0.89), 1.0 - smoothstep(-0.75, 0.75, d / max(fwidth(op.x), 1e-4)));
    }
    c += (hash(op * 0.37) - 0.5) * 0.012;
    if (uOverOn > 0.5) { vec4 ov = texture(uOver, ou); c = mix(c, ov.rgb, ov.a); }
    if (uPaper > 0.0) {
      vec2 pp = op / max(uOut.x, uOut.y);
      int pt = int(uPaperType + 0.5);
      if (pt == 2) c *= 1.0 + canvasTex(pp * 260.0 + uPaperSeed * 7.3) * uPaper * 0.12;
      else c *= 1.0 + paperTex(pp * 900.0 + uPaperSeed * 11.1) * uPaper * (pt == 1 ? 0.16 : 0.12);
      if (pt == 1) c *= mix(vec3(1.0), vec3(1.0, 0.97, 0.9), uPaper);
    }
    o = vec4(clamp(c, 0.0, 1.0), 1.0); return;
  }
  iu = uZoom.xy + iu * uZoom.zw;
  vec2 su = srcUv(iu);
  if (su.x < -0.002 || su.y < -0.002 || su.x > 1.002 || su.y > 1.002) { o = vec4(0.08, 0.075, 0.07, 1.0); return; }
  vec3 c = texture(uImg, su).rgb;
  if (uBypass > 0.5) { o = vec4(c, 1.0); return; }

  float rr0 = length((iu - 0.5) * 2.0) / 1.4142;   // 0 no centro, 1 no canto
  // ---------- ótica: suavidade, desfoque de borda, aberração, nitidez
  // "Nitidez" à esquerda do zero amacia só os detalhes finos (raio pequeno); "suavidade" das receitas é mais forte
  float sn = max(-uSharp, 0.0);
  float edge2 = smoothstep(0.25, 1.0, rr0); edge2 *= edge2;
  float br = (uSoft * 0.0012 + uSoft * uSoft * 0.004 + sn * 0.003 + sn * sn * 0.003
            + (uEBlur * 0.007 + uVLens * 0.0065) * edge2) * uTexLong
            + (uPrint.x + uPrint.w * edge2) * uTexLong;    // cópia: ampliador e papel apagam o detalhe microscópico
  if (br > 0.35) c = blurAt(su, br);
  if (uPrint.y > 0.0) {
    // ...mas mantêm o contraste das formas (escala média): "macia, mas nítida"
    float R = 0.006 * uTexLong, lod = max(0.0, log2(R) - 1.5), lb = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854 + 0.2;
      lb += luma(textureLod(uImg, su + vec2(cos(a), sin(a)) * R * uTexel, lod).rgb);
    }
    float l = luma(c), d = l - lb / 8.0;
    d *= 1.0 / (1.0 + (d / 0.18) * (d / 0.18));
    c = clamp(c + d * uPrint.y * 0.6 * (1.0 - pow(abs(l * 2.0 - 1.0), 2.0)), 0.0, 1.0);
  }
  if (uPrint.z > 0.0) {
    // a luz entra no papel, anda um pouco por baixo da imagem e volta: as luzes acendem levemente as sombras vizinhas
    float R = 0.012 * uTexLong, lod = max(0.0, log2(R) - 1.0);
    vec3 w = textureLod(uImg, su, lod).rgb * 0.2;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854 + 0.4;
      w += textureLod(uImg, su + vec2(cos(a), sin(a)) * R * uTexel, lod).rgb * 0.1;
    }
    c += max(w - c, 0.0) * uPrint.z;
  }
  // Aberração cromática. Lateral: zero no centro, cresce rápido para as bordas (r²), vermelho para fora e azul
  // para dentro, com a borda menos nítida. Franja roxa (longitudinal): halo roxo nos escuros colados a luzes fortes,
  // em qualquer lugar da foto. Lente barata: lateral forte e descentrada + um pouco de franja.
  int cty = int(uChromaType + 0.5);
  float chA = uChroma * (0.35 + 0.65 * uChroma);
  float lat = (cty == 1 ? 0.0 : chA * (cty == 2 ? 1.6 : 1.0)) + uVLens * 0.55;
  if (lat > 0.0) {
    vec2 ctr = cty == 2 ? vec2(0.57, 0.45) : vec2(0.5);
    float r2 = dot((iu - ctr) * 2.0, (iu - ctr) * 2.0) * 0.5;
    vec2 off = (iu - ctr) * lat * 0.016 * r2;
    float lod = lat * r2 * 1.6;
    c.r = textureLod(uImg, srcUv(iu + off), lod).r;
    c.b = textureLod(uImg, srcUv(iu - off), lod).b;
    if (cty == 2) c.g = mix(c.g, textureLod(uImg, srcUv(iu + off * 0.3), lod).g, 0.5);
  }
  float pfr = cty == 1 ? chA : (cty == 2 ? chA * 0.5 : 0.0);
  if (pfr > 0.0) {
    float R = max((3.0 + 4.0 * pfr) * uSrcScale, 1.2), mx = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      mx = max(mx, luma(texture(uImg, su + vec2(cos(a), sin(a)) * R * uTexel).rgb));
    }
    float l0 = luma(c);
    float fe = smoothstep(0.55, 0.95, mx) * smoothstep(0.12, 0.45, mx - l0);
    c = mix(c, c * vec3(0.8, 0.5, 1.0) + vec3(0.3, 0.02, 0.45) * mx, clamp(fe * pfr * 1.1, 0.0, 1.0));
  }
  if (uSharp > 0.0) {
    float r = max(uSRad * uSrcScale, 0.5);
    float lod = max(0.0, log2(r) - 1.0);
    vec3 b = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854 + 0.39;
      b += textureLod(uImg, su + vec2(cos(a), sin(a)) * r * uTexel, lod).rgb;
    }
    b /= 8.0;
    float d = luma(texture(uImg, su).rgb) - luma(b);
    d = sign(d) * max(abs(d) - 0.004, 0.0);         // ignora ruído muito fino
    d = d / (1.0 + abs(d) * 4.0);                    // contornos fortes não ganham halo
    c = clamp(c + d * uSharp * 2.6, 0.0, 1.0);       // só luminância: sem franjas coloridas
  }
  if (uClar != 0.0) {
    // claridade = contraste local em escala média (volume), sem mexer no brilho geral nem nos contornos fortes
    float R = max(uClarR, 1.0), lod = max(0.0, log2(R) - 1.5);
    float lb = luma(textureLod(uImg, su, lod).rgb) * 0.2;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854 + 0.2, rr = (i % 2 == 0) ? R : R * 0.55;
      lb += luma(textureLod(uImg, su + vec2(cos(a), sin(a)) * rr * uTexel, lod).rgb) * 0.1;
    }
    float l = luma(c), d = l - lb;
    d *= 1.0 / (1.0 + (d / 0.14) * (d / 0.14));       // protege bordas fortes: sem halo e sem borrar contornos
    float m = 1.0 - pow(abs(l * 2.0 - 1.0), 2.0);     // atua nos meios-tons
    c = clamp(c + d * uClar * (uClar > 0.0 ? 0.85 : 1.0) * m, 0.0, 1.0);
  }
  // ---------- tom e cor
  // Exposição: luz da cena inteira, em f-stops (como abrir o diafragma). Clareando, as luzes entram num
  // "ombro" suave, como filme, em vez de cortar seco no branco.
  vec3 lin = pow(max(c, 0.0), vec3(2.2)) * exp2(uExp);
  lin *= vec3(1.0 + 0.18*uTemp + 0.06*uTint, 1.0 - 0.12*uTint, 1.0 - 0.18*uTemp + 0.06*uTint);
  if (uExp > 0.0) {
    vec3 hi = 0.7 + 0.3 * (1.0 - exp(-(lin - 0.7) / 0.3));
    lin = mix(lin, hi, step(0.7, lin));
  }
  c = pow(clamp(lin, 0.0, 1.0), vec3(1.0/2.2));
  // Brilho: só os meios-tons (curva gama). O preto e o branco ficam no lugar, nada estoura.
  if (uBright != 0.0) c = pow(c, vec3(exp2(-uBright * 0.8)));
  // brancos e pretos: mexem só nas pontas (o meio-tom quase não muda)
  c = clamp(c + uWhite * 0.12 * smoothstep(0.4, 1.0, c) + uBlack * 0.1 * (1.0 - smoothstep(0.0, 0.6, c)), 0.0, 1.0);
  {
    // luzes e sombras com faixas estreitas: cada uma mexe só na sua parte, os meios-tons quase não mudam
    float l = luma(c);
    float hw = smoothstep(0.42, 0.92, l), sw = 1.0 - smoothstep(0.08, 0.58, l);
    float dh = uHigh > 0.0 ? uHigh * 0.30 * hw * (1.0 - l) * 2.0      // clarear sem estourar o branco
                           : uHigh * 0.17 * hw * (1.0 - 0.7 * smoothstep(0.85, 1.0, l)); // recuperar detalhe nas luzes
    float ds = uShad * 0.30 * sw * min(l * 2.0, 1.0);                  // o preto puro continua preto
    float nl = clamp(l + dh + ds, 0.0, 1.0);
    c = clamp(c * (nl / max(l, 1e-4)), 0.0, 1.0);
  }
  // Contraste: afasta claros e escuros a partir do cinza médio (que fica parado).
  // Positivo = curva em S (pontas suaves, sem cortar); negativo = aproxima tudo do cinza, como cópia lavada.
  float k = uCon;
  if (k > 0.0) {
    vec3 sc = c*c*(3.0-2.0*c);
    vec3 s2 = sc*sc*(3.0-2.0*sc);
    c = mix(c, k > 0.6 ? mix(sc, s2, (k - 0.6) / 0.4 * 0.5) : sc, min(k / 0.6, 1.0));
  } else c = 0.5 + (c - 0.5) * (1.0 + k * 0.6);
  c = clamp(c, 0.0, 1.0);
  {
    float l = luma(c);
    float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = clamp(mix(vec3(l), c, 1.0 + uSat + uVib * (1.0 - s) * 1.2), 0.0, 1.0);
  }
  c = vec3(texture(uCurve, vec2(c.r * 255.0/256.0 + 0.5/256.0, 0.5)).r,
           texture(uCurve, vec2(c.g * 255.0/256.0 + 0.5/256.0, 0.5)).g,
           texture(uCurve, vec2(c.b * 255.0/256.0 + 0.5/256.0, 0.5)).b);
  // Afinar o filme. Cor: um filtro quente (+) ou frio (-) na frente da lente; a luz já chega filtrada ao filme,
  // então a cor final continua sendo a do filme. Tom: expor o negativo a mais (+) ou a menos (-).
  vec3 li = c;
  if (uFTone != 0.0 || uFCol != 0.0) {
    vec3 lin = pow(max(c, 0.0), vec3(2.2)) * exp2(uFTone * 0.6)
             * vec3(1.0 + 0.1 * uFCol, 1.0 + 0.015 * uFCol, 1.0 - 0.13 * uFCol);
    // clareando, as luzes entram num ombro (contínuo em 0.8, tende ao branco) em vez de cortar seco
    vec3 sh = mix(lin, 1.0 - 0.2 * exp(-(lin - 0.8) / 0.2), step(0.8, lin));
    lin = mix(lin, sh, clamp(uFTone * 3.0, 0.0, 1.0));
    li = clamp(pow(lin, vec3(1.0 / 2.2)), 0.0, 1.0);
  }
  vec3 g = texture(uLut, li * ((uLutN-1.0)/uLutN) + 0.5/uLutN).rgb;
  if (uFTone > 0.0) {          // negativo superexposto: cópia mais suave e pastel, sombras abertas
    float t = uFTone;
    g = mix(g, 0.5 + (g - 0.5) * 0.8 + 0.035, t * 0.6);
    g = mix(vec3(luma(g)), g, 1.0 - 0.16 * t);
  } else if (uFTone < 0.0) {   // subexposto: mais denso, sombras fechadas, cor mais cheia
    float t = -uFTone;
    g = mix(g, g * g * (3.0 - 2.0 * g), t * 0.4);
    g = mix(vec3(luma(g)), g, 1.0 + 0.1 * t);
  }
  c = mix(c, clamp(g, 0.0, 1.0), uMix);
  // cor profunda e Cor (matiz/saturação/luminância por cor) depois do filme: o ajuste aparece mesmo com filme forte
  if (uDepth > 0.0) {   // cor profunda: cores saturadas ficam mais densas (mais escuras e um pouco mais cheias), neutros quase não mudam
    float l = luma(c), s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = clamp(mix(vec3(l), c, 1.0 + uDepth * 0.2 * s), 0.0, 1.0);
    c *= 1.0 - uDepth * 0.45 * pow(s, 1.1);
  }
  {
    vec3 h = rgb2hsv(c);
    float hd = h.x * 360.0, dh = 0.0, ds = 0.0, dl = 0.0, wsum = 0.0;
    for (int i = 0; i < 8; i++) {
      float d = abs(hd - HC[i]); d = min(d, 360.0 - d);
      float w = max(0.0, 1.0 - d / 45.0); w = w*w*(3.0-2.0*w);
      dh += w * uHslH[i]; ds += w * uHslS[i]; dl += w * uHslL[i]; wsum += w;
    }
    if (wsum > 0.0) { dh /= wsum; ds /= wsum; dl /= wsum; }
    if (dh != 0.0 || ds != 0.0 || dl != 0.0) {
      h.x = fract(h.x + dh * 60.0 / 360.0);          // matiz: até 60° para cada lado
      h.y = clamp(h.y * (1.0 + ds), 0.0, 1.0);
      h.z = clamp(h.z * (1.0 + dl * 0.65 * smoothstep(0.03, 0.3, h.y)), 0.0, 1.0);   // luminância: vale também em cores pouco saturadas
      c = hsv2rgb(h);
    }
  }
  // ---------- luz: halação e difusão
  float asp = uTexel.x / uTexel.y;
  if (uHalo > 0.0) {   // halação: brilho avermelhado em volta das luzes fortes
    float hr = 0.0025 + 0.011 * uHaloR, t0 = mix(0.3, 0.92, uHaloT);
    float hl = max(0.0, uHaloLod + (uHaloR - 0.5) * 2.0);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236;
      for (int j = 1; j <= 2; j++) {
        vec2 off = vec2(cos(a), sin(a)) * hr * float(j) * vec2(asp, 1.0);
        vec3 s = textureLod(uImg, su + off, hl).rgb;
        acc += s * smoothstep(t0, min(t0 + 0.35, 1.0), luma(s));
      }
    }
    c += (acc / 24.0) * vec3(1.0, 0.33, 0.12) * uHalo * 1.6;
  }
  float bq = uBloom + uVLens * 0.4;   // brilho: positivo = luzes se espalham (difusão); negativo = sombras se espalham
  if (bq != 0.0) {
    float rad = 0.016 * (0.3 + 1.5 * uBloomR);
    float bl = max(0.0, uHaloLod + 1.5 + (uBloomR - 0.5) * 2.0);
    float t0 = mix(0.55, 0.2, uBloomR);
    vec3 acc = vec3(0.0), avg = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236 + 0.26;
      for (int j = 1; j <= 2; j++) {
        vec2 off = vec2(cos(a), sin(a)) * rad * float(j) * vec2(asp, 1.0);
        vec3 s = textureLod(uImg, su + off, bl).rgb;
        acc += s * smoothstep(t0, 1.0, luma(s)); avg += s;
      }
    }
    if (bq > 0.0) {
      vec3 gl = acc / 24.0 * bq * vec3(1.0, 0.96, 0.88);   // leve calor nas luzes, como filtro antigo
      c = 1.0 - (1.0 - c) * (1.0 - gl * 1.5);
      c = mix(c, max(c, avg / 24.0), bq * 0.3);             // filtro de difusão também baixa o contraste perto das luzes
      c = c * (1.0 - bq * 0.06) + bq * vec3(0.04, 0.035, 0.028);
    } else {
      // sombras invadem as luzes: escurece o que tem vizinhança escura, sem borrar o detalhe
      float m = -bq, dl = 1.0 - luma(avg / 24.0);
      c *= 1.0 - m * 0.9 * dl * dl * smoothstep(0.08, 0.7, luma(c));
      c = c * (1.0 - m * 0.04) + m * vec3(0.022, 0.02, 0.018);
    }
  }
  if (uLeak > 0.0) {   // light leak: luz que entrou na câmera e velou o filme (soma de luz + véu que baixa o contraste)
    float cool;
    float x = leakField(iu, cool) * uLeak * 1.15;
    vec3 lk = leakRamp(min(x, 1.25), hash(vec2(uLeakSeed, 7.0)), cool);
    c = mix(c, c * 0.88 + 0.1, clamp(x, 0.0, 1.0) * 0.25);
    c = 1.0 - (1.0 - c) * (1.0 - lk);
  }
  c = c * (1.0 - 0.22*uFade) + 0.09*uFade;
  c *= 1.0 - uVig * smoothstep(0.3, 1.0, rr0) * 0.75;
  if (uVLens > 0.0) {   // lente antiga: queda de luz nas bordas e contraste mais baixo
    c *= 1.0 - uVLens * 0.28 * smoothstep(0.35, 1.05, rr0);
    c = mix(c, vec3(luma(c)) * 0.15 + c * 0.85 + 0.03, uVLens * 0.35);
  }
  // ---------- data impressa (exposta no filme: fica sob o grão)
  if (uOverOn > 0.5) { vec4 ov = texture(uOver, uInner.xy + iu * (uInner.zw - uInner.xy)); c = 1.0 - (1.0 - c) * (1.0 - ov.rgb * ov.a); }
  // ---------- sujeira
  // esquerda (negativo) = poeira escura, cinza a preto; direita = clara, cinza a branco
  if (uDust != 0.0) {
    vec2 d = dustOf(iu * vec2(uRes.x / uRes.y, 1.0));
    if (d.x > 0.0) {
      vec3 col = uDust < 0.0 ? mix(vec3(0.015), vec3(0.34), d.y * 0.85) : mix(vec3(0.975, 0.97, 0.955), vec3(0.7), d.y * 0.85);
      c = mix(c, col, d.x * min(1.0, abs(uDust)) * 0.95);
    }
  }
  // arranhões: direita = claros (risco na base, comum no negativo escaneado); esquerda = escuros
  if (uScratch != 0.0) {
    float am = min(abs(uScratch), 1.0), colored;
    float sa = scratchOf(iu, am, colored);
    if (sa > 0.0) {
      vec3 col = uScratch > 0.0 ? vec3(0.95, 0.94, 0.92) : vec3(0.04, 0.035, 0.03);
      if (colored > 0.5) col = uScratch > 0.0 ? vec3(0.5, 0.95, 0.82) : vec3(0.42, 0.04, 0.3);
      c = mix(c, col, clamp(sa * (0.4 + 0.6 * am), 0.0, 1.0));
    }
  }
  // ---------- grão
  // O grão é calculado em pixels da foto final. Na prévia reduzida, cada pixel da tela cobre vários grãos:
  // a amplitude cai na mesma proporção que cairia ao reduzir a foto exportada, então a prévia bate com o arquivo.
  if (uGrain > 0.0) {
    // tamanho do grão relativo ao quadro: Escala vale para uma foto de 4000 px no lado maior; formatos maiores
    // (120) deixam o grão menor na foto, meio-quadro deixa maior. Na prévia reduzida, cada pixel da tela cobre
    // vários grãos: o grão é desenhado na escala do pixel e a força cai na mesma proporção da redução.
    float lg = max(uRes.x, uRes.y);
    float cellPx = uGrainSize * 1.5 * (lg / 4000.0) * uGFmt;
    float cellEff = max(cellPx, uPxScale * 1.4);
    float amp = uGrain * 0.17 * (cellPx / cellEff) * (1.0 - 0.3 * uFTone * uMix);   // subexposto = mais grão; superexposto = menos
    vec2 p = iu * uRes / cellEff;
    float aa = 0.5 * uPxScale / cellEff;
    float pe = uPrint.x * lg / cellEff;                     // cópia em papel: o grão amacia junto com a imagem
    float rough = uGRough;
    float l = luma(c);
    vec3 n;
    if (uGColor <= 0.01) {
      // prata (P&B): grãos de borda definida
      n = vec3(grainLayer(p + uSeed * 17.0, clamp(1.0 - l, 0.0, 1.0), rough, max(aa, 0.08) + pe, uSeed));
    } else {
      // negativo colorido: três camadas de nuvens de corante, macias; a camada do azul tem grão maior
      vec3 D = clamp(1.0 - c, 0.0, 1.0);
      float e = max(aa, 0.3) + pe;
      n.r = grainLayer(p + uSeed * 17.0, D.r, rough, e, uSeed + 1.0);
      n.g = grainLayer(p * 1.08 + uSeed * 23.0 + 9.1, D.g, rough, e, uSeed + 2.0);
      n.b = grainLayer(p * 0.8 + uSeed * 29.0 + 4.7, D.b, rough, e, uSeed + 3.0);
      float m = (n.r + n.g + n.b) * 0.58;                  // parte em comum (luminância)
      n = mix(vec3(m), n * 1.15, uGColor);
    }
    float w = smoothstep(0.02, 0.16, l);                    // no preto chapado o grão não aparece na cópia
    c += n * amp * w;
  }
  // ---------- gráfico: meio-tom, meio-tom em cores, duotônico, tritônico
  if (uGfx > 0.5 && uGfxAmt > 0.0) {
    int gt = int(uGfx + 0.5);
    float lg = max(uRes.x, uRes.y);
    vec2 pq = iu * uRes / lg;
    float N = mix(240.0, 36.0, uGfxSize);           // pontos no lado maior
    float w = smoothstep(2.0, 5.0, (lg / N) / uPxScale);
    float l = clamp((luma(c) - 0.5) * (1.0 + uGfxCon * 1.4) + 0.5, 0.0, 1.0);
    if (gt >= 3) l = mix(l, l * l * (3.0 - 2.0 * l), 0.4);   // tintas: um pouco mais de contraste
    vec3 r;
    if (gt == 1) {          // meio-tom: um só preto, ponto a 45°
      float d = htDot(pq * N, 0.7854, pow(1.0 - l, 1.1), w);
      r = mix(vec3(0.955, 0.95, 0.935), vec3(0.07, 0.07, 0.075), d);
    } else if (gt == 2) {   // meio-tom em cores
      vec3 x = clamp((c - 0.5) * (1.0 + uGfxCon * 1.4) + 0.5, 0.0, 1.0);
      r = cmykScreen(x, pq * N, w, 0.0, vec3(0.97, 0.965, 0.95));
    } else if (gt == 3) {   // duotônico: tinta escura -> tinta clara
      r = mix(uGfxA, uGfxB, l);
    } else {                // tritônico: sombras -> meios-tons -> luzes
      r = l < 0.5 ? mix(uGfxA, uGfxB, l * 2.0) : mix(uGfxB, uGfxC, (l - 0.5) * 2.0);
    }
    c = mix(c, r, uGfxAmt);
  }
  // ---------- papel
  if (uPaper > 0.0) {
    int pt = int(uPaperType + 0.5);
    float lg = max(uRes.x, uRes.y);
    vec2 pq = iu * uRes / lg;                         // 0..1 no lado maior: o desenho acompanha a foto, não a tela
    float sd = uPaperSeed;
    float P = uPaper;
    if (pt == 0 || pt >= 5) {
      // cópia fotográfica passada no scanner (luz plana): preto e branco do papel, ombro suave nas luzes e a
      // superfície. A maciez, a acutância e a luz espalhada já entraram na ótica (uPrint).
      // 5 brilhante liso, 0 lustre (casca de laranja), 6 fosco, 7 instantânea (inspirado na instax mini)
      float l = luma(c);
      vec3 blk = pt == 5 ? vec3(0.036, 0.034, 0.032) : pt == 0 ? vec3(0.052, 0.049, 0.045)
               : pt == 6 ? vec3(0.1, 0.096, 0.09) : vec3(0.074, 0.084, 0.092);
      vec3 wht = pt == 7 ? vec3(0.955, 0.944, 0.915) : pt == 6 ? vec3(0.94, 0.935, 0.92) : vec3(0.968, 0.962, 0.95);
      vec3 sh = c * 1.1 / (1.0 + 0.1 * c);                // luzes chegam ao branco em curva, sem cortar seco
      vec3 m = blk + (wht - blk) * clamp(sh, 0.0, 1.0);
      if (pt == 7) {                                      // química instantânea: meios um pouco frios, luzes quentes e menos cor
        m *= mix(vec3(0.985, 1.0, 1.015), vec3(1.0, 0.99, 0.97), smoothstep(0.3, 0.9, l));
        m = mix(m, vec3(luma(m)), 0.12 * smoothstep(0.55, 1.0, l));
        m *= 1.0 - 0.16 * smoothstep(0.35, 1.05, rr0);    // lente simples: cantos mais escuros
      }
      c = mix(c, m, P);
      // superfície: no scanner o relevo aparece mais nos escuros (o brilho da superfície soma onde há pouca imagem)
      float fine = min(1.0, (lg / 1400.0) / uPxScale), mid = min(1.0, (lg / 320.0) / uPxScale);
      float t;
      if (pt == 0) t = (fbm2(pq * 260.0 + sd * 3.1) - 0.5) * 0.85 * mid + (gnoise(pq * 1400.0 + sd * 7.7) - 0.5) * 0.15 * fine;
      else if (pt == 6) t = (gnoise(pq * 1400.0 + sd * 7.7) - 0.5) * 0.8 * fine + (gnoise(pq * 520.0 + sd) - 0.5) * 0.25 * mid;
      else t = (gnoise(pq * 1400.0 + sd * 7.7) - 0.5) * 0.25 * fine;
      float amp = pt == 0 ? 0.055 : pt == 6 ? 0.05 : 0.02;
      c += t * amp * P * (0.15 + 0.85 * (1.0 - luma(c)));
    } else if (pt == 1) {   // marfim: papel fosco de algodão, branco creme e preto aberto
      float t = paperTex(pq * 700.0 + sd * 11.1) * min(1.0, (lg / 700.0) / uPxScale);
      vec3 paperW = vec3(0.965, 0.935, 0.855), ink = vec3(0.11, 0.095, 0.085);
      vec3 m = mix(ink, paperW, c);
      m = mix(m, vec3(luma(m)) * vec3(1.02, 1.0, 0.95), 0.12);
      c = mix(c, m, P);
      c *= 1.0 + t * P * 0.14;
    } else if (pt == 2) {   // tela: trama de tecido em relevo, tinta que não chega ao fundo dos fios
      float N = 260.0;
      float vis = smoothstep(1.2, 3.0, (lg / N) / uPxScale);
      float h = canvasTex(pq * N + sd * 7.3);
      c = mix(c, c * 0.93 + 0.05, P * 0.6);
      c *= 1.0 + h * P * 0.3 * vis;
      c = mix(c, vec3(luma(c)), P * 0.05);
    } else if (pt == 3) {   // revista: retícula CMYK em papel couché fino
      float N = 200.0;                                 // linhas de retícula no lado maior
      float ppc = (lg / N) / uPxScale;                 // pixels de tela por ponto
      float w = smoothstep(2.0, 5.0, ppc);
      vec2 g = pq * N + vec2(0.37, 0.71) * sd;
      vec3 r = cmykScreen(c, g, w, sd * 0.013, vec3(0.955, 0.95, 0.935));
      c = mix(c, r, P);
    } else {                // fotocópia: preto e branco duro, toner granulado, faixas do cilindro
      float lum = luma(c);
      float px = max(1.0, uPxScale);
      vec2 tp = iu * uRes / px;
      float tn = (hash(floor(tp) + sd * 31.0) - 0.5) * min(1.0, 1.6 / px);   // toner: some na prévia reduzida como o grão
      float band = (vnoise(vec2(pq.x * 6.0 + sd, 2.0)) - 0.5) * 0.12 + (vnoise(vec2(pq.x * 80.0 + sd * 3.0, 5.0)) - 0.5) * 0.06;
      float edge = smoothstep(0.35, 0.75, length((iu - 0.5) * 2.0) / 1.4142) * 0.12;
      float t = smoothstep(0.28, 0.62, lum + band * 0.6 - edge + tn * 0.35);
      float spk = step(0.9975, hash(floor(pq * 1400.0) + sd * 7.0)) * min(1.0, (lg / 1400.0) / uPxScale);
      vec3 paperW = vec3(0.93, 0.93, 0.915), toner = vec3(0.085, 0.085, 0.09);
      vec3 r = mix(toner, paperW, t);
      r = mix(r, toner, spk * 0.8);
      c = mix(c, r, P);
    }
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// cópia em papel: maciez (fração do lado maior), acutância, luz espalhada no papel, maciez extra na borda
const PRINT = { 5: [0.0004, 0.4, 0.06, 0], 0: [0.0006, 0.35, 0.1, 0], 6: [0.0009, 0.3, 0.16, 0], 7: [0.0013, 0.25, 0.22, 0.0035] };
function printParams(s) {
  const p = s.paper > 0 && PRINT[s.paperType];
  return p ? p.map((v) => v * s.paper) : [0, 0, 0, 0];
}

const UNIFORMS = ['uImg', 'uCurve', 'uLut', 'uOver', 'uLutN', 'uMix', 'uExp', 'uBright', 'uCon', 'uHigh', 'uShad', 'uWhite', 'uBlack', 'uTemp', 'uTint',
  'uSat', 'uVib', 'uDepth', 'uClar', 'uSharp', 'uSRad', 'uSoft', 'uEBlur', 'uBloom', 'uBloomR', 'uChroma', 'uSrcScale', 'uTexLong',
  'uVLens', 'uHaloR', 'uHaloT', 'uClarR',
  'uFade', 'uGrain', 'uGrainSize', 'uGRough', 'uGColor', 'uPaper', 'uPaperType', 'uPrint', 'uGFmt', 'uFTone', 'uFCol', 'uPaperSeed', 'uPxScale', 'uGfx', 'uGfxAmt', 'uGfxSize', 'uGfxCon', 'uGfxA', 'uGfxB', 'uGfxC', 'uVig', 'uHalo', 'uHaloLod', 'uClarLod', 'uBypass', 'uDust', 'uDustType', 'uDustSeed',
  'uScratch', 'uLeak', 'uSeed', 'uRes', 'uTexel', 'uOut', 'uGeo', 'uPersp', 'uLens', 'uInner', 'uZoom', 'uBorder',
  'uFrameCol', 'uFrameRound', 'uFrameRough', 'uHoles', 'uOverOn', 'uHslH', 'uHslS', 'uHslL',
  'uLeakP', 'uLeakType', 'uLeakSeed', 'uScrType', 'uScrSeed', 'uChromaType'];

const I3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
export const IDENT_VIEW = {
  geo: I3, persp: I3, lens: 0, inner: [0, 0, 1, 1], frameCol: [0, 0, 0], round: 0, rough: 0, holes: 0,
  border: [0, 0, 0, 0], zoom: [0, 0, 1, 1], overlay: null,
};

export class Renderer {
  // safe: modo seguro para placas de vídeo que falham no caminho normal (envio de pixels cru, LUT 8 bits, sem mipmap)
  constructor(canvas, safe = false) {
    this.canvas = canvas; this.safe = safe; this.lost = false; this.onRestore = null; this.log = [];
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error('Este navegador não suporta WebGL2.');
    this.gl = gl;
    // a placa de vídeo pode derrubar o contexto (memória, tempo de desenho); recupera sozinho quando ele volta
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.log.push('contexto perdido'); });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false; this.log.push('contexto recuperado');
      try { this._init(); this.onRestore?.(); } catch (err) { this.log.push('recuperar: ' + err.message); }
    });
    this._init();
  }
  _init() {
    const gl = this.gl, t0 = performance.now();
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.p = p; gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of UNIFORMS) this.u[n] = gl.getUniformLocation(p, n);
    gl.uniform1i(this.u.uImg, 0); gl.uniform1i(this.u.uLut, 1); gl.uniform1i(this.u.uCurve, 2); gl.uniform1i(this.u.uOver, 3);
    this.imgTex = gl.createTexture();
    this.lutTex = gl.createTexture();
    this.curveTex = gl.createTexture();
    this.overTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.overTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    this.overKey = null;
    this.maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    this.setLut(identityLut(2), 2);
    this.setCurve(null);
    this.imgKey = null;
    this.initMs = Math.round(performance.now() - t0);
  }
  // pixels crus da fonte (canvas, ImageBitmap ou imagem), para o modo seguro
  static pixels(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0);
    return x.getImageData(0, 0, c.width, c.height).data;
  }
  glErr(where) {
    const e = this.gl.getError();
    if (e) this.log.push(`${where}: erro GL ${e}`);
    return e;
  }
  setImage(src, key) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (this.safe) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, src.width, src.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, Renderer.pixels(src));
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.glErr('foto');
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texW = src.width; this.texH = src.height; this.imgKey = key;
  }
  setLut(data, n) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    if (this.safe) {
      const b = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(data[i] * 255)));
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, n, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, b);
    } else gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, n, n, n, 0, gl.RGBA, gl.FLOAT, data);
    this.glErr('LUT');
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]])
      gl.texParameteri(gl.TEXTURE_3D, k, v);
    this.lutN = n;
  }
  // data: Uint8Array 256*4 (R, G, B, -) ou null para identidade
  setCurve(data) {
    const gl = this.gl;
    if (!data) { data = new Uint8Array(1024); for (let i = 0; i < 256; i++) data.fill(i, i * 4, i * 4 + 4); }
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  setOverlay(canvas, key) {
    if (!canvas || key === this.overKey) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.overTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.overKey = key;
  }
  // w,h: tamanho do canvas. st: parâmetros.
  // full: {w,h} da área da foto em pixels da foto final; src: lado maior da foto final (para converter raios).
  // view: geometria e moldura (computeView).
  render(w, h, st, full, bypass = false, view = IDENT_VIEW) {
    if (this.lost) return;
    const gl = this.gl, u = this.u, s = { ...RDEF, ...st }, v = { ...IDENT_VIEW, ...view };
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    if (v.overlay) this.setOverlay(v.overlay, v.overlayKey);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.overTex);
    gl.uniform1f(u.uLutN, this.lutN);
    const f = (n, x) => gl.uniform1f(u[n], x);
    f('uMix', s.mix); f('uFTone', s.ftone || 0); f('uFCol', s.fcol || 0); f('uExp', s.exp); f('uBright', s.bright || 0); f('uCon', s.con); f('uHigh', s.high); f('uShad', s.shad); f('uWhite', s.white);
    f('uBlack', s.black); f('uTemp', s.temp); f('uTint', s.tint); f('uSat', s.sat); f('uVib', s.vib); f('uDepth', s.depth);
    f('uClar', s.clar); f('uSharp', s.sharp); f('uSRad', s.srad); f('uSoft', s.soft); f('uEBlur', s.eblur); f('uBloom', s.bloom);
    f('uChroma', s.chroma); f('uFade', s.fade); f('uGrain', s.grain); f('uGrainSize', s.gsize); f('uGRough', s.grough);
    f('uGColor', s.gcolor); f('uPaper', s.paper); gl.uniform4fv(u.uPrint, printParams(s)); f('uGFmt', [1, 0.45, 1.4][s.gfmt | 0] || 1); f('uPaperType', s.paperType); f('uPaperSeed', s.paperSeed);
    f('uGfx', s.gfx); f('uGfxAmt', s.gfxAmt); f('uGfxSize', s.gfxSize); f('uGfxCon', s.gfxCon);
    const gc = s.gfxCols || [[0, 0, 0], [1, 1, 1], [1, 1, 1]];
    gl.uniform3fv(u.uGfxA, gc[0]); gl.uniform3fv(u.uGfxB, gc[1]); gl.uniform3fv(u.uGfxC, gc[2] || gc[1]); f('uVig', s.vig); f('uHalo', s.halo);
    f('uBloomR', s.bloomR); f('uHaloR', s.haloR); f('uHaloT', s.haloT); f('uVLens', s.vlens);
    f('uDust', s.dust); f('uDustType', s.dustType ?? 1); f('uDustSeed', s.dustSeed ?? 0); f('uScratch', s.scratch); f('uLeak', s.leak); f('uSeed', s.seed ?? 0); f('uBypass', bypass ? 1 : 0);
    const tl = Math.max(this.texW, this.texH);
    f('uTexLong', tl);
    f('uSrcScale', full.src ? Math.min(1, tl / full.src) : 1);
    f('uHaloLod', Math.max(0, Math.log2(tl * 0.005)));
    f('uClarLod', Math.max(0, Math.log2(tl * 0.012)));
    f('uClarR', tl * 0.022);
    const iw = (v.inner[2] - v.inner[0]) * w;
    f('uPxScale', Math.max(1e-3, (full.w * v.zoom[2]) / Math.max(iw, 1)));
    gl.uniform2f(u.uRes, full.w, full.h);
    gl.uniform2f(u.uTexel, 1 / this.texW, 1 / this.texH);
    // tamanho total da saída em pixels finais (para moldura e furos)
    const ow = full.w / Math.max(v.inner[2] - v.inner[0], 1e-6), oh = full.h / Math.max(v.inner[3] - v.inner[1], 1e-6);
    gl.uniform2f(u.uOut, ow, oh);
    gl.uniform4f(u.uBorder, v.inner[1] * oh, (1 - v.inner[2]) * ow, (1 - v.inner[3]) * oh, v.inner[0] * ow);
    gl.uniformMatrix3fv(u.uGeo, false, v.geo);
    gl.uniformMatrix3fv(u.uPersp, false, v.persp);
    f('uLens', v.lens);
    gl.uniform4fv(u.uInner, v.inner);
    gl.uniform4fv(u.uZoom, v.zoom);
    gl.uniform3fv(u.uFrameCol, v.frameCol);
    f('uFrameRound', v.round); f('uFrameRough', v.rough); f('uHoles', v.holes ? full.w : 0);
    f('uOverOn', v.overlay ? 1 : 0);
    gl.uniform1fv(u.uHslH, s.hslH || HSL_ZERO); gl.uniform1fv(u.uHslS, s.hslS || HSL_ZERO); gl.uniform1fv(u.uHslL, s.hslL || HSL_ZERO);
    gl.uniform4fv(u.uLeakP, s.leakP || [0, 0.5, 0.5, 0.5]);
    f('uLeakType', s.leakType || 0); f('uLeakSeed', (s.leakSeed || 0) % 997);
    f('uScrType', s.scrType || 0); f('uScrSeed', (s.scrSeed || 0) % 997); f('uChromaType', s.chromaType || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
