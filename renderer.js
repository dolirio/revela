import { identityLut } from './looks.js';

// Valores padrão de todos os parâmetros que o shader entende.
export const RDEF = {
  mix: 1, exp: 0, con: 0, high: 0, shad: 0, white: 0, black: 0, temp: 0, tint: 0, sat: 0, vib: 0, depth: 0,
  clar: 0, sharp: 0, srad: 1, soft: 0, eblur: 0, bloom: 0, chroma: 0,
  grain: 0, gsize: 1.6, grough: 0.4, gcolor: 0, paper: 0,
  fade: 0, halo: 0, vig: 0, leak: 0, dust: 0, scratch: 0,
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
uniform float uLutN, uMix, uExp, uCon, uHigh, uShad, uWhite, uBlack, uTemp, uTint, uSat, uVib, uDepth, uClar;
uniform float uSharp, uSRad, uSoft, uEBlur, uBloom, uChroma, uSrcScale, uTexLong;
uniform float uFade, uGrain, uGrainSize, uGRough, uGColor, uPaper, uPxScale;
uniform float uVig, uHalo, uHaloLod, uClarLod, uBypass, uDust, uDustType, uDustSeed, uScratch, uLeak, uSeed;
uniform vec2 uRes, uTexel, uOut;
uniform mat3 uGeo, uPersp; uniform float uLens;
uniform vec4 uInner, uZoom, uBorder;
uniform vec3 uFrameCol; uniform float uFrameRound, uFrameRough, uHoles, uOverOn;
uniform float uHslH[8]; uniform float uHslS[8]; uniform float uHslL[8];
uniform vec4 uLeakA, uLeakB; uniform vec3 uLeakCA, uLeakCB;

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
    if (uPaper > 0.0) c *= 1.0 + paperTex(op / max(uOut.x, uOut.y) * 900.0) * uPaper * 0.12;
    o = vec4(clamp(c, 0.0, 1.0), 1.0); return;
  }
  iu = uZoom.xy + iu * uZoom.zw;
  vec2 su = srcUv(iu);
  if (su.x < -0.002 || su.y < -0.002 || su.x > 1.002 || su.y > 1.002) { o = vec4(0.08, 0.075, 0.07, 1.0); return; }
  vec3 c = texture(uImg, su).rgb;
  if (uBypass > 0.5) { o = vec4(c, 1.0); return; }

  float rr0 = length((iu - 0.5) * 2.0) / 1.4142;   // 0 no centro, 1 no canto
  // ---------- ótica: suavidade, desfoque de borda, aberração, nitidez
  float bs = max(uSoft, -uSharp);   // controle de nitidez à esquerda do zero = desfoque
  float br = ((bs * 0.0012 + bs * bs * 0.004) + uEBlur * 0.007 * smoothstep(0.25, 1.0, rr0) * smoothstep(0.25, 1.0, rr0)) * uTexLong;
  if (br > 0.35) c = blurAt(su, br);
  if (uChroma > 0.0) {
    vec2 off = (iu - 0.5) * uChroma * 0.006;
    c.r = texture(uImg, srcUv(iu + off)).r;
    c.b = texture(uImg, srcUv(iu - off)).b;
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
    c = clamp(c + d * uSharp * 2.2, 0.0, 1.0);   // só luminância: sem franjas coloridas
  }
  if (uClar != 0.0) {
    float lb = luma(textureLod(uImg, su, uClarLod).rgb), l = luma(c);
    float m = 1.0 - pow(abs(l*2.0 - 1.0), 2.0);
    c = clamp(c + (l - lb) * uClar * 0.9 * m, 0.0, 1.0);
  }
  // ---------- tom e cor
  vec3 lin = pow(max(c, 0.0), vec3(2.2)) * exp2(uExp);
  lin *= vec3(1.0 + 0.18*uTemp + 0.06*uTint, 1.0 - 0.12*uTint, 1.0 - 0.18*uTemp + 0.06*uTint);
  c = pow(clamp(lin, 0.0, 1.0), vec3(1.0/2.2));
  float lo = -uBlack * 0.1, hi = 1.0 - uWhite * 0.1;
  c = clamp((c - lo) / (hi - lo), 0.0, 1.0);
  {
    float l = luma(c);
    float nl = l + uShad * 1.2 * l * (1.0-l) * (1.0-l) + uHigh * 1.2 * l * l * (1.0-l);
    c = clamp(c * (nl / max(l, 1e-4)), 0.0, 1.0);
  }
  float k = uCon;
  c = clamp(mix(c, c*c*(3.0-2.0*c), max(k,0.0)) + min(k,0.0)*(c-0.5)*0.6, 0.0, 1.0);
  {
    float l = luma(c);
    float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = clamp(mix(vec3(l), c, 1.0 + uSat + uVib * (1.0 - s) * 1.2), 0.0, 1.0);
  }
  if (uDepth > 0.0) {   // cor profunda: cores saturadas ficam mais densas
    float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c *= 1.0 - uDepth * 0.3 * pow(s, 1.4);
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
      h.x = fract(h.x + dh * 30.0 / 360.0);
      h.y = clamp(h.y * (1.0 + ds), 0.0, 1.0);
      h.z = clamp(h.z * (1.0 + dl * 0.5 * h.y), 0.0, 1.0);
      c = hsv2rgb(h);
    }
  }
  c = vec3(texture(uCurve, vec2(c.r * 255.0/256.0 + 0.5/256.0, 0.5)).r,
           texture(uCurve, vec2(c.g * 255.0/256.0 + 0.5/256.0, 0.5)).g,
           texture(uCurve, vec2(c.b * 255.0/256.0 + 0.5/256.0, 0.5)).b);
  vec3 g = texture(uLut, c * ((uLutN-1.0)/uLutN) + 0.5/uLutN).rgb;
  c = mix(c, g, uMix);
  // ---------- luz: halação e difusão
  float asp = uTexel.x / uTexel.y;
  if (uHalo > 0.0) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236;
      for (int j = 1; j <= 2; j++) {
        vec2 off = vec2(cos(a), sin(a)) * 0.007 * float(j) * vec2(asp, 1.0);
        vec3 s = textureLod(uImg, su + off, uHaloLod).rgb;
        acc += s * smoothstep(0.62, 1.0, luma(s));
      }
    }
    c += (acc / 24.0) * vec3(1.0, 0.33, 0.12) * uHalo * 1.6;
  }
  if (uBloom > 0.0) {   // difusão: brilho largo e suave nas luzes, como um filtro de névoa
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236 + 0.26;
      for (int j = 1; j <= 2; j++) {
        vec2 off = vec2(cos(a), sin(a)) * 0.016 * float(j) * vec2(asp, 1.0);
        vec3 s = textureLod(uImg, su + off, uHaloLod + 1.5).rgb;
        acc += s * smoothstep(0.35, 1.0, luma(s));
      }
    }
    vec3 gl = acc / 24.0 * uBloom;
    c = 1.0 - (1.0 - c) * (1.0 - gl * 0.85);
    c = c * (1.0 - uBloom * 0.06) + uBloom * 0.035;
  }
  if (uLeak > 0.0) {
    vec2 a = vec2(uRes.x / uRes.y, 1.0);
    float wa = exp(-pow(length((iu - uLeakA.xy) * a) / uLeakA.z, 2.0));
    float wb = exp(-pow(length((iu - uLeakB.xy) * a) / uLeakB.z, 2.0));
    vec3 lk = clamp(uLeakCA * wa * uLeakA.w + uLeakCB * wb * uLeakB.w, 0.0, 1.0) * uLeak;
    c = 1.0 - (1.0 - c) * (1.0 - lk);
  }
  c = c * (1.0 - 0.22*uFade) + 0.09*uFade;
  c *= 1.0 - uVig * smoothstep(0.3, 1.0, rr0) * 0.75;
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
  if (uScratch > 0.0) {
    float x = iu.x * 120.0, col = floor(x);
    if (hash(vec2(col, 7.0) + uSeed) < uScratch * 0.12) {
      float cx = col + 0.2 + 0.6 * hash(vec2(col, 11.0)) + (vnoise(vec2(iu.y * 3.0, col)) - 0.5) * 0.5;
      float d = abs(x - cx), px = fwidth(x);
      float aa = 1.0 - smoothstep(0.03, 0.03 + px * 1.5, d);
      float seg = smoothstep(0.35, 0.6, vnoise(vec2(col * 3.1, iu.y * 5.0) + uSeed));
      c = mix(c, vec3(0.93), aa * seg * 0.75);
    }
  }
  // ---------- grão
  // O grão é calculado em pixels da foto final. Na prévia reduzida, cada pixel da tela cobre vários grãos:
  // a amplitude cai na mesma proporção que cairia ao reduzir a foto exportada, então a prévia bate com o arquivo.
  if (uGrain > 0.0) {
    float cell = max(uGrainSize, uPxScale);
    float amp = uGrain * 0.1 * min(1.0, uGrainSize / uPxScale);
    vec2 p = iu * uRes / cell + uSeed * 17.0;
    float rough = uGRough;
    // fino = uma escala, redondo; áspero = aglomerados maiores e grão mais duro
    vec3 n;
    for (int ch = 0; ch < 3; ch++) {
      vec2 q = p + float(ch) * vec2(31.7, 47.3);
      float v = (vnoise(q) - 0.5) + (vnoise(q * 1.97 + 11.3) - 0.5) * 0.55 + (vnoise(q * 0.43 + 5.7) - 0.5) * rough * 1.3;
      v /= 0.3 + rough * 0.18;
      v = sign(v) * pow(abs(v), 1.0 - rough * 0.3);
      n[ch] = v;
      if (uGColor <= 0.0) { n = vec3(v); break; }
    }
    n = mix(vec3(n.r), n, uGColor);
    float l = luma(c);
    float w = 0.2 + 0.8 * exp(-pow((l - 0.42) / 0.34, 2.0));   // mais visível nos meios-tons e sombras
    c += n * amp * w;
  }
  // ---------- papel de cópia
  if (uPaper > 0.0) {
    float lg = max(uRes.x, uRes.y);
    float t = paperTex(iu * uRes / lg * 900.0) * min(1.0, (lg / 900.0) / uPxScale);
    c = c * (1.0 - uPaper * 0.07) + uPaper * vec3(0.045, 0.04, 0.035);   // preto de papel não é preto puro
    c *= 1.0 + t * uPaper * 0.1;
    c = mix(c, vec3(luma(c)), uPaper * 0.06);
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const UNIFORMS = ['uImg', 'uCurve', 'uLut', 'uOver', 'uLutN', 'uMix', 'uExp', 'uCon', 'uHigh', 'uShad', 'uWhite', 'uBlack', 'uTemp', 'uTint',
  'uSat', 'uVib', 'uDepth', 'uClar', 'uSharp', 'uSRad', 'uSoft', 'uEBlur', 'uBloom', 'uChroma', 'uSrcScale', 'uTexLong',
  'uFade', 'uGrain', 'uGrainSize', 'uGRough', 'uGColor', 'uPaper', 'uPxScale', 'uVig', 'uHalo', 'uHaloLod', 'uClarLod', 'uBypass', 'uDust', 'uDustType', 'uDustSeed',
  'uScratch', 'uLeak', 'uSeed', 'uRes', 'uTexel', 'uOut', 'uGeo', 'uPersp', 'uLens', 'uInner', 'uZoom', 'uBorder',
  'uFrameCol', 'uFrameRound', 'uFrameRough', 'uHoles', 'uOverOn', 'uHslH', 'uHslS', 'uHslL',
  'uLeakA', 'uLeakB', 'uLeakCA', 'uLeakCB'];

const I3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
export const IDENT_VIEW = {
  geo: I3, persp: I3, lens: 0, inner: [0, 0, 1, 1], frameCol: [0, 0, 0], round: 0, rough: 0, holes: 0,
  border: [0, 0, 0, 0], zoom: [0, 0, 1, 1], overlay: null,
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error('Este navegador não suporta WebGL2.');
    this.gl = gl;
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
  }
  setImage(src, key) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texW = src.width; this.texH = src.height; this.imgKey = key;
  }
  setLut(data, n) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, n, n, n, 0, gl.RGBA, gl.FLOAT, data);
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
    f('uMix', s.mix); f('uExp', s.exp); f('uCon', s.con); f('uHigh', s.high); f('uShad', s.shad); f('uWhite', s.white);
    f('uBlack', s.black); f('uTemp', s.temp); f('uTint', s.tint); f('uSat', s.sat); f('uVib', s.vib); f('uDepth', s.depth);
    f('uClar', s.clar); f('uSharp', s.sharp); f('uSRad', s.srad); f('uSoft', s.soft); f('uEBlur', s.eblur); f('uBloom', s.bloom);
    f('uChroma', s.chroma); f('uFade', s.fade); f('uGrain', s.grain); f('uGrainSize', s.gsize); f('uGRough', s.grough);
    f('uGColor', s.gcolor); f('uPaper', s.paper); f('uVig', s.vig); f('uHalo', s.halo);
    f('uDust', s.dust); f('uDustType', s.dustType ?? 1); f('uDustSeed', s.dustSeed ?? 0); f('uScratch', s.scratch); f('uLeak', s.leak); f('uSeed', s.seed ?? 0); f('uBypass', bypass ? 1 : 0);
    const tl = Math.max(this.texW, this.texH);
    f('uTexLong', tl);
    f('uSrcScale', full.src ? Math.min(1, tl / full.src) : 1);
    f('uHaloLod', Math.max(0, Math.log2(tl * 0.005)));
    f('uClarLod', Math.max(0, Math.log2(tl * 0.012)));
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
    const lk = s.leakData || { a: [0, 0, 1, 0], b: [0, 0, 1, 0], ca: [0, 0, 0], cb: [0, 0, 0] };
    gl.uniform4fv(u.uLeakA, lk.a); gl.uniform4fv(u.uLeakB, lk.b); gl.uniform3fv(u.uLeakCA, lk.ca); gl.uniform3fv(u.uLeakCB, lk.cb);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
