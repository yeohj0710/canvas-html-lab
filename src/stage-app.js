// 캔버스 안에 들어가는 작은 앱. 평범한 div 와 input 으로만 짰다.
// 여기 있는 것들은 전부 진짜 DOM 이라, 화면 낭독기도 캔버스가 아니라 이 쪽을 읽는다.

export const STAGE_CSS = `
#stage {
  --bg: #12161f;
  --bg2: #161b26;
  --line: #262d3b;
  --tx: #e7ecf6;
  --mut: #8b95a9;
  --acc: #5b8cff;
  --acc2: #7ce7d0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, #171d29 0%, #10141c 100%);
  color: var(--tx);
  font-family: system-ui, -apple-system, "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  font-size: 14px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}
#stage *, #stage *::before, #stage *::after { box-sizing: border-box; }

#stage .bar-top {
  display: flex; align-items: center; gap: 12px;
  padding: 0 16px; height: 44px; flex: 0 0 44px;
  border-bottom: 1px solid var(--line);
  background: #10141c;
}
#stage .dots { display: flex; gap: 6px; }
#stage .dots i { width: 10px; height: 10px; border-radius: 50%; background: #2c3444; display: block; }
#stage .dots i:nth-child(1) { background: #e0645c; }
#stage .dots i:nth-child(2) { background: #e0b04a; }
#stage .dots i:nth-child(3) { background: #56b96b; }
#stage .bar-top .name { font-weight: 650; letter-spacing: -0.01em; }
#stage .bar-top .clock {
  margin-left: auto; color: var(--mut); font-size: 12px;
  font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
}

#stage .tabs { display: flex; gap: 4px; padding: 10px 12px 0; flex: 0 0 auto; }
#stage .tab {
  appearance: none; border: 0; background: transparent; cursor: pointer;
  color: var(--mut); font: inherit; font-weight: 600; font-size: 13px;
  padding: 7px 14px; border-radius: 9px; transition: none;
}
#stage .tab:hover { color: var(--tx); background: #1c2230; }
#stage .tab.on { color: #0d1017; background: var(--acc2); }

#stage .body { flex: 1 1 auto; min-height: 0; padding: 12px 14px 0; }
#stage .pane { display: none; height: 100%; flex-direction: column; }
#stage .pane.on { display: flex; }
#stage .pane[data-pane="form"] { justify-content: center; padding-bottom: 6px; }

#stage .search {
  display: flex; align-items: center; gap: 8px;
  border: 1px solid var(--line); border-radius: 11px;
  background: #0e121a; padding: 0 12px; height: 38px; flex: 0 0 38px;
}
#stage .search:focus-within { border-color: var(--acc); box-shadow: 0 0 0 3px rgba(91,140,255,.16); }
#stage .search svg { width: 15px; height: 15px; flex: 0 0 15px; stroke: var(--mut); fill: none; stroke-width: 2; }
#stage .search input {
  appearance: none; border: 0; outline: 0; background: transparent;
  color: var(--tx); font: inherit; width: 100%; height: 36px; padding: 0;
}
#stage .search input::placeholder { color: #5b6577; }

#stage .rows { flex: 1 1 auto; min-height: 0; overflow: hidden; margin: 10px -4px 0; padding: 0 4px; }
#stage .rows-in { will-change: transform; }
#stage .row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; cursor: pointer;
}
#stage .row:hover { background: #1a202c; }
#stage .row.on { background: rgba(91,140,255,.16); box-shadow: inset 0 0 0 1px rgba(91,140,255,.45); }
#stage .row .pip { width: 7px; height: 7px; border-radius: 50%; background: #3b4557; flex: 0 0 7px; }
#stage .row.done .pip { background: var(--acc2); }
#stage .row.run .pip { background: #e0b04a; }
#stage .row .t { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#stage .row .g { color: var(--mut); font-size: 12px; font-variant-numeric: tabular-nums; }

#stage .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
#stage .lab { color: var(--mut); font-size: 12px; margin-bottom: 6px; display: block; }
#stage .field {
  display: flex; align-items: center;
  border: 1px solid var(--line); border-radius: 11px; background: #0e121a;
  padding: 0 12px; height: 38px;
}
#stage .field:focus-within { border-color: var(--acc); box-shadow: 0 0 0 3px rgba(91,140,255,.16); }
#stage .field input {
  appearance: none; border: 0; outline: 0; background: transparent;
  color: var(--tx); font: inherit; width: 100%; height: 36px; padding: 0;
}
#stage .field input::placeholder { color: #5b6577; }

#stage .seg { display: flex; gap: 4px; background: #0e121a; border: 1px solid var(--line); border-radius: 11px; padding: 4px; }
#stage .seg > div {
  flex: 1 1 0; text-align: center; padding: 6px 0; border-radius: 8px;
  font-size: 13px; color: var(--mut); cursor: pointer;
}
#stage .seg > div:hover { color: var(--tx); }
#stage .seg > div.on { background: #222a3a; color: var(--tx); box-shadow: inset 0 0 0 1px #313b4f; }

#stage .tog { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0; }
#stage .tog .sw {
  width: 40px; height: 23px; border-radius: 999px; background: #232b3a;
  position: relative; flex: 0 0 40px; box-shadow: inset 0 0 0 1px #2f394b;
}
#stage .tog .sw::after {
  content: ""; position: absolute; top: 3px; left: 3px;
  width: 17px; height: 17px; border-radius: 50%; background: #6a768c;
}
#stage .tog.on .sw { background: var(--acc); box-shadow: inset 0 0 0 1px var(--acc); }
#stage .tog.on .sw::after { left: 20px; background: #fff; }
#stage .tog:hover .t { color: var(--tx); }
#stage .tog .t { color: var(--mut); font-size: 13px; }

#stage .slider { position: relative; height: 26px; cursor: ew-resize; }
#stage .slider .trk { position: absolute; left: 0; right: 0; top: 11px; height: 5px; border-radius: 999px; background: #232b3a; }
#stage .slider .fil { position: absolute; left: 0; top: 11px; height: 5px; border-radius: 999px; background: linear-gradient(90deg, var(--acc), var(--acc2)); }
#stage .slider .knb {
  position: absolute; top: 4px; width: 19px; height: 19px; margin-left: -9px;
  border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.5);
}
#stage .slider:hover .knb { box-shadow: 0 0 0 5px rgba(91,140,255,.22), 0 1px 4px rgba(0,0,0,.5); }

#stage .sum {
  margin-top: 12px; padding: 10px 13px; border-radius: 11px;
  background: #0e121a; border: 1px solid var(--line); color: var(--mut); font-size: 13px;
}
#stage .sum b { color: var(--tx); font-weight: 650; }

#stage .chart { flex: 1 1 auto; min-height: 0; display: flex; align-items: flex-end; gap: 8px; padding: 6px 2px 0; }
#stage .col { flex: 1 1 0; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; gap: 6px; }
#stage .col .v { text-align: center; font-size: 11px; color: var(--mut); font-variant-numeric: tabular-nums; }
#stage .col .b { border-radius: 7px 7px 3px 3px; background: linear-gradient(180deg, var(--acc), #33509e); }
#stage .col:hover .b { background: linear-gradient(180deg, var(--acc2), #2f8f7d); }
#stage .col .k { text-align: center; font-size: 11px; color: #5b6577; }

#stage .btn {
  appearance: none; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1px solid var(--line); background: #1a202c; color: var(--tx);
  border-radius: 10px; padding: 8px 14px;
}
#stage .btn:hover { background: #222a3a; border-color: #38425a; }
#stage .btn.pri { background: var(--acc); border-color: var(--acc); color: #fff; }
#stage .btn.pri:hover { background: #6f9bff; }

#stage .bar-btm {
  display: flex; align-items: center; gap: 8px;
  flex: 0 0 40px; height: 40px; padding: 0 16px; margin-top: 10px;
  border-top: 1px solid var(--line); background: #10141c;
  color: var(--mut); font-size: 12px;
}
#stage .bar-btm .k { color: #5b6577; }
#stage .bar-btm .v { color: var(--acc2); font-weight: 600; }
#stage .bar-btm .r { margin-left: auto; font-variant-numeric: tabular-nums; }
`;

const ITEMS = [
  ['판 안의 DOM 만들기', 'done'],
  ['상태 선택자 바꿔 끼우기', 'done'],
  ['SVG 로 감싸서 굽기', 'done'],
  ['텍스처 올리기', 'done'],
  ['격자 8만 6천 점 깔기', 'done'],
  ['셰이더 두 벌 엮기', 'done'],
  ['UV 를 색으로 뽑기', 'run'],
  ['한 점만 되읽기', 'run'],
  ['그 자리 요소 찾기', 'run'],
  ['hover 표시 붙이기', 'wait'],
  ['키보드 포커스 넘기기', 'wait'],
  ['휠로 목록 굴리기', 'wait'],
];

const BARS = ['월', '화', '수', '목', '금', '토', '일'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function stageHtml() {
  const rows = ITEMS.map((it, i) =>
    '<div class="row ' + it[1] + (i === 6 ? ' on' : '') + '" data-act="row:' + i + '">' +
      '<span class="pip"></span>' +
      '<span class="t">' + esc(it[0]) + '</span>' +
      '<span class="g">' + (it[1] === 'done' ? '완료' : it[1] === 'run' ? '진행' : '대기') + '</span>' +
    '</div>').join('');

  const cols = BARS.map((k, i) =>
    '<div class="col" data-act="bar:' + i + '">' +
      '<div class="v">0</div>' +
      '<div class="b" style="height:10%"></div>' +
      '<div class="k">' + k + '</div>' +
    '</div>').join('');

  return `
<div class="bar-top">
  <div class="dots"><i></i><i></i><i></i></div>
  <div class="name">캔버스 안의 작은 앱</div>
  <div class="clock" data-clock>00:00:00</div>
</div>

<div class="tabs">
  <button type="button" class="tab on" data-act="tab:list">목록</button>
  <button type="button" class="tab" data-act="tab:form">입력</button>
  <button type="button" class="tab" data-act="tab:chart">그래프</button>
</div>

<div class="body">
  <div class="pane on" data-pane="list">
    <div class="search">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" placeholder="여기에 글자를 쳐 보세요" autocomplete="off" data-q>
    </div>
    <div class="rows" data-scroll><div class="rows-in">${rows}</div></div>
  </div>

  <div class="pane" data-pane="form">
    <div class="grid2">
      <div>
        <span class="lab">이름</span>
        <div class="field"><input type="text" placeholder="아무 글자나" autocomplete="off" data-name></div>
      </div>
      <div>
        <span class="lab">분류</span>
        <div class="seg">
          <div class="on" data-act="seg:물결">물결</div>
          <div data-act="seg:유리">유리</div>
          <div data-act="seg:조각">조각</div>
        </div>
      </div>
      <div>
        <span class="lab">세기</span>
        <div class="slider" data-drag="a"><div class="trk"></div><div class="fil" style="width:62%"></div><div class="knb" style="left:62%"></div></div>
      </div>
      <div>
        <span class="lab">길이</span>
        <div class="slider" data-drag="b"><div class="trk"></div><div class="fil" style="width:28%"></div><div class="knb" style="left:28%"></div></div>
      </div>
      <div class="tog on" data-act="tog:loop"><span class="sw"></span><span class="t">되돌아오기</span></div>
      <div class="tog" data-act="tog:grid"><span class="sw"></span><span class="t">격자 보기</span></div>
    </div>
    <div class="sum" data-sum>이름이 비었습니다. 분류는 <b>물결</b>, 세기 <b>62</b>, 길이 <b>28</b>.</div>
  </div>

  <div class="pane" data-pane="chart">
    <div class="chart">${cols}</div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:12px">
      <button type="button" class="btn pri" data-act="roll">다시 뽑기</button>
      <button type="button" class="btn" data-act="flat">평평하게</button>
      <span class="lab" style="margin:0 0 0 auto">막대를 눌러도 바뀝니다</span>
    </div>
  </div>
</div>

<div class="bar-btm">
  <span class="k">마지막 동작</span>
  <span class="v" data-last>없음</span>
  <span class="r" data-count>0 번</span>
</div>`;
}

export function makeStageApp(stage, onChange) {
  const q = (s) => stage.querySelector(s);
  const qa = (s) => Array.from(stage.querySelectorAll(s));

  const st = { seg: '물결', a: 62, b: 28, count: 0, bars: BARS.map(() => 10) };

  function say(text) {
    st.count++;
    const l = q('[data-last]'); if (l) l.textContent = text;
    const c = q('[data-count]'); if (c) c.textContent = st.count + ' 번';
  }

  function summary() {
    const name = (q('[data-name]') || {}).value || '';
    const el = q('[data-sum]');
    if (!el) return;
    el.innerHTML = (name ? '이름은 <b>' + esc(name) + '</b>' : '이름이 비었습니다') +
      '. 분류는 <b>' + esc(st.seg) + '</b>, 세기 <b>' + Math.round(st.a) + '</b>, 길이 <b>' + Math.round(st.b) + '</b>.';
  }

  function filter() {
    const v = ((q('[data-q]') || {}).value || '').trim();
    let shown = 0;
    qa('.row').forEach((row, i) => {
      const hit = !v || ITEMS[i][0].includes(v);
      row.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    const box = q('[data-scroll]');
    if (box) { box.dataset.cvScroll = '0'; box.firstElementChild.style.transform = 'translateY(0px)'; }
    return shown;
  }

  function drawBars() {
    qa('.col').forEach((col, i) => {
      const v = st.bars[i];
      col.querySelector('.b').style.height = Math.max(4, v) + '%';
      col.querySelector('.v').textContent = Math.round(v);
    });
  }

  function tick() {
    const el = q('[data-clock]');
    if (!el) return false;
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const next = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    if (el.textContent === next) return false;
    el.textContent = next;
    return true;
  }

  stage.addEventListener('input', (e) => {
    if (e.target.hasAttribute('data-q')) { const n = filter(); say('찾기 ' + n + '개'); }
    if (e.target.hasAttribute('data-name')) { summary(); }
    onChange && onChange();
  });

  function activate(el, act) {
    const [kind, arg] = act.split(':');

    if (kind === 'tab') {
      qa('.tab').forEach((t) => t.classList.toggle('on', t === el));
      qa('.pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === arg));
      say(el.textContent.trim() + ' 탭');

    } else if (kind === 'row') {
      qa('.row').forEach((r) => r.classList.toggle('on', r === el));
      say(el.querySelector('.t').textContent.trim());

    } else if (kind === 'seg') {
      qa('.seg > div').forEach((d) => d.classList.toggle('on', d === el));
      st.seg = arg; summary(); say('분류 ' + arg);

    } else if (kind === 'tog') {
      el.classList.toggle('on');
      say((el.querySelector('.t').textContent.trim()) + (el.classList.contains('on') ? ' 켬' : ' 끔'));

    } else if (kind === 'roll') {
      st.bars = st.bars.map(() => 14 + Math.random() * 86);
      drawBars(); say('다시 뽑기');

    } else if (kind === 'flat') {
      st.bars = st.bars.map(() => 12);
      drawBars(); say('평평하게');

    } else if (kind === 'bar') {
      const i = Number(arg);
      st.bars[i] = 14 + Math.random() * 86;
      drawBars(); say(BARS[i] + '요일');
    }
    onChange && onChange();
  }

  function drag(el, key, ratio) {
    const v = ratio * 100;
    st[key] = v;
    el.querySelector('.fil').style.width = v + '%';
    el.querySelector('.knb').style.left = v + '%';
    summary();
  }

  drawBars();
  summary();
  return { activate, drag, tick };
}
