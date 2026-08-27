// 살아 있는 DOM 한 덩이를 SVG foreignObject 로 감싸서 그림으로 굽는다.
// 텍스트 입력은 그대로 구우면 값이 안 실리니, 굽는 순간에만 같은 모양의 div 로 바꿔 끼운다.

const MIRROR_PROPS = [
  'boxSizing', 'width', 'height', 'padding', 'border', 'borderRadius',
  'background', 'backgroundColor', 'color', 'font', 'letterSpacing',
  'lineHeight', 'textAlign', 'margin', 'display', 'alignItems', 'flex',
  'minWidth', 'maxWidth', 'outline', 'boxShadow', 'opacity',
];

const TEXTY = 'input[type="text"], input[type="search"], input[type="email"], input[type="number"], input:not([type])';

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// :hover 같은 상태 선택자는 캔버스 안에서 절대 안 걸린다. 우리가 붙이는 표시도 같이 먹게 고쳐 둔다.
export function rewriteStateSelectors(css) {
  return String(css)
    .replace(/:hover/g, ':is(:hover,[data-cvh])')
    .replace(/:focus-within/g, ':is(:focus-within,[data-cvf-in])')
    .replace(/:focus-visible/g, ':is(:focus-visible,[data-cvf])')
    .replace(/:focus/g, ':is(:focus,[data-cvf])')
    .replace(/:active/g, ':is(:active,[data-cva])');
}

function mirrorInputs(live, clone, caretOn) {
  const liveTexty = live.querySelectorAll(TEXTY);
  const cloneTexty = clone.querySelectorAll(TEXTY);
  for (let i = 0; i < liveTexty.length; i++) {
    const src = liveTexty[i];
    const dst = cloneTexty[i];
    if (!dst || !dst.parentNode) continue;
    const cs = getComputedStyle(src);
    const div = document.createElement('div');
    div.className = (src.className || '') + ' cv-mirror';
    let style = '';
    for (const p of MIRROR_PROPS) {
      const v = cs[p];
      if (v) style += p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + v + ';';
    }
    style += 'white-space:pre;overflow:hidden;';
    div.setAttribute('style', style);
    const val = src.value;
    if (val) {
      div.appendChild(document.createTextNode(val));
    } else if (src.placeholder) {
      const ph = document.createElement('span');
      ph.setAttribute('style', 'opacity:.45');
      ph.textContent = src.placeholder;
      div.appendChild(ph);
    }
    if (document.activeElement === src) {
      const caret = document.createElement('span');
      caret.setAttribute('style',
        'display:inline-block;width:1.5px;height:1em;vertical-align:-.16em;margin-left:1px;' +
        'background:currentColor;opacity:' + (caretOn ? '1' : '0'));
      div.appendChild(caret);
    }
    dst.parentNode.replaceChild(div, dst);
  }

  const liveBox = live.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  const cloneBox = clone.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  for (let i = 0; i < liveBox.length; i++) {
    if (!cloneBox[i]) continue;
    if (liveBox[i].checked) cloneBox[i].setAttribute('checked', 'checked');
    else cloneBox[i].removeAttribute('checked');
  }
}

export function makeRasterizer({ stage, getCss, scale = 1.6 }) {
  const img = new Image();
  img.decoding = 'sync';
  let inflight = 0;

  async function render(w, h, caretOn) {
    if (w < 2 || h < 2) return null;
    const clone = stage.cloneNode(true);
    mirrorInputs(stage, clone, caretOn);
    clone.setAttribute('style',
      (clone.getAttribute('style') || '') + ';width:' + w + 'px;height:' + h + 'px;');

    const body = new XMLSerializer().serializeToString(clone);
    const css = String(getCss()).replace(/\]\]>/g, ']]&gt;');
    const s = Math.min(scale, 2200 / Math.max(w, h));
    const token = ++inflight;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" data-n="' + token + '"' +
      ' width="' + Math.round(w * s) + '" height="' + Math.round(h * s) +
      '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' +
      '<style xmlns="http://www.w3.org/1999/xhtml"><![CDATA[' + css + ']]></style>' +
      body +
      '</foreignObject></svg>';

    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('raster timeout')), 5000);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('raster failed')); };
      img.src = url;
    });
    if (token !== inflight) return null;      // 더 새 요청이 들어왔으면 버린다
    if (img.decode) { try { await img.decode(); } catch (_) { /* 무시 */ } }
    return img;
  }

  return { render, escapeXml };
}
