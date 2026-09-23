# コードレビュー（2026-09-23）

対象: `src/**`, `index.html`, `src/styles/*.css`, `vite.config.ts`。基準は `docs/scroll-storyboard.md` §5–§7。
`npm run build` / `tsc --noEmit` は通過済みのため、型・スタイルは対象外。実ブラウザで壊れる／劣化する点のみ、確信のあるものを重大度順に挙げる。

## 確認済みで問題なしだった点（参考）

- **セクション間の tween 競合**: `sections.ts` の各 timeline は同じ `sceneState` を `fromTo` するが、ScrollTrigger は上スクロール時に trigger を**逆順**で update し（`ScrollTrigger.js` `_updateAll`: `_direction < 0` で `while (_i-- > 0)`）、refresh 時は全 trigger を 0 に戻してから作成順に `prevProgress` で再描画する。from 値が前セクションの to 値と一致している現在の設計なら、Home/End キーやハッシュジャンプで複数セクションを一度に跨いでも状態は壊れない（GSAP 3.15 で Node シミュレーション済み）。各セクションの from/to の連鎖（cam*, w0–w6, noise, accentMix, colorMix, rotX, breath, idleSpeed, pointSize, lineOpacity/lineDraw, knot/slabOpacity, tX/tY, fov, groupY）も全て整合している。
- GLSL: attribute 数は `position` + 9 個で上限 16 未満、`uniform float uW[7]` / `uClusterLit[4]` は Three の PureArrayUniform で正しく転送される。three r186 は WebGL2 必須のため fragment の `precision highp` も問題ない。
- ピン内の reveal トリガー: ScrollTrigger が pinned ancestor の `_pinOffset` を補正するため `pinnedContainer` なしでも start 位置は正しい。

## 指摘一覧

| # | 重大度 | ファイル:行 | 問題 | 修正案 |
|---|---|---|---|---|
| 1 | 高 | `src/styles/components.css:436-445`, `src/ui/header.ts:67,83`, `index.html:60` | `.menu { display: flex }` が UA スタイルの `[hidden] { display: none }` を上書きする（作者スタイルは UA スタイルより常に優先）。そのためモバイルで閉じているメニューも DOM 上は表示状態のまま（`clip-path: circle(0%)` + `opacity: 0` で見えないだけ）。結果、閉じたメニュー内の 6 リンクが Tab で到達可能（フォーカスが画面外に消える）、スクリーンリーダーにも読み上げられる。`openMenu` の `rAF` 待ちも `display` 切替を前提にしており、意図と実装がずれている。 | `.menu[hidden] { display: none; }` を追加（または `.menu:not(.is-open) { visibility: hidden }` で `visibility` 遷移に切替）。 |
| 2 | 高 | `src/ui/header.ts:37-54`, `index.html:34` | `document` の click 委譲が `a[href^="#"]` を全て捕まえて `preventDefault` するため、スキップリンク（`href="#main"`）を押しても**フォーカスが本文に移らない**（`#main` は `tabindex` もなく、ブラウザ既定の「フラグメントへフォーカス起点移動」も抑止される）。結果はヘッダー高分だけスクロールして 0 に丸められるだけで、スキップリンクが機能しない。ナビの「About」等も同様に、Enter 後の Tab がヘッダー内の次リンクへ行き、到達したセクションに入らない（WCAG 2.4.3）。 | `.skip-link` はハンドラから除外（`if (a.classList.contains('skip-link')) return;`）し `#main` に `tabindex="-1"`。セクションリンクは `smooth.scrollTo` の後に `target.setAttribute('tabindex','-1'); target.focus({ preventScroll: true })` を呼ぶ。 |
| 3 | 中 | `src/main.ts:21-27` | `webglcontextlost` は 1 回目を `preventDefault` して復帰待ちにするが、**`webglcontextrestored` が来なかった場合のタイムアウトが無い**。GPU リセット等で復帰しないと、真っ黒な canvas と（`renderer.render` が早期 return するだけの）rAF ループが残り続け、§5.4 の `.bg-fallback` にも切り替わらない。変数名 `restored` も「復帰した」ではなく「一度 lost した」を表しており誤解を招く。 | lost 時に `scene.stop()` + `setTimeout(disableWebGL, 3000)` を仕掛け、`webglcontextrestored` で `clearTimeout` して再開。2 回目の lost は即 `disableWebGL()`。 |
| 4 | 中 | `src/three/scene.ts:229-240` | 適応 DPR が `renderer.render()` の**JS 側所要時間**（`performance.now()` 差分）で判定している。GPU の描画は非同期なので、フィルレート律速（12k 点 × 2 パスの加算合成 @DPR2）でカクついても JS 時間は数 ms のままで、`avg > 22ms` は事実上成立しない。§7 の「直近 60 フレームの平均フレーム時間」と一致せず、機構が機能していない。 | フレーム間隔 `dt`（`now - last`、既に 0.1s でクランプ済み）の平均を使う。タブ非表示からの復帰直後は `frames/acc` をリセット。 |
| 5 | 中 | `src/three/scene.ts:112,116`, `src/three/shaders.ts:259,276` | グロー用 `glowMat` は `uGlow = 0.08` で**アルファだけ**を下げており、`gl_PointSize` は本体パスと同一。つまり「大きくて薄い点」ではなく「同じ大きさで 8% 明るい点」を全点もう一度描いているだけで、視覚効果はほぼ無いのに 12,167 点分のドローと overdraw を毎フレーム消費する（デスクトップのみ）。コメント（`>1 = glow pass (larger, dimmer)`）とも矛盾。 | `uniform float uGlowSize` を追加し `gl_PointSize *= uGlowSize`（3〜4 倍）、`smoothstep` の縁も広げる。効果が不要ならパス自体を削除して 1 ドロー減らす。 |
| 6 | 中 | `src/main.ts:11-13,73`, `src/scroll/sections.ts:60,184-189` | `isMobile / isTablet / isDesktop` を起動時に 1 回だけ評価し、`pinService / pinProcess / shift` が固定される。§5.5 は `gsap.matchMedia()` で境界を跨いだら `revert()` → 再構築とあるが未実装（`setupSections` が返す dispose 関数も未使用）。iPad の縦横回転（768 ↔ 1024px）や PC のウィンドウ幅変更で、CSS 側（`.pin-wrap` の `min-height`、`.card/.step { opacity: .6 }` は 1024px で切替）と JS 側（ピン有無、カード点灯 tween、`X_*` の shift）が食い違う。例: 縦→横で `.card` は CSS 0.6 のまま点灯 tween が無い／横→縦でピンなしのはずの Service が 240% ピンされ続ける。 | `gsap.matchMedia()` で 3 レンジに分け、各レンジで `setupSections` を実行し戻り値の dispose を cleanup に登録。`scene.isMobile` 系のパラメータも同じ場所で再評価。 |
| 7 | 中 | `src/three/state.ts:147-149`, `src/main.ts:68-69` | `REDUCED_STATE` が `lineOpacity: 0.15` を持つが、line index は初期の `lattice`（`(i, i+1)` ペア）のまま。ring 目標は `u = 2π·frac(i·0.618)` で隣接 index が 222° 離れるため、`knot 0.6 / ring 0.4` 合成上では 1,936 本の線分**全て**が長さ約 1.9（オブジェクト半径 ≒ 2.6×0.75）のランダムな弦になる（`buildTargets(DESKTOP)` で実測: 平均 1.94、`knot` index でも 2.01）。`works` の「線を消してから slab へ」と同じ問題が、reduced-motion の静止画で恒久的に出る。§5.3 に線の指定は無い。 | `REDUCED_STATE.lineOpacity = 0`。線を残すなら `w6: 0` + `scene.setLineMode('knot')` にする。 |
| 8 | 低 | `src/main.ts:110-113` | 幅が変わる `resize` イベントごとに**同期**で `ScrollTrigger.refresh()` を呼んでいる（デバウンスなし）。ウィンドウをドラッグ中は 1 イベントごとに全 trigger の revert/再計測/ピン再配置が走りレイアウトスラッシュになる。ScrollTrigger 自身も `resize` を 200ms デバウンスで自動 refresh し（タッチ端末では `ignoreMobileResize` が自動有効）、§7 の「150ms デバウンス」とも一致しない。 | このリスナーを削除する（自動 refresh に任せる）か、`scene` 側と同じ 150ms デバウンス内で `ScrollTrigger.refresh(true)`（safe = デバウンス）を呼ぶ。 |
| 9 | 低 | `src/main.ts:106` | `document.querySelector(location.hash)` に URL 由来の任意文字列を渡している。`#1`、`#/path`、`#a.b` のようなハッシュで着地すると `SyntaxError: not a valid selector` が `load` ハンドラ内で throw され、ハッシュ着地処理が中断する（`refresh()` 後なのでサイト自体は動く）。 | `document.getElementById(decodeURIComponent(hash.slice(1)))` に置き換える。`header.ts:49` は静的 href のみなので影響なし。 |
| 10 | 低 | `src/ui/header.ts:57-65`, `src/styles/components.css:378,437` | メニュー開時のフォーカストラップは `[menuBtn, ...menu内リンク]` のみ。ヘッダー（`z-index: 4`）はオーバーレイ（`z-index: 3`）より上に表示され続けるため、見えているワードマークと「相談する」CTA がマウスでは押せるのにキーボードでは到達不能（`inert` は `main` のみ）。 | トラップ対象を `header` + `menu` の可視フォーカス可能要素にする（`[header, menu].flatMap(...)`）か、開いている間はヘッダーの他要素に `inert` を付ける。 |
| 11 | 低 | `index.html:19` | `og:image` が相対 URL（`./og.png`）。Open Graph は絶対 URL 必須で、Facebook/X/Slack 等のスクレイパーは相対パスを解決しないため、シェア時に画像が出ない。 | 公開ドメインの絶対 URL（`https://.../og.png`）にする。`base: './'` 運用ならビルド時に環境変数で差し込む。 |

## 補足（指摘に含めなかった軽微な点）

- `hasWebGL()` が生成した WebGL コンテキストは破棄されず残る（ブラウザのコンテキスト上限 16 を 1 つ消費）。`getExtension('WEBGL_lose_context')?.loseContext()` で解放するとよい。
- `heroIntro()` の `'.wordmark'` セレクタはフッターの `.wordmark--sm` にも一致する（実害なし）。
- `TorusKnotGeometry(…, 220, 36)` は約 15.8k 三角形で §7 の「約 8k」の 2 倍。フレネル 1 パスなので実害は小さい。

---

## 対応記録（Frontend Developer, 2026-09-23）

| 指摘 | 対応 |
|---|---|
| メニュー閉時もリンクがタブ到達可能 | `.menu[hidden] { display: none }` を追加 |
| スキップリンクが機能しない | クリックハンドラから `.skip-link` を除外。`<main tabindex="-1">`。セクション遷移後は対象セクションに `tabindex="-1"` を付けて `focus({ preventScroll: true })` |
| コンテキスト喪失時にタイムアウトなし | 4 秒以内に `webglcontextrestored` が来なければ CSS フォールバックへ切替 |
| 適応 DPR が JS 時間しか見ていない | rAF のフレーム間隔（`dt`）で判定 |
| グロー層が同サイズ | `uSizeMul` を追加し、グロー層は 3 倍サイズ・8% alpha |
| ブレークポイント跨ぎで再構築されない | `gsap.matchMedia()` で desktop / tablet / mobile ごとにセクションタイムラインを構築・revert。点数と DPR は読み込み時固定（仕様） |
| reduced-motion の静止フレームで線が交差 | `REDUCED_STATE.lineOpacity = 0` |
| resize ごとに同期 refresh | 幅変化時のみ 200ms デバウンス |
| `querySelector(location.hash)` が例外 | `getElementById(hash.slice(1))` に変更（ヘッダー側も同様） |
| フォーカストラップにヘッダーの可視要素が含まれない | ワードマーク・CTA・メニューボタンを含める |
| `og:image` が相対 URL | 公開ドメイン確定後に絶対 URL へ差し替え（README に記載） |
