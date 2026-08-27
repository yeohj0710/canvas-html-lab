import { Surface } from './surface.js';
import { rewriteStateSelectors } from './raster.js';
import { STAGE_CSS, stageHtml, makeStageApp } from './stage-app.js';

const $ = (s) => document.querySelector(s);

const EFFECTS = [
  ['ripple', '물결'],
  ['glass', '렌즈'],
  ['wave', '파도'],
  ['fold', '접기'],
  ['shatter', '조각'],
  ['crt', '브라운관'],
];

const CODE_BASE = `
#stage {
  box-sizing: border-box;
  display: block;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid #262d3b;
  background: linear-gradient(180deg, #171d29 0%, #10141c 100%);
  color: #e7ecf6;
  font-family: system-ui, -apple-system, "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  font-size: 15px;
  line-height: 1.6;
  padding: 26px;
  -webkit-font-smoothing: antialiased;
}
#stage *, #stage *::before, #stage *::after { box-sizing: border-box; }
`;

const PRESETS = {
  '카드': `<style>
  .card {
    max-width: 380px; margin: 8px auto; padding: 24px;
    border-radius: 18px; border: 1px solid #2a3346;
    background: #151b26;
  }
  .card h3 { margin: 0 0 6px; font-size: 20px; letter-spacing: -.02em; }
  .card p  { margin: 0 0 18px; color: #8b95a9; font-size: 14px; }
  .row { display: flex; gap: 8px; }
  .b {
    flex: 1; text-align: center; padding: 11px 0; border-radius: 11px;
    border: 1px solid #313b4f; background: #1b2130; color: #cfd8e8;
    font-weight: 600; font-size: 14px; cursor: pointer;
  }
  .b:hover { background: #232c3d; border-color: #46536e; }
  .b.go { background: #5b8cff; border-color: #5b8cff; color: #fff; }
  .b.go:hover { background: #7ba1ff; }
  .tag {
    display: inline-block; margin-bottom: 12px; padding: 3px 10px;
    border-radius: 999px; font-size: 11px; font-weight: 700;
    background: #7ce7d0; color: #0d1017;
  }
</style>

<div class="card">
  <span class="tag">캔버스 안</span>
  <h3>이건 카드 그림이 아닙니다</h3>
  <p>마우스를 버튼 위에 올려 보세요. hover 가 그대로 걸립니다.</p>
  <div class="row">
    <button class="b">나중에</button>
    <button class="b go">지금 하기</button>
  </div>
</div>`,

  '버튼 묶음': `<style>
  .pad { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; padding-top: 10px; }
  .k {
    width: 92px; height: 62px; border-radius: 14px; cursor: pointer;
    border: 1px solid #313b4f; background: #1a2130; color: #aab4c6;
    font-size: 13px; font-weight: 700; display: flex;
    align-items: center; justify-content: center;
  }
  .k:hover { background: #5b8cff; border-color: #5b8cff; color: #fff; }
  .k:nth-child(3n):hover { background: #7ce7d0; border-color: #7ce7d0; color: #0d1017; }
  h4 { margin: 0 0 14px; text-align: center; font-size: 15px; color: #8b95a9; font-weight: 600; }
</style>

<h4>휘어 있어도 hover 자리는 정확합니다</h4>
<div class="pad">
  <div class="k">하나</div><div class="k">둘</div><div class="k">셋</div>
  <div class="k">넷</div><div class="k">다섯</div><div class="k">여섯</div>
  <div class="k">일곱</div><div class="k">여덟</div><div class="k">아홉</div>
</div>`,

  '글자 입력': `<style>
  .box { max-width: 400px; margin: 10px auto; }
  .box h3 { margin: 0 0 4px; font-size: 19px; }
  .box p { margin: 0 0 18px; color: #8b95a9; font-size: 13.5px; }
  label { display: block; font-size: 12px; color: #8b95a9; margin: 12px 0 6px; }
  input[type=text] {
    width: 100%; height: 40px; padding: 0 13px;
    border-radius: 11px; border: 1px solid #2a3346;
    background: #0e121a; color: #e7ecf6; font: inherit; font-size: 14px; outline: 0;
  }
  input[type=text]:focus { border-color: #5b8cff; box-shadow: 0 0 0 3px rgba(91,140,255,.18); }
  .go {
    width: 100%; margin-top: 18px; height: 42px; border-radius: 11px;
    border: 0; background: #5b8cff; color: #fff; font: inherit;
    font-weight: 700; cursor: pointer;
  }
  .go:hover { background: #7ba1ff; }
</style>

<div class="box">
  <h3>칸을 누르고 키보드를 치세요</h3>
  <p>캔버스가 키를 받는 게 아니라, 뒤에 있는 진짜 input 이 포커스를 받습니다.</p>
  <label>이름</label>
  <input type="text" placeholder="여기에">
  <label>한 줄</label>
  <input type="text" placeholder="아무 말이나">
  <button class="go">보내기</button>
</div>`,
};

// 사용자가 친 CSS 는 판 안으로만 가둔다.
function scopeCss(css, scope) {
  css = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let i = 0;
  while (i < css.length) {
    let j = i;
    while (j < css.length && css[j] !== '{' && css[j] !== ';') j++;
    if (j >= css.length) break;
    const prelude = css.slice(i, j).trim();
    if (css[j] === ';') { if (prelude) out.push(prelude + ';'); i = j + 1; continue; }
    let depth = 1, k = j + 1;
    while (k < css.length && depth > 0) {
      if (css[k] === '{') depth++;
      else if (css[k] === '}') depth--;
      k++;
    }
    const body = css.slice(j + 1, k - 1);
    if (/^@(media|supports|container|layer)/i.test(prelude)) {
      out.push(prelude + '{' + scopeCss(body, scope) + '}');
    } else if (/^@/.test(prelude)) {
      out.push(prelude + '{' + body + '}');
    } else {
      const sel = prelude.split(',').map((s) => {
        s = s.trim();
        if (!s) return '';
        if (s === ':root' || s === 'html' || s === 'body') return scope;
        if (s.indexOf(scope) === 0) return s;
        return scope + ' ' + s;
      }).filter(Boolean).join(',');
      if (sel) out.push(sel + '{' + body + '}');
    }
    i = k;
  }
  return out.join('\n');
}

function splitCode(text) {
  const styles = [];
  const html = String(text).replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, body) => {
    styles.push(body);
    return '';
  });
  return { html, css: styles.join('\n') };
}

function chip(label, on, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip' + (on ? ' on' : '');
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

function boot() {
  const stage = $('#stage');
  const holder = $('#holder');
  const canvas = $('#cv');

  const liveBase = document.createElement('style');
  const liveUser = document.createElement('style');
  document.head.append(liveBase, liveUser);

  const state = {
    source: 'app',
    baseCss: rewriteStateSelectors(STAGE_CSS),
    userCss: '',
  };

  const getCss = () => state.baseCss + '\n' + state.userCss;
  const syncCss = () => {
    liveBase.textContent = state.baseCss;
    liveUser.textContent = state.userCss;
  };

  stage.innerHTML = stageHtml();
  syncCss();

  let app = null;
  const surface = new Surface({
    canvas, holder, stage, getCss,
    hooks: {
      onActivate: (el, act) => { if (app && state.source === 'app') app.activate(el, act); },
      onDrag: (el, key, r) => { if (app && state.source === 'app') app.drag(el, key, r); },
      onFail: () => {
        holder.classList.add('is-bare');
        $('#fallback').hidden = false;
        $('#badge').textContent = '판 그대로 보기';
      },
    },
  });

  app = makeStageApp(stage, () => surface.markDirty());
  window.__lab = { surface, state, get app() { return app; } };  // 검증용 손잡이
  setInterval(() => {
    if (state.source === 'app' && app && app.tick()) surface.markDirty();
  }, 1000);

  // ---- 효과 고르기 ----
  const chips = $('#chips');
  let mode = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'glass' : 'ripple';
  EFFECTS.forEach(([key, label]) => {
    const b = chip(label, key === mode, () => {
      mode = key;
      surface.setMode(key);
      Array.from(chips.children).forEach((c) => c.classList.toggle('on', c === b));
    });
    chips.appendChild(b);
  });
  surface.setMode(mode);

  // ---- 세기와 속도 ----
  const amp = $('#amp'), ampv = $('#ampv'), spd = $('#spd'), spdv = $('#spdv');
  const applyAmp = () => { const v = amp.value / 100; surface.setAmp(v); ampv.textContent = v.toFixed(2); };
  const applySpd = () => { const v = spd.value / 100; surface.setSpeed(v); spdv.textContent = v.toFixed(2); };
  amp.addEventListener('input', applyAmp);
  spd.addEventListener('input', applySpd);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) spd.value = 20;
  applyAmp(); applySpd();

  // ---- 판에 넣을 내용 ----
  const code = $('#code');
  const note = $('#editnote');
  code.value = PRESETS['카드'];

  function useApp() {
    state.source = 'app';
    state.baseCss = rewriteStateSelectors(STAGE_CSS);
    state.userCss = '';
    syncCss();
    surface.setContent(stageHtml());
    app = makeStageApp(stage, () => surface.markDirty());
  }

  function useCode() {
    state.source = 'code';
    const { html, css } = splitCode(code.value);
    state.baseCss = rewriteStateSelectors(CODE_BASE);
    state.userCss = rewriteStateSelectors(scopeCss(css, '#stage'));
    syncCss();
    surface.setContent(html);
  }

  const srcs = $('#srcs');
  const bApp = chip('미니 앱', true, () => { useApp(); pick(bApp); });
  const bCode = chip('내 코드', false, () => { useCode(); pick(bCode); });
  const pick = (b) => Array.from(srcs.children).forEach((c) => c.classList.toggle('on', c === b));
  srcs.append(bApp, bCode);

  const presets = $('#presets');
  Object.keys(PRESETS).forEach((name) => {
    presets.appendChild(chip(name, false, () => {
      code.value = PRESETS[name];
      useCode(); pick(bCode);
      flash();
    }));
  });

  let t = null;
  code.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { useCode(); pick(bCode); flash(); }, 220);
  });

  let ft = null;
  function flash() {
    note.textContent = '판에 올렸습니다';
    note.classList.add('on');
    clearTimeout(ft);
    ft = setTimeout(() => {
      note.textContent = '고치면 바로 올라갑니다';
      note.classList.remove('on');
    }, 1400);
  }

  // ---- 어떤 경로로 그리는지 ----
  const badge = $('#badge');
  let hasNative = false;
  try {
    const probe = document.createElement('canvas').getContext('webgl');
    hasNative = !!(probe && probe.texElementImage2D) ||
                (typeof CanvasRenderingContext2D !== 'undefined' &&
                 !!CanvasRenderingContext2D.prototype.drawElementImage);
  } catch (_) { hasNative = false; }

  if (surface.failed) {
    // onFail 이 이미 처리했다
  } else if (hasNative) {
    badge.textContent = '네이티브 API 있음';
    badge.classList.add('native');
    badge.title = '이 브라우저에는 HTML in Canvas 가 켜져 있습니다. 지금 화면은 어디서나 도는 범용 경로로 그립니다.';
  } else {
    badge.textContent = '범용 경로';
    badge.title = 'DOM 을 SVG 로 구워 텍스처로 올리고, 포인터는 UV 를 되읽어 DOM 으로 돌려보냅니다.';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
