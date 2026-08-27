// 캔버스에 구운 DOM 텍스처를 휘어서 그리고, 화면 좌표를 다시 DOM 좌표로 되짚는 엔진.
// 되짚기는 같은 셰이더를 한 번 더 태워서 UV 를 색으로 뽑아 읽는 방식이다.

export const MODES = ['ripple', 'glass', 'wave', 'fold', 'shatter', 'crt'];
const MODE_INDEX = { ripple: 0, glass: 1, wave: 2, fold: 3, shatter: 4, crt: 5 };

const VERT = `
precision highp float;
precision mediump int;

attribute vec2 aPos;   // 격자 위치 0..1
attribute vec2 aCell;  // 조각 중심 0..1
attribute vec2 aSeed;  // 조각마다 다른 난수

uniform float uTime;
uniform float uAmp;
uniform float uAspect;
uniform float uScale;
uniform int   uMode;
uniform vec2  uPointer;
uniform vec2  uOrbit;
uniform vec3  uBurst;   // xy 터진 자리, z 진행도 0..1 (그 밖이면 쉬는 중)

varying vec2  vUv;
varying float vShade;

vec2 rot2(vec2 p, float a){
  float s = sin(a), c = cos(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

vec3 toWorld(vec2 p){
  return vec3((p.x - 0.5) * 2.0 * uAspect, (0.5 - p.y) * 2.0, 0.0);
}

float hash21(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 deform(vec2 p, vec2 cell, vec2 seed, out float shade){
  vec3 w = toWorld(p);
  shade = 1.0;

  if (uMode == 2) {                       // 파도
    float t = uTime;
    float h = sin(w.x * 2.2 + t * 1.30) * 0.170
            + sin(w.y * 2.6 - t * 1.00) * 0.125
            + sin((w.x + w.y) * 3.6 + t * 1.9) * 0.060;
    w.z = h * uAmp;
    float dx = (cos(w.x * 2.2 + t * 1.30) * 2.2 * 0.170
             +  cos((w.x + w.y) * 3.6 + t * 1.9) * 3.6 * 0.060) * uAmp;
    float dy = (cos(w.y * 2.6 - t * 1.00) * -2.6 * 0.125
             +  cos((w.x + w.y) * 3.6 + t * 1.9) * 3.6 * 0.060) * uAmp;
    vec3 n = normalize(vec3(-dx, -dy, 1.0));
    shade = 0.66 + 0.60 * dot(n, normalize(vec3(-0.30, 0.50, 0.81)));

  } else if (uMode == 3) {                // 접기
    float curl = clamp(uPointer.x, 0.0, 1.0);
    float cx = mix(uAspect * 1.04, -uAspect * 1.04, curl);
    float R = 0.21 + 0.04 * sin(uTime * 0.7);
    float s = w.x - cx;
    if (s > 0.0) {
      float ang = min(s / R, 3.14159 * 1.15);
      float ca = cos(ang);
      w.x = cx + sin(ang) * R;
      w.z = (1.0 - ca) * R;
      // 실루엣에서만 어둡고, 뒤로 넘어간 면도 다시 밝아진다
      shade = (0.34 + 0.98 * abs(ca)) * (ca < 0.0 ? 0.72 : 1.0)
            + 0.40 * pow(max(0.0, ca), 5.0);
    }

  } else if (uMode == 4) {                // 조각
    float g = uBurst.z;
    if (g >= 0.0 && g <= 1.0) {
      vec2 grid = vec2(16.0, 10.0);
      vec2 sid = floor(cell * grid);   // 조각 번호는 잘게 나눈 칸 기준이어야 사각형이 안 찢어진다
      vec2 sc = (sid + 0.5) / grid;
      vec2 rnd = vec2(hash21(sid), hash21(sid + 17.3));
      float dly = clamp(length(sc - uBurst.xy) * 0.45, 0.0, 0.5);
      float t = clamp((g - dly) / max(0.0001, 1.0 - dly), 0.0, 1.0);
      float e = sin(t * 3.14159);
      vec3 cw = toWorld(sc);
      vec2 dir = normalize(sc - uBurst.xy + (rnd - 0.5) * 0.45 + vec2(0.0001, 0.0001));
      dir.y = -dir.y;
      vec2 rel = w.xy - cw.xy;
      rel = rot2(rel, (rnd.y - 0.5) * 1.3 * e);
      rel *= (1.0 - 0.10 * e);
      w.xy = cw.xy + rel + dir * e * 0.20 * uAmp;
      w.z  = (rnd.x - 0.35) * e * 0.45 * uAmp;
      shade = 1.0 - 0.40 * e * (1.0 - rnd.x);
    }
  }
  return w;
}

void main(){
  float shade;
  vec3 w = deform(aPos, aCell, aSeed, shade);

  float cy = cos(uOrbit.x), sy = sin(uOrbit.x);
  w = vec3(w.x * cy + w.z * sy, w.y, -w.x * sy + w.z * cy);
  float cp = cos(uOrbit.y), sp = sin(uOrbit.y);
  w = vec3(w.x, w.y * cp - w.z * sp, w.y * sp + w.z * cp);

  float pw = 1.0 - w.z * 0.30;
  gl_Position = vec4((w.x / uAspect) * uScale, w.y * uScale, -w.z * 0.22, pw);

  vUv = aPos;
  vShade = shade;
}
`;

const FRAG = `
precision highp float;
precision mediump int;

uniform sampler2D uTex;
uniform float uTime;
uniform float uAmp;
uniform float uAspect;
uniform float uPress;
uniform int   uMode;
uniform bool  uUvPass;
uniform vec2  uPointer;
uniform vec4  uRip[8];   // xy 자리, z 시작 시각, w 세기

varying vec2  vUv;
varying float vShade;

vec2 pack16(float v){
  float x = clamp(v, 0.0, 1.0) * 65535.0;
  float hi = floor(x / 256.0);
  float lo = floor(x - hi * 256.0);
  return vec2(hi, lo) / 255.0;
}

vec2 warp(vec2 uv){
  vec2 off = vec2(0.0);

  if (uMode == 0) {                        // 물결
    for (int i = 0; i < 8; i++) {
      vec4 r = uRip[i];
      if (r.w <= 0.001) continue;
      float age = uTime - r.z;
      if (age < 0.0 || age > 2.8) continue;
      vec2 d = (uv - r.xy) * vec2(uAspect, 1.0);
      float dist = length(d) + 1e-5;
      float wv = sin(dist * 30.0 - age * 10.0);
      float env = exp(-dist * 2.4) * exp(-age * 1.6) * smoothstep(0.0, 0.05, age);
      off += (d / dist) * wv * env * r.w * 0.032 * uAmp;
    }

  } else if (uMode == 1) {                 // 렌즈
    vec2 duv = uv - uPointer;
    vec2 d = duv * vec2(uAspect, 1.0);
    float r = length(d);
    float R = 0.24 + uPress * 0.05;
    if (r < R) {
      float k = 1.0 - (r / R) * (r / R);
      off -= duv * pow(k, 0.65) * 0.40 * uAmp;
    }

  } else if (uMode == 5) {                 // 브라운관
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    off += c * r2 * 0.34 * uAmp;
    off.x += sin(uv.y * 190.0 + uTime * 5.0) * 0.0011 * uAmp;
    float band = step(0.985, fract(uTime * 0.23));
    off.x += band * sin(uv.y * 24.0 + uTime * 40.0) * 0.010 * uAmp;
  }

  return uv + off;
}

void main(){
  vec2 uv = warp(vUv);

  if (uUvPass) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
    vec2 e = 0.002 + uv * 0.996;
    gl_FragColor = vec4(pack16(e.x), pack16(e.y));
    return;
  }

  if (uv.x < -0.003 || uv.x > 1.003 || uv.y < -0.003 || uv.y > 1.003) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec4 col;
  if (uMode == 1) {
    vec2 d = uv - vUv;
    float a = texture2D(uTex, uv).a;
    col = vec4(
      texture2D(uTex, uv + d * 0.075).r,
      texture2D(uTex, uv).g,
      texture2D(uTex, uv - d * 0.075).b,
      a
    );
    vec2 pd = (uv - uPointer) * vec2(uAspect, 1.0);
    float r = length(pd);
    float R = 0.24 + uPress * 0.05;
    float rim = smoothstep(R, R * 0.86, r) * smoothstep(R * 0.68, R * 0.94, r);
    col.rgb += rim * 0.26;
    float spec = smoothstep(0.17, 0.0, length(pd - vec2(-0.09, 0.09))) * 0.10;
    col.rgb += spec;

  } else if (uMode == 5) {
    float sp = 0.0022 * uAmp;
    float a = texture2D(uTex, uv).a;
    col = vec4(
      texture2D(uTex, uv + vec2(sp, 0.0)).r,
      texture2D(uTex, uv).g,
      texture2D(uTex, uv - vec2(sp, 0.0)).b,
      a
    );
    col.rgb *= 0.86 + 0.14 * sin(uv.y * 860.0);
    col.rgb *= 0.97 + 0.03 * sin(uTime * 31.0);
    vec2 c = uv - 0.5;
    col.rgb *= 1.0 - dot(c, c) * 0.55;
    col.rgb += vec3(0.02, 0.05, 0.03);

  } else {
    col = texture2D(uTex, uv);
  }

  col.rgb *= vShade;
  gl_FragColor = col;
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed');
  }
  return sh;
}

export class Warp {
  constructor(canvas, opts = {}) {
    const attrs = { alpha: true, antialias: true, premultipliedAlpha: false, depth: true };
    const gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) throw new Error('webgl unavailable');

    this.canvas = canvas;
    this.gl = gl;
    this.grid = opts.grid || 120;
    this.pickScale = 0.5;
    this.ready = false;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
    }
    this.prog = prog;
    gl.useProgram(prog);

    this.loc = {};
    for (const n of ['uTime', 'uAmp', 'uAspect', 'uScale', 'uMode', 'uPointer', 'uOrbit',
                     'uBurst', 'uTex', 'uUvPass', 'uPress', 'uRip']) {
      this.loc[n] = gl.getUniformLocation(prog, n) || gl.getUniformLocation(prog, n + '[0]');
    }
    this.attr = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      aCell: gl.getAttribLocation(prog, 'aCell'),
      aSeed: gl.getAttribLocation(prog, 'aSeed'),
    };

    this.buildMesh();

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([0, 0, 0, 0]));

    this.fbo = gl.createFramebuffer();
    this.fboTex = gl.createTexture();
    this.fboDepth = gl.createRenderbuffer();
    this.fboW = 0;
    this.fboH = 0;
    this.pickBuf = new Uint8Array(4);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 0);
  }

  buildMesh() {
    const gl = this.gl;
    const N = this.grid;
    const stride = 6;
    const data = new Float32Array(N * N * 6 * stride);
    let k = 0;
    const put = (px, py, cx, cy, s0, s1) => {
      data[k++] = px; data[k++] = py; data[k++] = cx; data[k++] = cy; data[k++] = s0; data[k++] = s1;
    };
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
        const cx = (i + 0.5) / N, cy = (j + 0.5) / N;
        const s0 = Math.random(), s1 = Math.random();
        put(u0, v0, cx, cy, s0, s1);
        put(u1, v0, cx, cy, s0, s1);
        put(u1, v1, cx, cy, s0, s1);
        put(u0, v0, cx, cy, s0, s1);
        put(u1, v1, cx, cy, s0, s1);
        put(u0, v1, cx, cy, s0, s1);
      }
    }
    this.vertCount = N * N * 6;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const b = stride * 4;
    gl.enableVertexAttribArray(this.attr.aPos);
    gl.vertexAttribPointer(this.attr.aPos, 2, gl.FLOAT, false, b, 0);
    gl.enableVertexAttribArray(this.attr.aCell);
    gl.vertexAttribPointer(this.attr.aCell, 2, gl.FLOAT, false, b, 8);
    gl.enableVertexAttribArray(this.attr.aSeed);
    gl.vertexAttribPointer(this.attr.aSeed, 2, gl.FLOAT, false, b, 16);
  }

  resize(cssW, cssH, dpr) {
    const gl = this.gl;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const pw = Math.max(1, Math.round(w * this.pickScale));
    const ph = Math.max(1, Math.round(h * this.pickScale));
    if (pw !== this.fboW || ph !== this.fboH) {
      this.fboW = pw; this.fboH = ph;
      gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.fboDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, pw, ph);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.fboDepth);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
    }
  }

  // 이미지든 캔버스든 그대로 텍스처로 올린다.
  upload(source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.ready = true;
  }

  // 네이티브 HTML in Canvas 경로. 없으면 false 를 준다.
  uploadElement(el) {
    const gl = this.gl;
    if (!gl.texElementImage2D) return false;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
    this.ready = true;
    return true;
  }

  setUniforms(s) {
    const gl = this.gl;
    const L = this.loc;
    gl.uniform1f(L.uTime, s.time);
    gl.uniform1f(L.uAmp, s.amp);
    gl.uniform1f(L.uAspect, s.aspect);
    gl.uniform1f(L.uScale, s.scale);
    gl.uniform1i(L.uMode, MODE_INDEX[s.mode] ?? 0);
    gl.uniform2f(L.uPointer, s.pointer[0], s.pointer[1]);
    gl.uniform2f(L.uOrbit, s.orbit[0], s.orbit[1]);
    gl.uniform3f(L.uBurst, s.burst[0], s.burst[1], s.burst[2]);
    gl.uniform1f(L.uPress, s.press);
    gl.uniform1i(L.uTex, 0);
    gl.uniform4fv(L.uRip, s.ripples);
  }

  draw(s) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.ready) return;
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    this.setUniforms(s);
    gl.uniform1i(this.loc.uUvPass, 0);
    gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
  }

  // 화면 위 한 점이 원래 텍스처의 어디였는지 되짚는다. 판 밖이면 null.
  pick(s, nx, ny) {
    if (!this.ready) return null;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.fboW, this.fboH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    this.setUniforms(s);
    gl.uniform1i(this.loc.uUvPass, 1);
    // 좌표를 색으로 싣는 판이라 섞으면 안 된다.
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
    gl.enable(gl.BLEND);

    const px = Math.min(this.fboW - 1, Math.max(0, Math.round(nx * this.fboW)));
    const py = Math.min(this.fboH - 1, Math.max(0, Math.round((1 - ny) * this.fboH)));
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pickBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const b = this.pickBuf;
    if (b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0) return null;
    const u = ((b[0] * 256 + b[1]) / 65535 - 0.002) / 0.996;
    const v = ((b[2] * 256 + b[3]) / 65535 - 0.002) / 0.996;
    if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) return null;
    return [Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))];
  }
}
