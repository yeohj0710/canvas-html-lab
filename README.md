# canvas html lab

캔버스 한 장 안에서 휘고 접히고 부서지는 판인데, 그 안의 버튼이 진짜로 눌리고
입력칸에는 키보드로 글자가 들어간다. 유튜브 "이게 진짜 HTML이라고?"(HTML in Canvas API)
를 보고, 그 아이디어를 아무 브라우저에서나 돌아가게 다시 짠 것.

빌드 단계가 없다. 정적 파일 그대로 올린다.

## 구조

| 파일 | 하는 일 |
| --- | --- |
| `src/gl.js` | WebGL 엔진. 격자 8만 6천 점, 셰이더 한 벌로 화면도 그리고 UV 도 뽑는다 |
| `src/raster.js` | 살아 있는 DOM 을 SVG foreignObject 로 감싸 이미지로 굽는다 |
| `src/surface.js` | 캔버스 하나를 만질 수 있는 판으로 묶는다. 포인터, hover, 포커스, 휠 |
| `src/stage-app.js` | 판 안에 들어가는 작은 앱의 마크업과 CSS |
| `src/main.js` | 페이지 배선. 효과 고르기, 코드 입력, 브라우저 경로 배지 |

## 돌아가는 방식

1. 판 DOM 은 캔버스 뒤에 `opacity: .0001` 로 진짜로 깔려 있다. 그래서 탭 키와 화면 낭독기가 잡는다.
2. 내용이 바뀔 때만 그 DOM 을 SVG 로 굽고 GPU 텍스처로 올린다. 휘는 애니메이션은 텍스처를 다시 굽지 않는다.
3. 포인터가 움직이면 같은 셰이더를 프레임버퍼에 한 번 더 그리되, 색 대신 원래 UV 를 16비트로 실어 칠한다.
   그 한 픽셀만 `readPixels` 로 읽으면 손끝이 DOM 의 어디를 짚었는지 나온다.
4. 그 자리의 요소를 `document.elementsFromPoint` 로 찾아 `data-cvh`(hover), `data-cva`(active) 를 붙이고,
   글자칸이면 `focus()` 를 준다. 그다음 키보드는 브라우저가 알아서 그 칸으로 보낸다.

`:hover` 는 캔버스 위에서 절대 안 걸리므로, CSS 를 올리기 전에
`:hover` → `:is(:hover,[data-cvh])` 로 바꿔 끼운다(`rewriteStateSelectors`).

## 함정 기록

- **UV 를 그리는 판에서는 블렌딩을 꺼야 한다.** 켜 두면 알파(=v 의 하위 바이트)가 RGB 를 곱해서
  좌표가 통째로 어긋난다. 되짚기가 전부 `null` 로 나오면 이것부터 본다.
- **`precision highp float` 만 적으면 int 정밀도가 안 맞는다.** 정점은 highp int, 프래그먼트는 mediump int
  가 기본이라 `uniform int uMode` 링크가 깨진다. 두 셰이더에 `precision mediump int;` 를 같이 적었다.
- **조각 번호는 정점 위치가 아니라 칸 중심으로 잘라야 한다.** 정점 기준으로 자르면 한 사각형의 네 귀퉁이가
  서로 다른 조각으로 날아가 삼각형이 늘어난다.
- **접기와 렌즈에 되짚은 좌표를 그대로 먹이면 스스로를 먹여서 각도가 튄다.** 판을 평평하다고 보고
  기울기만 역산한 `flatUV()` 를 셰이더에 넣고, 되짚은 값은 hover 와 클릭에만 쓴다.
- `PLANE_SCALE`(surface.js) 과 `.holder { inset }`(site.css) 은 `(1 - SCALE) / 2` 로 맞물린다. 하나만 고치면 클릭이 밀린다.

## 확인

```
npx --yes serve . -l 4321
```

Playwright 로 되짚기 정확도, 탭 누르기, 슬라이더 끌기, 글자 입력, 휠, 기울인 채로 누르기까지 재봤다.
평평할 때 오차 0.4px, 최대로 기울였을 때 4.5px.

## 배포

```
npx vercel --prod --yes
```
