# SD-cosmic-bright — 3D 実装仕様（Hero 惑星 / T0 saturn / T1 atom / 色再調整）

**作成**: Visual Storyteller
**対象**: Frontend Developer
**前提**: `docs/scroll-storyboard.md` のアーキテクチャ（永続ポイントクラウド 1 つ + 7 モーフターゲット、`src/three/targets.ts` / `scene.ts` / `shaders.ts` / `scroll/sections.ts` の平のステート scrub）は維持。本書はクライアント支給の 2D デザイン「SD-cosmic-bright」（参照 `d-00` … `d-07`）を 3D に翻訳するための **確定値** である。選択肢は置かない。

本書の記法は **作業ツリーで進行中の実装に合わせてある**: 惑星半径 `PLANET_R = 1.0`（環の帯は惑星半径比）、配置は `S.groupX / groupY / groupScale`、惑星の可視は `S.heroPlanet`、背景写真は `uPhoto / uPhotoMix / uPhotoDim / uPhotoOffset`、CSS トークンは `--bg --ink --muted --cyan --violet`。既に一致している値はそのまま、差分は **太字** で示す。

**確定済み（再議論しない）**
- 背景: `starfield.webp`（1672×941）を WebGL 背景シェーダーのベースレイヤーにする。`cosmic-hero.webp` は使わず、惑星は 3D で再構築。
- モーフ列: T0 `saturn`（Hero）→ T1 `atom`（About）→ T2 lattice → T3 grid → T4 knot → T5 slab → T6 ring（Contact）。T2–T5 は既存のまま、T6 は §5 で 30% を追加楕円に振る。
- ピン留めは全廃（Service は静的 2 カラム、Process はジグザグ・タイムライン）。
- パレット: bg `#102149` / text `#f4f7ff` / muted `#d3def3` / cyan `#9adfff` / violet `#ae9bff`。金・真鍮・アンバーは全廃。

**物語の読み替え**（storyboard §1 の意味は変えない）
- 点 → **環**（Hero）: 大きな惑星＝クライアントの核となる事業。周りを回る環の粒＝まだ形になっていない素材・可能性。
- 核 → **原子**（About）: 惑星が縮んで核になり、環は 3 本の軌道に束ねられる。「ひとつの中心（SD の哲学）と、その周りを一貫して回る手」。ひとつだけ明るいノード＝「いま手を動かしている工程」。
- 以降（格子 → 設計図 → 結び目 → 礎 → 輪）は既存どおり。

座標の約束: 数値は特記なき限り **`group` ローカル**（`BASE_SCALE 0.75 × S.groupScale` が掛かる前）。カメラのみワールド。画面換算は 1440×900 / fov 42 を基準（カメラ z 9.0 で z = 0 平面は約 130 px/unit）。

---

## 0. 進行中コードへの指摘（先に直す・4 件）

1. **`HALO_FRAG` が描画されない**: `side: BackSide` の `ShaderMaterial` では法線が反転されない（`FLIP_SIDED` は組み込みマテリアルのチャンクにしかない）。可視の裏面では `dot(n, v) ≤ 0` なので `pow(max(dot(n, v), 0.0), 3.0)` は常に 0。§1.3 の式に置き換える。
2. **`lv`（view-space の光方向）を計算しているのに `uLightDir` にはワールド値を入れている**（`void lv`）。`PLANET_FRAG` は view-space 前提なので、カメラが動く About 以降でリムがずれる。`uLightDir.copy(lv)` にする（§1.2）。
3. **T1 atom の 3 軌道が同一の楕円になっている**: 円を Y 回転してから z を 0.55 倍している。円は回転不変なので、回転後に同じ軸で潰すと 3 本とも同じ楕円に重なる。**先に潰してから Y 回転**する（§3.1）。
4. **環面の歳差**: T0 に傾きを焼き込んだまま `group` がアイドル回転すると環の傾き方向が回り続ける（`planetGroup.rotation.y = -(idleY+rotY)*0.6` の逆回転も 0.6 倍で不完全）。Hero は `idleSpeed 0` にし、環の「周回」は頂点シェーダーの `uSaturnSpin` で環の法線まわりに回す（§2.3）。`planetGroup` の逆回転は削除し、惑星の自転は `planetMesh.rotation.y = time * 0.04` のみ。

---

## 1. Hero コンポジション（惑星メッシュ）

参照 `d-00`: 画面右 73% × 上下 44% に惑星中心、左上からのシアンの光、右下（影側）がバイオレット、環は左下から手前に回り込み右で惑星の後ろに隠れる。見出しは左 58%（`.hero__inner`）。

### 1.1 配置と大きさ

| 項目 | 値 |
|---|---|
| `planetMesh` | `SphereGeometry(1.0, 96, 64)`（mobile `48, 32`）、`planetGroup` の子、位置 `(0,0,0)`。`renderOrder −2`, `depthWrite true`（環の後ろ半分を隠す） |
| `planetGroup.rotation` | **`(22°, 0, −12°)`, order `'ZXY'`**（環の傾きと同一。`SATURN_TILT = { x: 22, z: -12 }` を 1 か所で定義し、`uSaturnRot` と共有） |
| 自転 | `planetMesh.rotation.y = time * 0.04`（≈ 157 s / 周）。`rotation.z = -0.2` は削除（傾きは pivot が担う） |
| 配置 desktop | `HERO = { gx: 2.6, gy: 0.35, gs: 2.8 }`（現行 `3.0 / 0.1 / 2.5` → **2.6 / 0.35 / 2.8**）。実効半径 = 1.0 × 0.75 × 2.8 = **2.1 world** |
| カメラ desktop | `position (0, 1.1, 9.0)`, `lookAt (0, 0, 0)`, fov 42（現行どおり） |

投影の確認（1440×900）: 惑星中心 ≈ **(1058px, 405px)**、見かけ半径 ≈ **273px**（直径 61vh）。環の最外帯（§2.1 D）は中心から ≈ 660px → 右は画面外、左端は x ≈ 400px（リード文の右端に薄く重なる。`d-00` と同じ。§6.2 スクリムで担保）。

### 1.2 二色 Fresnel（`PLANET_FRAG`）

現行のシェーダー構成（`uBase / uBand / uRimLit / uRimDark / uLightDir / uTime`, `vP` で縞）を維持し、以下を確定値とする。

```glsl
vec3 n = normalize(vN);  vec3 v = normalize(vV);
vec3 L = normalize(uLightDir);                       // view space（毎フレーム lv を copy する）
float ndl = dot(n, L);
float lit = smoothstep(-0.35, 0.60, ndl);            // 0 = 影側, 1 = 光側
float lat = vP.y / length(vP);
float bands = noise1(lat * 9.0 + uTime * 0.02) * 0.6 + noise1(lat * 23.0 - uTime * 0.015) * 0.4;
vec3 body = mix(uBase, uBand, bands * 0.5) * (0.35 + 0.75 * lit);
body += uRimDark * pow(1.0 - lit, 2.0) * 0.10;        // 影側に薄い紫の散乱（追加）
float f = pow(1.0 - max(dot(n, v), 0.0), 2.4);
vec3 rim = mix(uRimDark, uRimLit, smoothstep(-0.2, 0.7, ndl));   // 影側リム紫 → 光側リム シアン
vec3 c = body + rim * f * (1.0 + 0.6 * lit);          // 光側ほどリムが強い（現行 1.6 定数 → 1.0–1.6）
gl_FragColor = vec4(c * uOpacity, uOpacity);
```

- 光方向（ワールド）`normalize(vec3(-0.6, 0.55, 0.7))`（現行どおり、左上・やや手前）。**view space へ変換した `lv` を `uLightDir` に入れる。**
- 色: `uBase #0b1a45`, `uBand #2a4a9a`, `uRimLit #9adfff`, `uRimDark #ae9bff`（現行どおり）。

### 1.3 大気ハロー（`HALO_FRAG`、`side: BackSide`, additive, `depthWrite false`）

```glsl
vec3 n = normalize(vN);  vec3 v = normalize(vV);
// 裏面: 惑星の縁（dot ≈ −0.42 at r = 1/1.16）で 1 → ハロー外縁（dot = 0）で 0
float g = pow(clamp(-dot(n, v) * 2.4, 0.0, 1.0), 1.5);
float ndl = dot(n, normalize(uLightDir));
vec3 c = mix(uColorDark, uColorLit, smoothstep(-0.3, 0.6, ndl));
float a = g * uOpacity;                                // uOpacity = 0.55 * S.heroPlanet
gl_FragColor = vec4(c * a, a);
```

- 半径 `1.16`（現行）、`uColorLit #9adfff`, `uColorDark #8f7cff`（現行）。`renderOrder −3`、`depthTest true`。

### 1.4 モバイル（< 768px, 390×844, fov 48）

- 惑星は **画面上部**、見出しは 52vh 以降（`.hero` は `padding-top 160px` の通常フロー）。
- `HERO = { gx: 0.3, gy: 2.0, gs: 1.5 }`（現行 `0.6 / 2.9 / 1.5` → **0.3 / 2.0**）。カメラ `(0, 1.1, 9.0)` / `lookAt (0,0,0)`。惑星中心 ≈ 上から **25%**（≈ 212px）、見かけ半径 ≈ 118px、上端 ≈ 94px（ヘッダー 76px と重ならない）。環は左右で切れてよい。
- 大気ハロー維持、グロー Points パスは従来どおり無効。視差なし。自転・環の周回は維持（「止まって見えない」）。

---

## 2. T0 `saturn` — 環（Hero）

惑星半径 `1.0`。**ターゲットは傾けずに XZ 平面で保存**し、傾き + 周回はシェーダーの `uSaturnRot`（mat3）で掛ける（§2.3、現行の焼き込みを外す）。

### 2.1 バンド構成（惑星半径比 / N に対する割合）

| 帯 | 内径 | 外径 | 割合 | `aGal`（色ランプ） | メモ |
|---|---|---|---|---|---|
| A（内環） | 1.30 | 1.55 | **34%** | 0.00–0.25 シアン→白 | 最も密・最も明るい |
| gap | 1.55 | 1.62 | — | | |
| B（主環） | 1.62 | 1.92 | **30%** | 0.25–0.55 白 | リングレット暗線あり |
| gap（Cassini） | 1.92 | 1.98 | — | | |
| C（外環） | 1.98 | 2.15 | **18%** | 0.55–0.80 白→バイオレット | |
| D（最外・薄） | 2.20 | 2.35 | **10%** | 0.80–1.00 バイオレット | alpha 0.6 |
| halo（遠景星） | 2.7 | 4.2 | **8%** | 1.00 | 球殻、縦に 1.4 倍 |

現行 `[1.35–1.62 .34] [1.68–1.96 .30] [2.02–2.16 .12] [2.22–2.42 .16]` + halo `i % 12` → **上表へ**（D を薄く、C を厚く、外縁を 2.35 に詰める）。デスクトップ点数: A 4,137 / B 3,650 / C 2,190 / D 1,217 / halo 973。

### 2.2 疑似コード（`targets.ts`、`mulberry32` 決定論）

```
bands = [ {r0:1.30, r1:1.55, g0:0.00, g1:0.25},
          {r0:1.62, r1:1.92, g0:0.25, g1:0.55},
          {r0:1.98, r1:2.15, g0:0.55, g1:0.80},
          {r0:2.20, r1:2.35, g0:0.80, g1:1.00} ]

for i in 0..N-1:
  m = i % 50                                 // インデックスで帯を固定（34/30/18/10/8 → 17/15/9/5/4）
  b = m < 17 ? 0 : m < 32 ? 1 : m < 41 ? 2 : m < 46 ? 3 : HALO

  if b == HALO:
    dir = randomUnitVector(rand);  r = 2.7 + 1.5 * rand()
    p = dir * r;  p.y *= 1.4;  g = 1.0
  else:
    band = bands[b]
    repeat u = rand() until not (fract(u * 6.0) < 0.10 and rand() < 0.6)   // リングレット暗線
    u = 0.5 + (u - 0.5) * 0.96
    r = mix(band.r0, band.r1, u);  a = rand() * 2π
    p = ( r * cos a,  gauss() * 0.012,  r * sin a )                       // 厚み σ 0.012（現行どおり）
    g = mix(band.g0, band.g1, u)

  cloud[i] = p            // 傾けない
  gal[i]   = g            // 0 = 内環, 1 = 最外 / halo
```

- `i % 50` の帯割り当てにより、T1 の核（`i % 16 == 0`）と統計的に独立で、モーフ中に帯が塊で動かない。
- 帯 A の面密度 ≈ 1 点 / 24 px²（1440×900）。`pointSize 2.2` + グローパス + ブルームで「明るい帯」として読める。

### 2.3 頂点シェーダー: 傾き・周回・影・色

```glsl
uniform mat3  uSaturnRot;   // CPU: Rz(-12°) · Rx(+22°) · Ry(uTime * 0.03)  → Matrix3 を毎フレーム
uniform vec3  uLightDir;    // group ローカル normalize(vec3(-0.6, 0.55, 0.7))
uniform float uPlanetR;     // 1.0（groupScale はモデル行列で掛かるので固定）

vec3 sat = uSaturnRot * aCloud;
vec3 target = sat * uW[0] + aSphere * uW[1] + aLattice * uW[2] + ... ;

// 惑星の影: 光源の反対側に伸びる円柱（T0 支配時のみ）
float along = dot(sat, uLightDir);
float perp  = length(sat - uLightDir * along);
float shadow = (along < 0.0) ? 1.0 - smoothstep(uPlanetR * 0.85, uPlanetR * 1.05, perp) : 0.0;
vAlpha *= 1.0 - 0.75 * shadow * uW[0];

// 色ランプ: シアン(内) → 白 → バイオレット(外)。uGalCore = #9adfff, uGalArm = #f4f7ff, uGalRim = #ae9bff
vec3 gcol = mix(uGalCore, uGalArm, smoothstep(0.0, 0.45, aGal));
gcol = mix(gcol, uGalRim, smoothstep(0.55, 1.0, aGal));
gcol *= 1.0 + 0.25 * (1.0 - smoothstep(0.0, 0.3, aGal));               // 内環を明るく
float dAlpha = 1.0 - 0.4 * step(0.8, aGal) * (1.0 - step(0.999, aGal)); // 帯 D は alpha 0.6
col = mix(col, gcol, uW[0]);
vAlpha *= mix(1.0, dAlpha, uW[0]);
```

- 現行 `uGalCore #f6fbff / uGalArm #9adfff / uGalRim #ae9bff`（内が白）→ **`#9adfff / #f4f7ff / #ae9bff`**（内がシアン）。
- 周回 `0.03 rad/s`（≈ 210 s / 周）。Hero は **`S.idleSpeed = 0`**、About 序盤で 0.04 へ戻す（§4）。
- `planetGroup.rotation` と `uSaturnRot` の傾きは同じ `SATURN_TILT` から作る。

---

## 3. T1 `atom` — 原子（About）

参照 `d-01`: 3 本の細い楕円軌道が 60° ずつ回転、中央に「SD」、右上に明るいノード 1 点。3D では中央を小さな核クラスタ、ノードは点 + `nodeMesh` の発光で表現する。

### 3.1 パラメータ（現行の構成を修正）

| 項目 | 値 |
|---|---|
| 楕円 | `R = 2.1`、**潰し 0.40**（現行 0.55 → 参照の見た目比 0.38 に寄せる）: `(R cos t, 0, 0.40 R sin t)` |
| 軌道回転 | **潰した後に** Y 回転 `k · 60°`（k = 0, 1, 2）（§0-3） |
| 共通傾き | X 回転 `68°`（現行どおり。正面から 22° 残す） |
| チューブ | 等方ガウス jitter `σ = 0.035`（現行） |
| 核 | `i % 16 == 0`（6.25%）: ガウス `σ = (0.18, 0.18, 0.14)`（現行 0.22 → 少し締める） |
| 軌道点 | 残り 93.75% を `k = i % 3` で 3 本に均等配分（各 ≈ 3,800 点） |
| パラメータ t | **`t = 2π · fract(i · 0.618034)`**（現行 `rand()` → 黄金比。周上均等で線が途切れない） |
| ノード | **`k == 1` かつ `fract(i·0.618034) ∈ [0.92, 0.95)`**（≈ 114 点）。`aRole.x = 1.0` |

```
atomPoint(k, t):
  p = (R * cos t, 0, 0.40 * R * sin t)      // 先に楕円
  p = rotateY(p, k * 60°)                   // 次に軌道ごとの回転
  p = rotateX(p, 68°)                       // 最後に共通傾き
  return p

for i in 0..N-1:
  if i % 16 == 0:
    p = (gauss()*0.18, gauss()*0.18, gauss()*0.14);  role = 0.5      // 核
  else:
    k = i % 3;  f = fract(i * 0.618034)
    p = atomPoint(k, 2π f) + gauss3() * 0.035
    role = (k == 1 && 0.92 <= f < 0.95) ? 1.0 : 0.0                 // ノード / 軌道
  sphere[i] = p;  role[i*2] = role
```

- 新属性 **`aRole: vec2`**（x = T1 の役割 0 軌道 / 0.5 核 / 1 ノード、y = T6 の薄い楕円フラグ §5）。12,167 × 2 × 4B ≈ 97 kB。
- `nodeMesh` の位置は同じ `atomPoint(1, 2π · 0.935)` から求める（ハードコードしない）。

### 3.2 シェーダー（T1 支配時の色・サイズ）

```glsl
float isNode = step(0.75, aRole.x), isCore = step(0.25, aRole.x) * (1.0 - isNode);
float w1 = uW[1];
vAlpha *= mix(1.0, 0.6 + 0.4 * isCore + 1.0 * isNode, w1);      // 軌道 0.6 / 核 1.0 / ノード 1.6
col = mix(col, vec3(1.0), w1 * isNode);                          // ノードは純白
gl_PointSize *= 1.0 + w1 * (0.8 * isNode - 0.15 * (1.0 - isCore - isNode));   // ノード ×1.8、軌道 ×0.85
```

- 軌道の色は `uColorA`（`#dce8ff`）+ `accentMix 0.2` のシアン。核は `uColorA × 1.15`。

### 3.3 配置（About）

DOM は `d-01` どおり: 見出し + `.about__space`（360×230px のプレースホルダ）が **左 col-6**、本文が右 col-5。原子は **`.about__space` の位置（左下）** に置く。

- desktop `AT = { gx: -2.8, gy: -1.35, gs: 0.8 }`（現行 `-2.2 / -1.0 / 0.95` → **-2.8 / -1.35 / 0.8**）。カメラ `(0, 0.4, 8.0)` / `lookAt (0,0,0)`（現行）。原子の見かけ幅 ≈ 370px、中心 ≈ (300px, 650px) — `.about__space` の中心（≈ 290, 660）に一致（local ≈ 0.4 で見出しが上 1/3 にあるとき）。
- mobile `AT = { gx: 0, gy: 1.6, gs: 0.8 }`（現行どおり。`.about__space` は `position: relative` の見出し直下）。
- `S.rotY` local 0→1 で 0 → 0.6（現行）、アイドル 0.04 rad/s。

### 3.4 `nodeMesh`

- `orbitMesh` と同じ `SphereGeometry(0.07)` + 発光 `SphereGeometry(0.16, additive)` のペアを `group` の子として追加。位置 `atomPoint(1, 2π·0.935)`。
- 新ステート `S.nodeOpacity`（本体 0.8、発光 0.12 を掛ける）。発光スケール `1 + 0.12 sin(time · 1.6)`。色 本体 `#ffffff` / 発光 `#9adfff`。

---

## 4. ハンドオフ（`sections.ts` の `seg(tl, start, end, from, to)` 形式）

追加ステート（`state.ts`）: `nodeOpacity: 0`。初期値: `idleSpeed: 0`、`pointSize: 2.2`、`noise: 0.02`（現行）、`accentMix: 0`。`HERO / AT` 定数は §1.1 / §3.3。

### 4.1 Hero（`sectionTimeline('hero')`）

```
seg(tl, 0,    1,    { camX:0, camY:1.1, camZ:9.0, groupX:HERO.gx, groupY:HERO.gy, pointSize:2.2 },
                    { camX:0.3, camY:1.5, camZ:8.4, groupX:HERO.gx - 1.2, groupY:HERO.gy - 0.15, pointSize:2.0 })   // 惑星は読者の方へ寄る
seg(tl, 0.55, 0.90, { heroPlanet:1, groupScale:HERO.gs },   { heroPlanet:0, groupScale:HERO.gs * 0.55 })  // 惑星が縮んで核へ
seg(tl, 0.70, 1,    { w0:1, w1:0, noise:0.02 },             { w0:0.55, w1:0.45, noise:0.08 })            // 環 → 軌道
tl.fromTo('#hero-inner', { y:0, opacity:1 }, { y:-80, opacity:0, duration:0.6, immediateRender:false }, EPS)
```
現行の「右上へ流す」`groupX + 0.6 / groupY + 0.8` は **廃止**（About の左下スロットへ向かう動線を作るため、Hero の尾で中央寄りに下ろす）。mobile は `groupX / groupY` を動かさない。

### 4.2 About（`sectionTimeline('about')`）

```
seg(tl, 0,    0.25, { w0:0.55, w1:0.45, noise:0.08, accentMix:0 },   { w0:0, w1:1, noise:0.01, accentMix:0.2 })
seg(tl, 0,    0.25, { camX:0.3, camY:1.5, camZ:8.4, groupX:HERO.gx - 1.2, groupY:HERO.gy - 0.15, groupScale:HERO.gs * 0.55 },
                    { camX:0, camY:0.4, camZ:8.0, groupX:AT.gx, groupY:AT.gy, groupScale:AT.gs })
seg(tl, 0,    0.30, { idleSpeed:0 },                                  { idleSpeed:0.04 })
seg(tl, 0,    1,    { rotY:0 },                                       { rotY:0.6 })
seg(tl, 0.15, 0.35, { nodeOpacity:0 },                                { nodeOpacity:1 })
seg(tl, 0.75, 0.95, { nodeOpacity:1 },                                { nodeOpacity:0 })
seg(tl, 0.80, 1,    { w1:1, w2:0, noise:0.01 },                       { w1:0.5, w2:0.5, noise:0.08 })   // 原子 → 格子
bg(tl, 0, 0.4, { '--bg-x':'50%', '--bg-y':'60%' }, { '--bg-x':'62%', '--bg-y':'45%' })
```

### 4.3 Service（ピンなし、現行どおり）

```
seg(tl, 0, 0.3, { w1:0.5, w2:0.5, lineOpacity:0, noise:0.08 }, { w1:0, w2:1, lineOpacity:0.3, noise:0.02 })
seg(tl, 0, 0.3, { ...from AT }, { camX:0.8, camY:1.0, camZ:8.0, groupX:SV.gx, groupY:SV.gy, groupScale:SV.gs })   // SV は現行値
```
テキストが読まれる区間（各セクション local 0.35–0.75）で形が安定している原則は維持。

---

## 5. Contact — 輪 + 2 本の薄い軌道楕円

**推奨: ポイント（T6 の一部）で実装し、CSS の `.contact-orbits` は削除する。** 理由: (1) 石板 → 輪のモーフで楕円も一緒に「ほどけて」現れ、別レイヤーの装飾のように唐突に出ない、(2) ブルーム・スクリム・アイドル回転・reduced-motion の扱いが輪と同一で二重管理にならない、(3) `d-07` の楕円は CTA の後ろを大きく横切る線で、写真背景の上ではキャンバスの点の方が馴染む。

T6 の割り当て（`i % 20`）:

| 範囲 | 割合 | 形状 | `aRole.y` |
|---|---|---|---|
| 0–13 | 70% | 既存トーラス `R 2.6, r 0.12`、X 傾き 18° | 0 |
| 14–16 | 15% | 楕円 E1 `a 3.6, b 1.45`, Z 回転 +24°, X 傾き 18°, jitter σ 0.04 | 1 |
| 17–19 | 15% | 楕円 E2 `a 4.3, b 1.25`, Z 回転 −18°, X 傾き 18°, jitter σ 0.04 | 1 |

シェーダー: `vAlpha *= mix(1.0, 0.30, uW[6] * aRole.y);`（薄い楕円は alpha 0.30、色は `uColorA`、アクセント混合なし）。`orbitMesh` の周回光は主輪上を従来どおり。カメラ・`groupY`・`groupScale 1.35` は現行値（E2 の半長軸 4.3 × 0.75 × 1.35 = 4.35 world は `camZ 6.8` の半幅 4.18 をわずかに超え、`d-07` と同じく左右で切れる）。

---

## 6. 色・明度の再調整（背景 `#102149`）

### 6.1 背景シェーダー（`background.ts`）

| 項目 | 現行 | **確定** |
|---|---|---|
| クリア色 / `uBg` | `#102149` | 同 |
| 写真 UV | cover + 0.92 縮小 + `uPhotoOffset` | 同（ClampToEdge で余白 8% あり） |
| ドリフト | `0.012 sin(t·0.05), 0.008 cos(t·0.04)` + マウス | 同 |
| `uPhotoDim` | 0.78 | **0.72** |
| 写真の色味 | なし | **`photo *= vec3(0.90, 0.95, 1.05)`**（青寄りに統一） |
| 輝度上限 | なし | **`col = min(col, vec3(0.62));`**（写真の明部が本文と競合しない保険） |
| 星雲 fbm | `× (1 − 0.6·uPhotoMix)` | **× (1 − 0.85·uPhotoMix)**（写真に星雲がある） |
| twinkle `uStars` | 1.0 | **0.7** |
| ビネット | `mix(0.6, 1.0, v)` | **`mix(0.72, 1.0, v)`** |
| 中心グロー `uBgC` | `#1a3466`, Works `#3a2a6e` | `#1a3466`, Works **`#2a2a66`**（紫リフトを弱める） |
| フェードイン | 到着で 1 に即時 | **0.8 s で 0 → 1**（`gsap.to(uniforms.uPhotoMix, ...)`） |

### 6.2 スクリム（CSS）

```css
.section--hero:before  { background: linear-gradient(90deg, rgba(16,33,73,.72) 0%, rgba(16,33,73,.45) 45%, transparent 70%),
                                     linear-gradient(0deg, var(--bg), transparent 28%); }   /* 現行 #12275640 → 上記 */
.scrim-l:before        { background: linear-gradient(90deg,  rgba(16,33,73,.80) 0%, rgba(16,33,73,.58) 45%, transparent 72%); }
.scrim-r:before        { background: linear-gradient(270deg, rgba(16,33,73,.80) 0%, rgba(16,33,73,.58) 45%, transparent 72%); }
.scrim-c:before        { background: radial-gradient(60% 55% at 50% 50%, rgba(16,33,73,.72) 0%, transparent 100%); }
```
- 使い分け: Hero 上記 / About `scrim-l`（本文が右にあるので **加えて右 col-5 の背後に `rgba(16,33,73,.55)` の面**） / Service `scrim-l` / Process 各ステップの面 `rgba(16,33,73,.62)` / Works カード面 `rgba(16,33,73,.72)` / Company `scrim-r` / Contact `scrim-c`。
- 受け入れ: テキスト直下の実効背景を **`#24376e` 以下**（`#f4f7ff` に 8:1 以上、`#d3def3` に 6:1 以上）。各セクション local 0.5 で静止させ、合成スクリーンショットで検証。

### 6.3 3D の色（`scene.ts COLORS` / uniform）

| トークン | 現行 | **確定** |
|---|---|---|
| `uColorA`（点の基本色） | `#dce8ff` | 同 |
| `COLORS.primary / secondary` | `#9adfff / #ae9bff` | 同（`colorMix` コメントを「cyan / violet」に修正） |
| `uGalCore / uGalArm / uGalRim`（T0 ランプ 内 / 中 / 外） | `#f6fbff / #9adfff / #ae9bff` | **`#9adfff / #f4f7ff / #ae9bff`** |
| `knotBase / knotRim` | `#1c2f66 / #ae9bff` | 同 |
| `slabBase / slabRim` | `#25407a / #e6f0ff` | **`#1c3068 / #dfe9ff`**（石板は少し沈める） |
| planet `uBase / uBand / uRimLit / uRimDark` | `#0b1a45 / #2a4a9a / #9adfff / #ae9bff` | 同 |
| halo `uColorLit / uColorDark` | `#9adfff / #8f7cff` | 同 |
| `orbitMesh` 本体 / 発光 | `#e8f6ff / #8ad8ff` | **`#ffffff / #9adfff`** |
| `nodeMesh` 本体 / 発光 | — | **`#ffffff / #9adfff`** |

### 6.4 グロー / ブルーム / グレード / フォグ

| 項目 | 現行 | **確定** | 理由 |
|---|---|---|---|
| `glowMat` alpha（desktop / mobile） | 0.06 / 0.12 | **0.045 / 0.09** | 明るい背景では乳白く濁る |
| `uFog` | 0.055 | **0.05** | 遠景ハロー星を残す |
| `UnrealBloomPass(strength, radius, threshold)` | 0.28 / 0.45 / 0.82 | 同 | 写真の明部をブルームさせない。点・惑星リム・ノードのみ |
| Grade `uGrain` | 0.03 | **0.02** | 写真の上ではノイズに見える |
| Grade `uVignette` | 0.14 | **0.10** | 背景側で既にビネット |
| Grade `uCA` | 0.0009 | 同 | |
| `pointSize`（Hero → About） | 2.6 → 2.0 | **2.2 → 2.0** | 環は細く高密度に |

---

## 7. 実装チェックリスト（Frontend Developer）

1. **§0 の 4 件を先に修正**: `HALO_FRAG` の式、`uLightDir` に `lv`、atom の潰し→回転の順序、Hero `idleSpeed 0` + `planetGroup` 逆回転の削除。
2. `targets.ts`: T0 を §2.2 に（帯半径・`i % 50` 割り当て・リングレット・**傾き焼き込みを外す**・`gal` を 0–1 の帯ランプに）。T1 を §3.1 に（潰し 0.40、黄金比 t、核 σ、ノード範囲）。新属性 `role: Float32Array(n*2)`。T6 に E1 / E2（§5）。ユニットテスト: 長さ・NaN 無し・帯ごとの点数 ±1%・ノード点数 ≈ 114（desktop）。
3. `shaders.ts`: `POINTS_VERT` に `uSaturnRot`, `uLightDir`, `uPlanetR`, `aRole` と、影・ランプ・T1 役割・T6 薄楕円の各項（§2.3, §3.2, §5）。`PLANET_FRAG` を §1.2、`HALO_FRAG` を §1.3 に。
4. `scene.ts`: `planetGroup.rotation = SATURN_TILT`（order `ZXY`）、`uSaturnRot` を毎フレーム `Matrix3` で更新（`Rz(-12°)·Rx(22°)·Ry(time·0.03)`）、`nodeMesh` 追加、`S.nodeOpacity` 適用、`orbitMesh` 色変更。
5. `state.ts`: `nodeOpacity: 0` 追加、`idleSpeed: 0`, `pointSize: 2.2`, `accentMix: 0`。`REDUCED_STATE` に `heroPlanet: 0` を明示。
6. `sections.ts`: `HERO = { 2.6, 0.35, 2.8 }`（mobile `{ 0.3, 2.0, 1.5 }`）、`AT = { -2.8, -1.35, 0.8 }`、Hero / About の `seg` を §4 どおりに置換。
7. `background.ts`: `uPhotoDim 0.72`、色味・輝度上限・fbm 減衰・`uStars 0.7`・ビネット 0.72・フェードイン（§6.1）。
8. `post.ts` / `scene.ts`: グロー 0.045 / 0.09、`uFog 0.05`、グレイン 0.02、ビネット 0.10（§6.4）。色を §6.3 に。`grep -n "f0c674\|e0a458\|2a1638\|8ad8ff"` で旧色が残っていないことを確認。
9. CSS: `.section--hero:before` と `scrim-*` を §6.2 に、About 右カラムの面を追加、`.contact-orbits` を削除。各セクション local 0.5 の合成スクリーンショットでコントラスト（本文 ≥ 8:1、muted ≥ 6:1）を PR に添付。
10. 受け入れ: 1440×900 で惑星中心 ≈ (1058, 405)px・半径 ≈ 273px、環が左下から手前に回り込み右で惑星に隠れ、影側の環が暗い（`d-00` と並べて確認）。About local 0.4 で原子が `.about__space` に重なり、ノードが右上で光る（`d-01`）。390×844 で惑星が上 25%、見出しが 52vh 以降。フレーム時間 desktop ≤ 6 ms / ミドル Android ≤ 10 ms（惑星 + ハロー + node で +3 ドローコール、上限 9 に更新）。`prefers-reduced-motion` で環の周回・自転を含む一切の変形が止まること。

---

**Visual Storyteller**: 環（Hero）→ 原子（About）で「大きな核の周りを回る粒が、ひとつの中心と三つの軌道に束ねられる」。以降は既存の物語（格子 → 設計図 → 結び目 → 礎 → 輪）に接続する。数値はすべて確定値。実機で微調整する場合は §1.1 の `HERO` と §2.1 の帯半径のみ触り、順序と意味は変えない。
