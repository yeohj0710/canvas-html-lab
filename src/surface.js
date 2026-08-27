// 캔버스 한 장을 살아 있는 DOM 판으로 만든다.
// 그리기는 gl.js, 굽기는 raster.js 가 맡고, 여기서는 손가락과 DOM 을 이어 준다.

import { Warp } from './gl.js';
import { makeRasterizer, rewriteStateSelectors } from './raster.js';

const PLANE_SCALE = 0.80;   // assets/site.css 의 .holder inset 과 (1-이 값)/2 로 맞물린다
const MAX_RIPPLES = 8;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export class Surface {
  constructor(opts) {
    this.canvas = opts.canvas;
    this.holder = opts.holder;      // 판 DOM 을 담는 투명한 상자
    this.stage = opts.stage;        // 실제로 굽고 만질 DOM
    this.getCss = opts.getCss;
    this.hooks = opts.hooks || {};

    this.mode = 'ripple';
    this.amp = 1;
    this.speed = 1;
    this.time = 0;
    this.pointer = [0.5, 0.5];
    this.orbit = [0, 0];
    this.orbitTarget = [0, 0];
    this.press = 0;
    this.pressTarget = 0;
    this.burst = [0.5, 0.5, 2];
    this.burstAt = -99;
    this.ripples = new Float32Array(MAX_RIPPLES * 4);
    this.ripCursor = 0;

    this.hoverEl = null;
    this.activeEl = null;
    this.dragging = null;           // {el, key} 또는 'orbit'
    this.lastClient = null;
    this.wakeAt = 0;
    this.caretOn = true;
    this.paused = false;
    this.failed = false;

    this.rasterBusy = false;
    this.rasterDirty = true;
    this.pickWanted = false;

    try {
      this.warp = new Warp(this.canvas, { grid: window.innerWidth < 720 ? 84 : 120 });
    } catch (err) {
      console.warn('[lab] webgl 시작 실패', err);
      this.lastError = String(err && err.message || err);
      this.fail('webgl');
      return;
    }

    this.raster = makeRasterizer({
      stage: this.stage,
      getCss: () => this.getCss(),
      scale: Math.max(1.8, Math.min(2, window.devicePixelRatio || 1) * 1.4),
    });

    this.native = false;
    this.bind();
    this.observe();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  fail(reason) {
    this.failed = true;
    this.holder.classList.add('is-bare');
    this.canvas.classList.add('is-off');
    if (this.hooks.onFail) this.hooks.onFail(reason);
  }

  // ---------- 붙이기 ----------

  bind() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e));
    c.addEventListener('pointerleave', () => this.onLeave());
    c.addEventListener('mousedown', (e) => e.preventDefault());
    c.addEventListener('dblclick', () => { this.orbitTarget = [0, 0]; });
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    this.stage.addEventListener('input', () => this.markDirty());
    this.stage.addEventListener('change', () => this.markDirty());

    setInterval(() => {
      const a = document.activeElement;
      if (a && this.stage.contains(a)) {
        this.caretOn = !this.caretOn;
        this.markDirty();
      } else if (!this.caretOn) {
        this.caretOn = true;
      }
    }, 530);
  }

  observe() {
    const ro = new ResizeObserver(() => { this.markDirty(); });
    ro.observe(this.canvas);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((ents) => {
        this.paused = !ents[0].isIntersecting;
      }, { threshold: 0 }).observe(this.canvas);
    }
  }

  // ---------- 상태 ----------

  setMode(m) {
    this.mode = m;
    if (m === 'shatter') this.fire(0.5, 0.5);
    if (m === 'fold') this.pointer = [0.62, 0.5];
  }

  setAmp(v) { this.amp = v; }
  setSpeed(v) { this.speed = v; }

  markDirty() { this.rasterDirty = true; }

  setContent(html) {
    this.stage.innerHTML = html;
    this.hoverEl = null;
    this.activeEl = null;
    this.markDirty();
  }

  addRipple(u, v, strength) {
    const i = (this.ripCursor % MAX_RIPPLES) * 4;
    this.ripCursor++;
    this.ripples[i] = u;
    this.ripples[i + 1] = v;
    this.ripples[i + 2] = this.time;
    this.ripples[i + 3] = strength;
  }

  fire(u, v) {
    this.burst[0] = u;
    this.burst[1] = v;
    this.burstAt = this.time;
  }

  // ---------- 되짚기 ----------

  state() {
    const r = this.canvas.getBoundingClientRect();
    return {
      time: this.time,
      amp: this.amp,
      aspect: r.height > 0 ? r.width / r.height : 1.6,
      scale: PLANE_SCALE,
      mode: this.mode,
      pointer: this.pointer,
      orbit: this.orbit,
      burst: this.burst,
      press: this.press,
      ripples: this.ripples,
    };
  }

  // 판을 평평하다고 보고 손끝 자리를 푼다. 렌즈와 접기는 이 값을 쓴다.
  // 되짚은 값을 그대로 쓰면 스스로를 먹여서 각도가 튄다.
  flatUV(nx, ny) {
    const r = this.canvas.getBoundingClientRect();
    const a = r.height > 0 ? r.width / r.height : 1.6;
    const S = PLANE_SCALE;
    const A = (nx * 2 - 1) * a / S;
    const B = (1 - ny * 2) / S;
    const cy = Math.cos(this.orbit[0]), sy = Math.sin(this.orbit[0]);
    const cp = Math.cos(this.orbit[1]), sp = Math.sin(this.orbit[1]);
    const det = cy * (cp + 0.3 * B * sp) - 0.3 * A * sy;
    if (Math.abs(det) < 1e-6) return null;
    const x = (A * cp) / det;
    const y = (cy * B - A * sy * sp) / det;
    return [x / (2 * a) + 0.5, 0.5 - y / 2];
  }

  toStagePoint(clientX, clientY) {
    const cr = this.canvas.getBoundingClientRect();
    if (cr.width < 2 || cr.height < 2) return null;
    const nx = (clientX - cr.left) / cr.width;
    const ny = (clientY - cr.top) / cr.height;
    const flat = this.flatUV(nx, ny);
    if (flat) this.pointer = flat;
    const uv = this.warp.pick(this.state(), nx, ny);
    if (!uv) return null;
    const sr = this.stage.getBoundingClientRect();
    return {
      uv,
      x: sr.left + uv[0] * sr.width,
      y: sr.top + uv[1] * sr.height,
    };
  }

  elementAt(x, y) {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
    const list = document.elementsFromPoint(x, y);
    for (const el of list) {
      if (el === this.stage || this.stage.contains(el)) return el;
    }
    return null;
  }

  // ---------- 표시 붙이기 ----------

  markChain(el, attr) {
    let n = el;
    while (n && n !== this.stage.parentNode) {
      n.setAttribute(attr, '');
      n = n.parentElement;
    }
  }

  clearMark(attr) {
    this.stage.querySelectorAll('[' + attr + ']').forEach((n) => n.removeAttribute(attr));
    if (this.stage.hasAttribute(attr)) this.stage.removeAttribute(attr);
  }

  setHover(el) {
    if (el === this.hoverEl) return;
    this.hoverEl = el;
    this.clearMark('data-cvh');
    if (el) this.markChain(el, 'data-cvh');
    this.markDirty();
  }

  syncFocusMark() {
    this.clearMark('data-cvf');
    this.clearMark('data-cvf-in');
    const a = document.activeElement;
    if (a && this.stage.contains(a)) {
      a.setAttribute('data-cvf', '');
      this.markChain(a, 'data-cvf-in');
    }
  }

  // ---------- 포인터 ----------

  actionOf(el) {
    let n = el;
    while (n && n !== this.stage.parentNode) {
      if (n.hasAttribute && (n.hasAttribute('data-act') || n.hasAttribute('data-drag'))) return n;
      if (n.tagName === 'BUTTON' || n.tagName === 'A' || n.tagName === 'INPUT' ||
          n.tagName === 'LABEL' || n.tagName === 'SELECT' || n.tagName === 'TEXTAREA') return n;
      n = n.parentElement;
    }
    return null;
  }

  onMove(e) {
    this.lastClient = [e.clientX, e.clientY];
    this.pickWanted = true;
    if (this.dragging === 'orbit' && this.orbitFrom) {
      const dx = e.clientX - this.orbitFrom[0];
      const dy = e.clientY - this.orbitFrom[1];
      this.orbitTarget[0] = clamp(this.orbitStart[0] + dx * 0.0035, -0.55, 0.55);
      this.orbitTarget[1] = clamp(this.orbitStart[1] - dy * 0.0035, -0.38, 0.38);
    }
  }

  onDown(e) {
    this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
    this.lastClient = [e.clientX, e.clientY];
    this.pressTarget = 1;

    const p = this.toStagePoint(e.clientX, e.clientY);
    const el = p ? this.elementAt(p.x, p.y) : null;
    const target = el ? this.actionOf(el) : null;

    const at = p ? p.uv : this.pointer;
    if (this.mode === 'ripple') this.addRipple(at[0], at[1], 1.35);
    if (this.mode === 'shatter') this.fire(at[0], at[1]);

    if (e.shiftKey || e.button === 2 || !target) {
      this.dragging = 'orbit';
      this.orbitFrom = [e.clientX, e.clientY];
      this.orbitStart = [this.orbitTarget[0], this.orbitTarget[1]];
      this.blurStage();
      return;
    }

    this.activeEl = target;
    this.markChain(target, 'data-cva');

    if (target.hasAttribute && target.hasAttribute('data-drag')) {
      this.dragging = { el: target, key: target.getAttribute('data-drag') };
      this.applyDrag(p);
      return;
    }
    this.dragging = { el: target, key: null };
    this.markDirty();
  }

  onUp(e) {
    this.pressTarget = 0;
    const wasOrbit = this.dragging === 'orbit';
    const drag = this.dragging;
    this.dragging = null;
    this.clearMark('data-cva');

    if (wasOrbit || !drag) { this.markDirty(); return; }
    if (drag.key) { this.markDirty(); return; }

    const p = this.toStagePoint(e.clientX, e.clientY);
    const el = p ? this.elementAt(p.x, p.y) : null;
    const target = el ? this.actionOf(el) : null;
    if (target && target === drag.el) this.activate(target, p);
    this.activeEl = null;
    this.markDirty();
  }

  onLeave() {
    this.setHover(null);
    this.pressTarget = 0;
    this.lastClient = null;
  }

  onWheel(e) {
    const p = this.toStagePoint(e.clientX, e.clientY);
    if (!p) return;
    const el = this.elementAt(p.x, p.y);
    if (!el) return;
    const box = el.closest('[data-scroll]');
    if (!box) return;
    const inner = box.firstElementChild;
    if (!inner) return;
    const max = Math.max(0, inner.scrollHeight - box.clientHeight);
    const cur = Number(box.dataset.cvScroll || 0);
    const next = clamp(cur + e.deltaY, 0, max);
    if (next === cur) return;
    e.preventDefault();
    box.dataset.cvScroll = String(next);
    inner.style.transform = 'translateY(' + (-next) + 'px)';
    this.markDirty();
  }

  blurStage() {
    const a = document.activeElement;
    if (a && this.stage.contains(a)) { a.blur(); this.syncFocusMark(); this.markDirty(); }
  }

  applyDrag(p) {
    if (!p || !this.dragging || !this.dragging.el) return;
    const el = this.dragging.el;
    const r = el.getBoundingClientRect();
    if (r.width < 2) return;
    const ratio = clamp((p.x - r.left) / r.width, 0, 1);
    if (this.hooks.onDrag) this.hooks.onDrag(el, this.dragging.key, ratio);
    this.markDirty();
  }

  activate(el, p) {
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'checkbox' || t === 'radio' || t === 'button' || t === 'submit') {
        el.click();
      } else {
        el.focus({ preventScroll: true });
      }
      this.syncFocusMark();
      this.markDirty();
      return;
    }
    this.blurStage();
    if (this.hooks.onActivate && el.hasAttribute('data-act')) {
      this.hooks.onActivate(el, el.getAttribute('data-act'), p);
    } else if (tag === 'BUTTON' || tag === 'A' || tag === 'LABEL') {
      el.click();
    }
    this.markDirty();
  }

  // ---------- 굽기 ----------

  async bake() {
    if (this.rasterBusy || this.failed) return;
    const r = this.stage.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.rasterBusy = true;
    this.rasterDirty = false;
    try {
      const img = await this.raster.render(Math.round(r.width), Math.round(r.height), this.caretOn);
      if (img) this.warp.upload(img);
    } catch (err) {
      this.rasterFails = (this.rasterFails || 0) + 1;
      if (this.rasterFails > 3) this.fail('raster');
    } finally {
      this.rasterBusy = false;
    }
  }

  // ---------- 매 프레임 ----------

  loop(now) {
    requestAnimationFrame(this.loop);
    if (this.failed) return;

    const t = now / 1000;
    if (this.lastNow === undefined) this.lastNow = t;
    const dt = Math.min(0.05, t - this.lastNow);
    this.lastNow = t;
    if (this.paused) return;

    this.time += dt * this.speed;

    const rect = this.canvas.getBoundingClientRect();
    this.warp.resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));

    this.orbit[0] += (this.orbitTarget[0] - this.orbit[0]) * Math.min(1, dt * 9);
    this.orbit[1] += (this.orbitTarget[1] - this.orbit[1]) * Math.min(1, dt * 9);
    this.press += (this.pressTarget - this.press) * Math.min(1, dt * 12);

    const age = this.time - this.burstAt;
    this.burst[2] = age >= 0 && age <= 1.6 ? age / 1.6 : 2;

    if (this.rasterDirty && !this.rasterBusy) this.bake();

    if (this.lastClient) {
      const p = this.toStagePoint(this.lastClient[0], this.lastClient[1]);
      if (p) {
        if (this.dragging && this.dragging.key) {
          this.applyDrag(p);
        } else if (!this.dragging) {
          const el = this.elementAt(p.x, p.y);
          this.setHover(el ? this.actionOf(el) : null);
          this.canvas.style.cursor = this.cursorFor(el);
        }
      } else if (!this.dragging) {
        this.setHover(null);
        this.canvas.style.cursor = 'grab';
      }
      if (this.mode === 'ripple' && this.time - this.wakeAt > 0.16 && this.movedFar()) {
        this.wakeAt = this.time;
        this.addRipple(this.pointer[0], this.pointer[1], 0.30);
      }
    }

    this.warp.draw(this.state());
  }

  movedFar() {
    if (!this.prevClient) { this.prevClient = this.lastClient.slice(); return false; }
    const dx = this.lastClient[0] - this.prevClient[0];
    const dy = this.lastClient[1] - this.prevClient[1];
    this.prevClient = this.lastClient.slice();
    return dx * dx + dy * dy > 26;
  }

  cursorFor(el) {
    if (!el) return this.dragging === 'orbit' ? 'grabbing' : 'grab';
    const t = this.actionOf(el);
    if (!t) return 'grab';
    if (t.tagName === 'INPUT' && !/checkbox|radio|button|submit/.test(t.type || '')) return 'text';
    if (t.hasAttribute('data-drag')) return 'ew-resize';
    return 'pointer';
  }
}

export { rewriteStateSelectors, PLANE_SCALE };
