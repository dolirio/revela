// Renderizador do Revela novo (WebGL2). A foto atravessa o filme como luz:
//   foto (sRGB) -> luz linear -> nitidez do filme por camada -> halação (luz que volta pela base)
//   -> equilíbrio da luz da cena (ANTES do filme) -> exposição do negativo
//   -> tabela do filme (negativo + scanner + laboratório, gerada pelo motor espectral)
//   -> equilíbrio do laboratório (DEPOIS do filme) -> grão -> tela
// A tabela do filme recebe luz da cena em paradas (log2), por isso a exposição empurra a foto pela curva real do filme.

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 vUv; out vec4 o;
uniform sampler2D uImg; uniform sampler3D uLut;
uniform float uLutN, uLutMin, uLutMax, uMix, uExp, uHalo, uGrain, uGrainSize, uSoft, uSeed, uLong, uHasFilm, uBypass;
uniform vec3 uPre, uPost, uSoftCh;
uniform vec2 uRes;

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

void main(){
  vec3 c = texture(uImg, vUv).rgb;
  if (uBypass > 0.5) { o = vec4(c, 1.0); return; }
  vec3 lin = dec(c);
  // nitidez do filme: cada camada perde detalhe fino de um jeito (o vermelho, mais funda, é a mais macia)
  if (uSoft > 0.0) {
    float lod = clamp(log2(uLong / 1500.0) + 0.6, 0.0, 4.0);
    vec3 b = dec(textureLod(uImg, vUv, lod).rgb);
    lin = mix(lin, b, clamp(uSoft * uSoftCh, 0.0, 1.0));
  }
  // halação: a luz forte atravessa o filme, reflete na base e volta expondo de novo a camada vermelha
  if (uHalo > 0.0) {
    float lod = clamp(log2(uLong / 1500.0) + 4.0, 0.0, 9.0);
    vec3 h = dec(textureLod(uImg, vUv, lod).rgb) * 0.5 + dec(textureLod(uImg, vUv, lod + 1.5).rgb) * 0.5;
    float hi = max(luma(h) - 0.55, 0.0) * 2.2;
    lin += uHalo * hi * vec3(1.0, 0.22, 0.04);
  }
  vec3 x = lin * uPre * exp2(uExp);                 // luz que chega ao filme
  vec3 dig = enc(clamp(x * uPost, 0.0, 1.0));       // a mesma foto sem filme (intensidade 0)
  vec3 f = uHasFilm > 0.5 ? enc(dec(filme(x)) * uPost) : dig;
  vec3 col = mix(dig, f, uMix);
  // grão: o tamanho segue a foto inteira (igual na prévia e na exportação)
  if (uGrain > 0.0) {
    float cellPx = uGrainSize * 1.6 * (uLong / 4000.0);
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
    for (const n of ['uImg', 'uLut', 'uLutN', 'uLutMin', 'uLutMax', 'uMix', 'uExp', 'uHalo', 'uGrain', 'uGrainSize', 'uSoft', 'uSeed', 'uLong', 'uHasFilm', 'uBypass', 'uPre', 'uPost', 'uSoftCh', 'uRes'])
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
  draw(s, outW, outH, longSide, bypass = false) {
    const gl = this.gl, u = this.u;
    if (this.canvas.width !== outW || this.canvas.height !== outH) { this.canvas.width = outW; this.canvas.height = outH; }
    gl.viewport(0, 0, outW, outH); gl.useProgram(this.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.img);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.lut);
    const m = this.film?.meta, a = m?.analogico || {};
    gl.uniform1f(u.uLutN, m ? m.tabela.n : 2); gl.uniform1f(u.uLutMin, m ? m.tabela.min : -9); gl.uniform1f(u.uLutMax, m ? m.tabela.max : 7);
    gl.uniform1f(u.uHasFilm, m ? 1 : 0); gl.uniform1f(u.uBypass, bypass ? 1 : 0);
    gl.uniform1f(u.uMix, s.intensidade); gl.uniform1f(u.uExp, s.exposicao);
    gl.uniform3fv(u.uPre, wb(s.cenaTemp, s.cenaMatiz)); gl.uniform3fv(u.uPost, wb(s.labTemp, s.labMatiz));
    gl.uniform1f(u.uHalo, s.halacao); gl.uniform1f(u.uGrain, s.grao); gl.uniform1f(u.uGrainSize, s.graoTamanho);
    gl.uniform1f(u.uSoft, m ? s.caraterFilme : 0); gl.uniform3fv(u.uSoftCh, a.nitidez_canal ? a.nitidez_canal.map((v) => 1 - v) : [0, 0, 0]);
    gl.uniform1f(u.uSeed, s.semente); gl.uniform1f(u.uLong, longSide); gl.uniform2f(u.uRes, outW, outH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// temperatura (−1 frio .. +1 quente) e matiz (−1 verde .. +1 magenta) -> multiplicadores RGB em luz linear
export function wb(temp, matiz) {
  const t = temp * 0.35, m = matiz * 0.25;
  const r = Math.exp(t + m * 0.5), g = Math.exp(-m), b = Math.exp(-t + m * 0.5);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;   // mantém o brilho
  return [r / y, g / y, b / y];
}
