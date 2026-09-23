# 株式会社SD コーポレートサイト — スクロール・ストーリーボード

**作成**: UX Architect（構造・実装基盤） → Visual Storyteller（物語・演出）
**対象**: Frontend Developer（Vite + TypeScript / Three.js / GSAP ScrollTrigger / Lenis）
**前提**: 単一ページ、固定フルスクリーン WebGL キャンバス 1 枚の上を DOM セクションがスクロールする。3D はすべてプロシージャル生成（GLTF / HDR なし）。

---

> **v1.2 補記（2026-09-23）**: クライアント要望の「制作会社品質」パスで、§2.3 / §8-15 の「ポストプロセスなし」を改め、デスクトップのみブルーム＋グレード（グレイン・ビネット・微小な色収差）を許容。フレーム時間が DPR 1.0 でも 22ms を超える端末では自動で無効化する。モバイルは従来どおり直接描画。背景は CSS から WebGL のフルスクリーンシェーダーへ移行（CSS は WebGL 非対応時のフォールバック）。ヒーローは渦巻銀河＋遠景の環つき惑星、About は惑星本体、Contact は軌道上の光点を追加。

## 1. 体験コンセプト

> **「散らばった点が、対話を通してひとつの構造になり、やがて息づく形として立ち上がる」** — 3D オブジェクトは終始 *同じ 12,167 個の点* であり、その点の並び替えそのものが「Web制作」という仕事の比喩である。

- **点（Hero）** = クライアントの中にまだ形になっていない想い・素材・可能性。
- **核（About）** = SD の哲学。散らばった点が一度「中心」に集まる。
- **格子（Service）** = 企画・デザイン・開発・運用という 4 つの柱が、構造として点を整列させる。
- **設計図 → 結び目（Process）** = 平面の設計図が折り畳まれ、5 つの工程を経て立体的な結び目（トーラスノット）に編み上がる。
- **完成形（Works）** = 結び目の内側に、光を纏った滑らかな実体が現れる。「動き続ける完成品」。
- **礎（Company）** = 形が静かな一枚の石板（モノリス）に落ち着く。会社の輪郭・信頼。
- **輪（Contact）** = 石板がほどけて輪になり、CTA を囲む。「次はあなたの点を」。

物語構造: **序（点）→ 破（構造化の葛藤＝格子・設計図）→ 急（結び目・実体）→ 結（礎・輪）**。同一オブジェクトを通しで使うことで、「一貫した人間が最初から最後まで手を動かす小さなスタジオ」という SD の強みをそのまま体験に翻訳する。

---

## 2. 3D シーン設計

### 2.1 シーングラフ（永続オブジェクトは 1 グループのみ）

```
scene
├─ heroGroup (THREE.Group)            // idle 回転・呼吸・マウス視差はここに掛ける
│   ├─ points   : THREE.Points        // 12,167 点（mobile: 4,096）。全モーフの主役
│   ├─ lines    : THREE.LineSegments  // points と同じ attribute を共有。格子・結び目でのみ表示
│   ├─ knotMesh : THREE.Mesh          // TorusKnotGeometry + Fresnel shader。Works でのみ可視
│   └─ slabMesh : THREE.Mesh          // BoxGeometry + Fresnel shader。Company でのみ可視
└─ camera : PerspectiveCamera(fov 42, near 0.1, far 40)
```

- 背景（グラデーション / ビネット）は **CSS** で描画する（WebGL では `alpha: true`, `clearColor` 透過）。フォールバックと共通化でき、描画コストもゼロ。
- `scene.fog = new THREE.FogExp2(0x0b0d12, 0.055)` — 遠景の点を背景色に溶かし、奥行きを作る。

### 2.2 ジオメトリ: 1 つの BufferGeometry に 7 つのモーフターゲット

点数 `N = 12,167 = 23³`（デスクトップ）/ `N = 4,096 = 16³`（モバイル）。格子ターゲットが整数立方になるよう選ぶ。

各ターゲットは `Float32Array(N * 3)` の頂点属性として GPU に送り、**カスタム ShaderMaterial** の頂点シェーダで重み付き合成する（CPU 合成は禁止。1 フレーム 12k × 7 の再計算と `needsUpdate` が GC と帯域を圧迫する）。

```glsl
// vertex shader (points / lines 共通)
attribute vec3 aCloud, aSphere, aLattice, aGrid, aKnot, aSlab, aRing;
attribute float aSeed;            // 0..1 乱数。点ごとの位相ずらし・サイズ差に使う
attribute float aCluster;         // 0..3 Service の 4 象限 ID（lattice 上の位置で決定）
uniform float uW[7];              // 合計 1.0 に正規化済みの重み
uniform float uTime, uNoiseAmp, uPointSize, uDpr;
uniform vec3  uColorA, uColorB;   // ベース色 / アクセント色
uniform float uClusterLit[4];     // Service で象限を順番に点灯 0..1

vec3 target = aCloud*uW[0] + aSphere*uW[1] + aLattice*uW[2] + aGrid*uW[3]
            + aKnot*uW[4]  + aSlab*uW[5]   + aRing*uW[6];
// 遷移中だけ膨らむノイズ: 重みの「混ざり具合」が大きいほど点が散る
float mix_ = 1.0 - max(max(max(uW[0],uW[1]),max(uW[2],uW[3])),max(max(uW[4],uW[5]),uW[6]));
vec3 n = curlNoise(target * 0.6 + uTime * 0.05 + aSeed);   // 3-octave simplex ベース、インライン実装
vec3 pos = target + n * (uNoiseAmp + mix_ * 0.9);
// 呼吸（Works / Contact で uNoiseAmp と併用）
pos *= 1.0 + 0.012 * sin(uTime * 0.8 + aSeed * 6.2831);
```

`uW` は JS 側で「セクションごとの目標重み」に対して `gsap.to(weights, { ..., scrub })` し、毎フレーム合計で割って正規化してから送る。

#### モーフターゲット生成（疑似コード。すべて `src/three/targets/*.ts` に純関数で実装）

共通: `rand = mulberry32(seed)` の決定論的乱数。`i` は点インデックス。

**T0 `cloud` — 散らばった点（Hero）**
```
R = 5.5
for i in 0..N-1:
  u = rand(); r = R * cbrt(u)                 // 球内一様
  dir = randomUnitVector(rand)
  p = dir * r
  p += curlNoise(p * 0.35) * 1.2              // 塊（星雲）を作る
  if i % 7 == 0: p = dir * (6.0 + rand()*3.0) // 14% を外殻ハローに
  write(p)
```

**T1 `sphere` — 核（About）** Fibonacci 球
```
R = 2.3
for i: phi = acos(1 - 2*(i+0.5)/N); theta = PI*(1+sqrt(5))*i
  p = R * (sin(phi)cos(theta), sin(phi)sin(theta), cos(phi))
  p *= 1 + 0.03*(rand()-0.5)                  // 完全球を避ける 3% ジッター
```

**T2 `lattice` — 格子（Service）** 23³、x 方向が連続インデックスになる順序で埋める（線分描画のため）
```
S = 23; step = 0.22                            // 一辺 4.84
for i: x = i % S; y = floor(i / S) % S; z = floor(i / (S*S))
  p = ((x - 11), (y - 11), (z - 11)) * step
  aCluster[i] = (x < 11 ? 0 : 1) + (y < 11 ? 0 : 2)   // 4 象限
  edgeMaskLattice[i] = (x < S-1) ? 1 : 0        // 行末は線を引かない
```

**T3 `grid` — 設計図の平面（Process 前半）** 床面 XZ、わずかな起伏
```
cols = 111; rows = 110                          // 12,210 ≥ N。先頭 N 個を使う
for i: c = i % cols; r = floor(i / cols)
  p = ((c - 55) * 0.07, 0.08*sin(c*0.25)*cos(r*0.25), (r - 55) * 0.055)
```

**T4 `knot` — 結び目（Process 後半 → Works）** トーラスノット (p=2, q=3) のチューブ表面
```
P = 2; Q = 3; R = 1.7; r = 0.55; tube = 0.32; AROUND = 12
K = floor(N / AROUND)                            // 曲線方向の分割数
C(t) = ((R + r cos(Q t)) cos(P t), (R + r cos(Q t)) sin(P t), r sin(Q t))
for i: k = floor(i / AROUND); j = i % AROUND
  t = (k / K) * 2π
  T = normalize(C(t + 1e-3) - C(t)); Nv = normalize(cross(T, (0,1,0))); B = cross(T, Nv)
  a = (j / AROUND) * 2π + aSeed[i]*0.15
  p = C(t) + tube * (cos(a)*Nv + sin(a)*B)
```

**T5 `slab` — 石板（Company）** 1.6 × 3.4 × 0.4 の直方体表面。面積比で面を選び、8% をエッジ上に置いて輪郭を締める
```
size = (1.6, 3.4, 0.4); faces = 6 面、確率 ∝ 面積
for i:
  if i % 12 == 0: p = randomPointOnOneOf12Edges(size)
  else:           f = pickFaceByArea(rand); p = uniformOnFace(f, rand)
  p.y += 0.2                                      // 重心をやや上げ「立っている」印象
```

**T6 `ring` — 輪（Contact）** 大半径 2.6、小半径 0.12。カメラ側へ 18° 傾ける
```
Rr = 2.6; rr = 0.12
for i: u = 2π * fract(i * 0.618034); v = rand() * 2π
  p = ((Rr + rr cos v) cos u, rr sin v, (Rr + rr cos v) sin u)
  p = rotateX(p, radians(18))
```

#### 線分（`lines`）

- `points` と **同じ BufferAttribute インスタンスを共有**（別 BufferGeometry に同じ attribute を `setAttribute`）。位置は必ず点と一致する。
- インデックスは 2 セットを事前生成し、`geometry.setIndex()` で切替える。切替は必ず `uLineOpacity == 0` の間に行う。
  - `idxLattice`: `(i, i+1)` で `edgeMaskLattice[i] == 1` のもの。3 本に 1 本を間引き（約 4,000 セグメント）。
  - `idxKnot`: `(i, i + AROUND)` — 曲線に沿う線。2 本に 1 本を間引き（約 6,000 セグメント）。
- `LineBasicMaterial` ではなく同じ ShaderMaterial を流用（`uLineOpacity` を掛けるだけ）。線幅は 1px 固定（WebGL の制約。太線は使わない）。

### 2.3 マテリアル / ライティング

| 要素 | 仕様 |
|---|---|
| `points` | 加算合成 `THREE.AdditiveBlending`、`depthWrite:false`、`transparent:true`。フラグメントは `smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5))` のソフト円。基本サイズ `uPointSize = 2.2 * uDpr`、`aSeed` で 0.7–1.4 倍のばらつき。距離減衰 `gl_PointSize = size * (6.0 / -mvPosition.z)`。 |
| `lines` | 同シェーダ、`uLineOpacity` 0–0.35。加算合成。 |
| `knotMesh` | `TorusKnotGeometry(1.7, 0.42, 220, 36, 2, 3)`。Fresnel ShaderMaterial: `f = pow(1.0 - dot(normal, viewDir), 2.6)`; `color = mix(uBase(0x1a1f2b), uRim(0xe0a458), f)`; `alpha = 0.15 + 0.85*f`。`transparent:true`, `depthWrite:false`, 通常合成。ライトは使わない（Fresnel のみで陰影を作る）。 |
| `slabMesh` | `BoxGeometry(1.6, 3.4, 0.4)`、同 Fresnel、`uRim = 0xd9d4c7`（温白）、指数 3.2 でより硬質に。 |
| 「Bloom 風」 | ポストプロセスなし。`points` の加算合成 + 各点を 2 回描く（本体 + サイズ 3 倍・alpha 0.08 の「グロー層」= `points` を 2 つ目の Points として同 geometry で描画）。ドローコール +1 で済む。 |

**カラーパレット（3D 用）**

| トークン | 値 | 用途 |
|---|---|---|
| `--c-bg` | `#0B0D12` | 背景基調 / fog 色 |
| `--c-bg-2` | `#141822` | 背景グラデ中心 |
| `--c-point` | `#D9D4C7` | 点の基本色（温白） |
| `--c-accent` | `#E0A458` | アンバー。Works / CTA / 強調 |
| `--c-teal` | `#4FB3BF` | ティール。Service 象限点灯・線 |
| `--c-text` | `#E8E4DA` | 本文 |
| `--c-muted` | `#9AA0AA` | 補助テキスト |

点色は `uColorA`（基本）と `uColorB`（アクセント）を `aSeed` と `aCluster` で混合。セクションごとの `uColorB` は §3 の表に記す。

### 2.4 カメラパス

全セクションでカメラは **「ステート補間」** で動く。`camState = { px, py, pz, tx, ty, tz, fov }` を平のオブジェクトに持ち、各セクションの ScrollTrigger（`start: 'top bottom'`, `end: 'top top'`, `scrub: 0.8`, `ease: 'none'`）でそのセクションの目標値へ tween する。毎フレーム `camera.position.set(px+parallaxX, py+parallaxY, pz)`; `camera.lookAt(tx,ty,tz)`。

| セクション | position (x, y, z) | lookAt | fov | 意図 |
|---|---|---|---|---|
| Hero | (0.0, 0.2, 9.0) | (0, 0, 0) | 42 | 広く引いて星雲全体を見せる |
| About | (1.2, 0.6, 6.5) | (0, 0, 0) | 42 | 少し寄り、右斜めから核を見る |
| Service | (3.6, 1.4, 5.4) → セクション内で (−2.8, 1.0, 5.8) | (0, 0.2, 0) | 40 | 格子の周りを 70° オービット |
| Process | (0.0, 3.2, 6.0) → セクション内で (2.2, 1.0, 5.2) | (0, 0, 0) | 40 | 俯瞰で設計図を見て、結び目が立ち上がると水平に |
| Works | (0.0, 0.3, 4.6) | (0, 0, 0) | 38 | 最接近。実体の Fresnel を堪能 |
| Company | (−1.6, −0.8, 7.0) | (0, 0.6, 0) | 42 | ローアングル。石板が「立つ」 |
| Contact | (0.0, 0.4, 7.5) | (0, 0, 0) | 42 | 正面。輪が CTA を囲む |
| Footer | (0.0, 0.4, 8.5) | (0, 0, 0) | 42 | ゆっくり後退、点の透明度 0.25 へ |

Service / Process の「セクション内移動」は、そのセクション自体の scrub タイムライン（§3）にカメラ tween を含める。

### 2.5 背景グラデーション / ビネット（CSS）

```css
.bg {                      /* canvas の後ろ、position: fixed; inset: 0; z-index: 0 */
  background:
    radial-gradient(120% 90% at var(--bg-x, 50%) var(--bg-y, 60%), var(--c-bg-2) 0%, var(--c-bg) 62%),
    var(--c-bg);
}
.bg::after {               /* ビネット */
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(90% 90% at 50% 50%, transparent 55%, rgba(0,0,0,.42) 100%);
}
```

- `--bg-x / --bg-y` をセクションごとに変える（Hero 50%/60% → About 62%/45% → Service 40%/50% → Process 50%/70% → Works 50%/50% → Company 35%/55% → Contact 50%/50% → Footer 50%/100%）。`gsap.to(document.documentElement, { '--bg-x': ..., scrub: 1.2 })` で補間。
- 中心色 `--c-bg-2` は Works のみ `#1A1712`（アンバー寄りの暗色）へ滑らかに変える。

### 2.6 マウス視差とアイドルモーション（「止まって見えない」保証）

```ts
// 毎フレーム（rAF 内）
mouse.tx = (e.clientX / innerWidth  - 0.5);        // -0.5..0.5、pointermove で更新
mouse.ty = (e.clientY / innerHeight - 0.5);
mouse.x += (mouse.tx - mouse.x) * 0.05;             // ダンピング
mouse.y += (mouse.ty - mouse.y) * 0.05;
parallaxX =  mouse.x * 0.5;                          // カメラ位置に ±0.25 だけ加算
parallaxY = -mouse.y * 0.3;
heroGroup.rotation.y += 0.04 * dt;                   // 約 157 秒で 1 周
heroGroup.rotation.y += mouse.x * 0.06 * dt;         // マウス側へわずかに追従
heroGroup.scale.setScalar(1 + 0.015 * Math.sin(t * 0.8));   // 呼吸
uTime += dt;                                         // curl noise の揺らぎ
```

- 視差はタッチ端末では無効（`pointer: coarse` を判定）。代わりに `deviceorientation` は **使わない**（許可ダイアログと不安定さの割に価値が薄い）。
- Company の石板だけは `rotation.y` のアイドル回転を 0.01 rad/s に落とす（礎は動かない）。

---

## 3. セクション別ストーリーボード

### 3.0 全体構成

| 順 | セクション | 高さ | ピン | グローバル進行（目安） |
|---|---|---|---|---|
| 1 | Hero | 100vh | なし | 0.00–0.09 |
| 2 | About / Philosophy | 160vh | なし | 0.09–0.22 |
| 3 | Service | 240vh（うち 140vh ピン） | あり（desktop） | 0.22–0.41 |
| 4 | Process | 300vh（うち 220vh ピン） | あり（desktop） | 0.41–0.64 |
| 5 | Works | 160vh | なし | 0.64–0.78 |
| 6 | Company | 120vh | なし | 0.78–0.88 |
| 7 | Contact | 100vh | なし | 0.88–0.97 |
| 8 | Footer | auto（約 40vh） | なし | 0.97–1.00 |

- 実装は **グローバル進行度を使わない**。各セクションが自分の ScrollTrigger（`local 0→1`）を持ち、3D 状態はセクションごとの目標値への scrub tween で合成する。これにより高さ変更や CMS 追加に強い。
- 「モーフ遷移」は原則 **前セクションの終わり（local 0.75–1.0）から次セクションの始まり（local 0–0.35）** にまたがる。テキストが読める中央領域では形が安定していること。
- scrub は 3D 用 `0.8`、カメラ用 `0.8`、DOM 内ピン演出用 `0.6`、背景 CSS 変数用 `1.2` で統一。

**DOM 入場アニメーションの共通ルール**
- 見出し（日本語）は文字分割しない。`<span class="line">` で **行分割** し、`clip-path: inset(0 0 100% 0)` → `inset(0)` と `y: 28 → 0` を同時に。`duration 0.9`, `ease power3.out`, `stagger 0.08`。
- 本文・補助要素は `opacity 0→1`, `y: 16 → 0`, `duration 0.7`, `ease power2.out`, 見出し完了の `-=0.5` から。
- トリガー: `start: 'top 72%'`, `toggleActions: 'play none none reverse'`。時間ベースの自動再生はここまで（スクロール位置に紐付く「play / reverse」は許容）。
- ピン内の段階演出（Service カード、Process ステップ）は `scrub: 0.6` で完全にスクロール駆動。

---

### 3.1 Hero — 「点」

**感情のビート**: 静けさと期待。広い暗闇に、まだ意味を持たない粒子が漂う。

| 項目 | 仕様 |
|---|---|
| 3D 重み | `cloud 1.0`。local 0.75–1.0 で `sphere` へ 0→0.4（About へ受け渡し） |
| ノイズ | `uNoiseAmp 0.35`（最も揺らぐ） |
| 色 | `uColorA #D9D4C7`, `uColorB #4FB3BF`（10% の点だけティール） |
| カメラ | (0, 0.2, 9.0)。local 0→1 で z 9.0 → 7.6（前進感） |
| 点サイズ | 2.2 → 2.0 |
| DOM | ロード時のみ「初回入場」: ロゴ `opacity 0→1 0.6s power2.out` → 見出し行分割 3 行（`stagger 0.1`, `power3.out 1.0s`）→ リード文（`0.7s`, `-=0.5`）→ CTA 2 個（`stagger 0.08`）→ スクロールヒント（`1.2s delay`, 以降 `y: 0→8` を `sine.inOut 1.4s yoyo repeat` — 唯一のループ、ただし最初のスクロールで停止・非表示） |
| スクロール中 DOM | 見出しブロックを local 0→0.6 で `y 0 → -80`, `opacity 1 → 0`（scrub 0.8） |

見出し案: 「点を、かたちに。」/ 副題: 「企画からデザイン、実装、運用まで。ひとつの手で作る Web 制作スタジオ」（文言は Content Creator が確定）。

---

### 3.2 About / Philosophy — 「核」

**感情のビート**: 集中。散っていたものが引き寄せられ、ひとつの中心を持つ。

| 項目 | 仕様 |
|---|---|
| 3D 重み | local 0.0–0.35 で `cloud 0.6→0 / sphere 0.4→1.0`。local 0.8–1.0 で `lattice` 0→0.5 |
| ノイズ | `uNoiseAmp 0.35 → 0.08`（球が締まる） |
| 色 | `uColorB` ティール比率 10% → 25%。球表面の点だけわずかに明るく（`aSeed > 0.7` で輝度 +20%） |
| 回転 | `heroGroup.rotation.y` に local で +0.4 rad を加算（scrub） |
| カメラ | (1.2, 0.6, 6.5) へ |
| 背景 | `--bg-x 62%`, `--bg-y 45%` |
| DOM | 左 6 列に見出し（行分割）、右 5 列に本文 3 段落 + 3 つのキーワード（例: 「小さく、深く」「設計から運用まで」「動きは意味のために」）。キーワードは `stagger 0.12`, `x: -12 → 0`。区切り線 `scaleX 0→1 0.8s power3.inOut transform-origin: left` |
| スクリム | 左からのグラデーション（§6） |

---

### 3.3 Service — 「格子」（4 つのサブサービス）

**感情のビート**: 秩序と頼もしさ。柔らかな球が、明確な構造に組み変わる。4 つの柱が順に灯る。

**ピン構成（desktop）**: セクションを 140vh 分ピン。左に見出し + 4 カード縦積み、右側は 3D が見える空間（テキストは左 50% に収める）。

| local 進行 | 3D | カメラ | DOM |
|---|---|---|---|
| 0.00–0.30 | `sphere 0.5→0 / lattice 0.5→1.0`。`uLineOpacity 0→0.3`（`idxLattice`）。`uNoiseAmp 0.08→0.02` | (3.6, 1.4, 5.4) 到達 | 見出し入場（通常トリガー） |
| 0.30–0.45 | 象限 0 点灯 `uClusterLit[0] 0→1`（点色をティールへ、サイズ 1.3 倍） | 回転開始 | カード 1「企画・戦略」アクティブ（`opacity .35→1`, `x 0→12`, 左のインデックス線 `scaleY 0→1`） |
| 0.45–0.60 | 象限 1 点灯（象限 0 は 0.6 に減光） | オービット継続 | カード 2「デザイン」 |
| 0.60–0.75 | 象限 2 点灯 | | カード 3「フロントエンド開発（3D / モーション）」 |
| 0.75–0.90 | 象限 3 点灯 | (−2.8, 1.0, 5.8) 到達 | カード 4「公開後の運用・改善」 |
| 0.90–1.00 | 全象限 0.6 で均一。`grid` 0→0.4（Process へ） | | カード群は全て `opacity 1`。ピン解除 |

- 象限点灯は `gsap.timeline({ scrollTrigger: { pin: true, scrub: 0.6 } })` に `uClusterLit` の 4 tween を順に置く。
- ピン中の見出しには `position: sticky` を使わず、ScrollTrigger の `pin` に統一（Lenis と二重管理しない）。
- 各カードは `<a href="#contact">` ではなく `<article>`。クリック領域は作らない（サービス詳細ページはないため）。

---

### 3.4 Process — 「設計図から結び目へ」（5 ステップ）

**感情のビート**: 職人の手つき。平面の設計図が折られ、線が編まれ、立体になる。少しの緊張と、達成感。

**ピン構成（desktop）**: 220vh 分ピン。左 40% にステップリスト（番号 01–05 + 見出し + 2 行説明）、右 60% は 3D。ステップは 1 つだけがアクティブ（他は `opacity .3`）。

| local 進行 | ステップ | 3D | カメラ | DOM |
|---|---|---|---|---|
| 0.00–0.15 | — | `lattice 0.6→0 / grid 0.4→1.0`。`uLineOpacity 0.3→0`（インデックス切替 → `idxKnot`）。 | (0, 3.2, 6.0) 俯瞰へ | 見出し入場 |
| 0.15–0.32 | 01 ヒアリング・要件定義 | `grid 1.0` 安定。`uNoiseAmp 0.02`。点色 温白 | 俯瞰維持 | ステップ 01 アクティブ（`opacity .3→1`, 番号 `scale 0.9→1`, `power2.out`） |
| 0.32–0.49 | 02 情報設計・デザイン | `grid 1→0.55 / knot 0→0.45`（平面が持ち上がり始める）。`uNoiseAmp 0.02→0.18`（変形中の揺らぎ） | y 3.2 → 2.2 | ステップ 02 |
| 0.49–0.66 | 03 実装 | `knot 0.45→1.0`。`uLineOpacity 0→0.35`。線は `drawRange` を 0→100% で伸ばす（編まれていく） | (2.2, 1.0, 5.2) へ | ステップ 03 |
| 0.66–0.83 | 04 3D・モーション | `heroGroup.rotation.x` に +0.5 rad（scrub）。`uColorB` ティール→アンバー `#E0A458` へ 50% 混合 | 維持 | ステップ 04 |
| 0.83–1.00 | 05 公開・運用 | 呼吸振幅 0.012 → 0.03（「生きている」）。`uNoiseAmp 0.18→0.06` | 維持 | ステップ 05。最後に「完成へ →」の細い矢印が `x: 0→8` |

- 5 ステップは `timeline` 上で等間隔（各 0.17）に配置。ステップ切替の tween は `duration 0.35`（timeline 内の相対長）、`ease: 'none'`（scrub が補間する）。
- `drawRange` は `lines.geometry.setDrawRange(0, count * progress)` を `onUpdate` で直接叩く。

---

### 3.5 Works — 「完成形」（3 サンプルカード）

**感情のビート**: 高揚。編み上がった結び目の内側に、光を纏った実体が現れる。ここが物語のピーク。

| 項目 | 仕様 |
|---|---|
| 3D 重み | `knot 1.0`。local 0.85–1.0 で `slab` 0→0.5 |
| 実体 | `knotMesh.material.uniforms.uOpacity` local 0.0–0.3 で 0→1（Fresnel リム アンバー）。local 0.85–1.0 で 1→0 |
| 点 | 点サイズ 2.0 → 1.6、`uNoiseAmp 0.06`。点はハローとして実体を包む。`uColorB #E0A458` 混合率 60% |
| 線 | `uLineOpacity 0.35 → 0.15`（実体が主役） |
| カメラ | (0, 0.3, 4.6) 最接近。local 0→1 で lookAt.y 0 → 0.2 |
| 背景 | 中心色 `#1A1712`、`--bg-x 50% / --bg-y 50%` |
| DOM | 見出し + 3 カード（横並び 3 列、mobile 1 列）。各カードは 16:10 のプレースホルダ領域（**画像ではなく CSS グラデ + 案件名タイポ**。Works 詳細ページはなし）。入場: `stagger 0.12`, `y 32→0`, `opacity`, `rotateX 6deg→0`（`transform-perspective 1000px`）, `power3.out 0.9s`。ホバー: `translateY(-4px)`, 枠線 `--c-muted → --c-accent` 0.25s |
| スクリム | カード自身が `background: rgba(11,13,18,.72)` + `border 1px rgba(217,212,199,.12)` を持ち、3D の上でも可読 |

サンプル 3 件（内容は仮）: 「製造業コーポレート / リニューアル」「D2C ブランド / LP + EC 導線」「建築事務所 / 3D 表現を用いたポートフォリオ」。

---

### 3.6 Company — 「礎」（会社概要テーブル）

**感情のビート**: 落ち着き・信頼。動きが最小になり、静かな石板が立つ。

| 項目 | 仕様 |
|---|---|
| 3D 重み | local 0.0–0.3 で `knot 0.5→0 / slab 0.5→1.0`。local 0.85–1.0 で `ring` 0→0.5 |
| 実体 | `slabMesh` `uOpacity` local 0.15–0.4 で 0→0.8（温白リム）。local 0.85–1.0 で 0.8→0 |
| 点 | サイズ 1.6、`uNoiseAmp 0.02`（ほぼ静止）。`uColorB` 混合率 15% |
| 線 | `uLineOpacity 0.15 → 0` |
| 回転 | アイドル回転を 0.01 rad/s に減速（tween 1.0 相当） |
| カメラ | (−1.6, −0.8, 7.0), lookAt (0, 0.6, 0) ローアングル |
| 背景 | `--bg-x 35% / --bg-y 55%`、中心色を基調へ戻す |
| DOM | 右寄せ 6 列に `<table>`（社名 / 所在地 / 設立 / 代表 / 事業内容「Web制作事業」/ 連絡先）。行ごとに `opacity 0→1`, `x 12→0`, `stagger 0.06`, `power2.out 0.6s`。行の罫線は `scaleX 0→1` を同時に |
| スクリム | 右からのグラデーション（テーブル側） |

---

### 3.7 Contact — 「輪」

**感情のビート**: 開かれた招待。石板がほどけて輪になり、CTA を静かに囲む。

| 項目 | 仕様 |
|---|---|
| 3D 重み | local 0.0–0.3 で `slab 0.5→0 / ring 0.5→1.0` |
| 点 | サイズ 1.8、`uNoiseAmp 0.05`。呼吸振幅 0.02。`uColorB #E0A458` 混合率 30% |
| 回転 | `heroGroup.rotation.y` アイドル 0.04 rad/s に戻す。輪は画面中央、CTA ブロックの後ろに来るよう `heroGroup.position.y` を 0 → −0.3（scrub） |
| カメラ | (0, 0.4, 7.5) 正面 |
| DOM | 中央揃え: 見出し「まずは、点の状態でお聞かせください。」/ 補助文 / **主 CTA**（メールリンク `mailto:` または問い合わせフォームへのボタン、高さ 56px、アンバー塗り + 黒文字）/ 副 CTA（テキストリンク）。入場は見出し → 本文 → CTA（`stagger 0.1`）。CTA ホバー: `scale 1.02`, 発光 `box-shadow 0 0 24px rgba(224,164,88,.35)` 0.25s |
| スクリム | 中央楕円 `radial-gradient(60% 50% at 50% 50%, rgba(11,13,18,.7), transparent)` |

- フォームを置く場合は 4 項目以内（会社名 / お名前 / メール / 相談内容）。送信ボタンは主 CTA と同スタイル。ラベルは常に可視（プレースホルダ依存禁止）。

---

### 3.8 Footer — 「余韻」

| 項目 | 仕様 |
|---|---|
| 3D | `ring 1.0` 維持。`uOpacityGlobal` 1 → 0.25（local 0→0.6）。回転そのまま |
| カメラ | z 7.5 → 8.5 |
| 背景 | `--bg-y 100%`（光源が地平線へ沈む） |
| DOM | ロゴ小 / ナビ（アンカー）/ © 表記。入場は `opacity` のみ 0.6s |

---

## 4. モーション原則

1. **スクロールが唯一のタイムライン。** 3D の状態変化・カメラ・ピン内演出はすべて ScrollTrigger の scrub で駆動する。時間ベース再生は「ロード直後の Hero 入場」と「スクロール位置に紐付く play/reverse」のみ。自動再生カルーセル・無限ループ装飾は置かない（例外はアイドル回転・呼吸・Hero のスクロールヒントで、いずれも文脈を持つ）。
2. **動きは構造を語る。** モーフは常に「点 → 構造 → 実体 → 礎 → 輪」という意味の順序で起き、装飾のための変形はしない。テキストが読まれる区間（各セクション local 0.35–0.75）では形が安定していること。
3. **止まって見えない、けれど落ち着いている。** アイドル回転 0.04 rad/s、呼吸 1.2〜3%、マウス視差 ±0.25 単位。これ以上は増やさない。Company は意図的に「ほぼ静止」。
4. **60fps 予算を守る。** 3D の 1 フレーム描画は M1/RTX 級で ≤ 6ms、ミドルレンジ Android で ≤ 10ms。ドローコール ≤ 6。予算超過時は自動で DPR を落とす（§7）。
5. **Reduced motion と非 WebGL を一級市民として扱う。** `prefers-reduced-motion: reduce` では変形・視差・ピンを全廃しフェードのみに。WebGL 不可でも内容と CTA は完全に機能する。

---

## 5. レスポンシブ / フォールバック

### 5.1 ブレークポイント

| 名称 | 幅 | 扱い |
|---|---|---|
| `sm` | < 768px | モバイル。1 列、ピンなし、簡略カメラ |
| `md` | 768–1023px | タブレット。2 列、ピンあり（Process のみ）、点数 8,000 |
| `lg` | ≥ 1024px | デスクトップ。フル演出 |
| `xl` | ≥ 1440px | コンテナ上限 1280px、3D は同じ |

### 5.2 モバイル（`sm`）

- 点数 `N = 4,096 (16³)`、格子 `S = 16, step = 0.32`、knot `AROUND = 8`。線分は 3 本に 1 本。グロー層（2 回目の Points 描画）は無効。
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`。
- カメラ: Service のオービットを廃止して z 方向のドリーのみ（(0, 1.0, 6.4) → (0, 0.8, 5.8)）。Process の俯瞰は y 2.4 まで。fov は全セクション 48（縦長画面で形が切れないよう広角）。
- 3D オブジェクトは画面上部 55% に収まるよう `heroGroup.position.y += 0.6`（縦長画面では DOM が下側に来るため）。
- **ピンなし**。Service のカード 4 枚、Process のステップ 5 つは通常フローで縦に並び、各要素の入場は個別トリガー（`start: 'top 80%'`）。3D の段階変化（象限点灯・ステップ進行）は **セクション全体の local 進行** に等分割で割り当てる（挙動は同じ、ピンだけ外す）。
- Works カードは横スクロールにしない。1 列縦積み。
- `pointermove` 視差は無効。`touch-action: pan-y` を canvas に明示。
- Lenis は `syncTouch: false`（iOS のネイティブ慣性を尊重）。

### 5.3 `prefers-reduced-motion: reduce`

- Lenis を初期化しない（ネイティブスクロール）。ScrollTrigger の `pin` と `scrub` を全て無効化（`ScrollTrigger.config` ではなく、`matchMedia` で初期化分岐）。
- 3D は **静止した最終状態** を 1 度だけ描画: 重み `knot 0.6 / ring 0.4` の合成、`uNoiseAmp 0`、`knotMesh` `uOpacity 0.6`、カメラ (0, 0.3, 6.5)。以後 rAF を止める（リサイズ時のみ再描画）。
- DOM 入場は `opacity 0→1 0.3s ease` のみ（`y` / `clip-path` 移動なし）。
- Hero のスクロールヒントは表示するがアニメーションしない。
- CTA ホバーの `scale` は無効、色変化のみ。

### 5.4 WebGL 不可（`!renderer` / `webglcontextlost` / 検出失敗）

- `<canvas>` を DOM から除去し `<html data-webgl="0">` を立てる。
- `.bg` の CSS グラデーションはそのまま（§2.5）。加えて `.bg-fallback` に **静的 SVG のドット模様**（`radial-gradient` の繰り返し、300 個程度、`opacity .18`）を重ねる。画像ファイルは使わない。
- DOM 入場アニメーションは動作させてよい（GSAP は WebGL に依存しない）。ピンは維持。
- `webglcontextlost` は 1 回だけ復帰を試み（`preventDefault` + `webglcontextrestored` で再初期化）、失敗したら上記フォールバックへ。

### 5.5 ピン戦略まとめ

| 幅 | Service | Process |
|---|---|---|
| `lg` 以上 | pin 140vh | pin 220vh |
| `md` | pin なし | pin 180vh |
| `sm` | pin なし | pin なし |

`ScrollTrigger.matchMedia()`（gsap 3.12+ の `gsap.matchMedia()`）で分岐し、リサイズで境界を跨いだら `revert()` → 再構築。`pinType: 'transform'` を Lenis と併用（`pinType` はデフォルト自動判定で問題なし。`scrollerProxy` は Lenis 1.x では不要、`lenis.on('scroll', ScrollTrigger.update)` と `gsap.ticker.add(t => lenis.raf(t*1000))` で同期）。

---

## 6. UI 構造とナビゲーション

### 6.1 レイアウト基盤（CSS 変数）

```css
:root {
  --c-bg:#0B0D12; --c-bg-2:#141822; --c-text:#E8E4DA; --c-muted:#9AA0AA;
  --c-accent:#E0A458; --c-teal:#4FB3BF; --c-line:rgba(217,212,199,.14);
  --space-1:.25rem; --space-2:.5rem; --space-4:1rem; --space-6:1.5rem;
  --space-8:2rem; --space-12:3rem; --space-16:4rem; --space-24:6rem;
  --container:1280px; --gutter:16px; --header-h:64px;
  --font-ja:"Hiragino Sans","Noto Sans JP",system-ui,sans-serif;   /* 日本語 Web フォントは読み込まない */
  --font-display:"Inter Variable",var(--font-ja);                  /* 欧文数字・ラベル用、≤ 60kB woff2 1 本 */
  --ease-out:cubic-bezier(.22,1,.36,1);
}
@media (min-width:768px)  { :root { --gutter:32px; } }
@media (min-width:1024px) { :root { --gutter:48px; --header-h:72px; } }
```

- テーマは **ダーク固定**（ライトテーマ切替は置かない。3D の加算合成・スクリム設計がダーク前提であり、本サイトの表現価値を損なう。`color-scheme: dark` を宣言してフォーム等のネイティブ UI もダークに揃える）。
- `z-index` 階層: `.bg` 0 / `canvas` 1 / `main` 2 / `.section-indicator` 3 / `header` 4 / `.skip-link:focus` 5。
- 12 カラムグリッド（`grid-template-columns: repeat(12, 1fr); gap: var(--space-6)`）。テキストブロックは常に **6 列以内**、3D の可視領域を残す。

### 6.2 スティッキーヘッダー

- `position: fixed; top: 0`。初期状態は完全透明（ロゴ + ナビのみ）。
- スクロール 80px 超で `.is-scrolled`: 背景 `rgba(11,13,18,.85)`、下線 `1px var(--c-line)`。`backdrop-filter` は **使わない**（WebGL キャンバスの上では GPU 負荷が大きい）。
- 下スクロール中は `translateY(-100%)`（`0.35s power2.out`）で隠し、上スクロールで再表示。Hero 内では常に表示。
- 内容: 左 ロゴ（`<a href="#top">`）/ 中央〜右 ナビ 6 リンク（About / Service / Process / Works / Company / Contact）/ 右端 主 CTA「お問い合わせ」（アンバー枠線ボタン、`sm` では非表示にせずアイコン + 短縮ラベル「相談する」）。
- `sm`: ナビはハンバーガー → 全画面オーバーレイ（`opacity + clip-path circle`, 0.45s）。開いている間は `lenis.stop()`、`inert` を `main` に付与、ESC で閉じる、フォーカストラップ。

### 6.3 セクションインジケーター

- `lg` 以上のみ、右端に縦のドット 7 個 + 現在セクション名（ホバーで表示）。`aria-hidden="true"`（アクセシブルなナビはヘッダー側）。
- 各セクションの ScrollTrigger `onToggle` で `data-active` を更新し、同時にヘッダーの該当リンクに `aria-current="location"` を付ける。
- ドットは `<button>` で、クリックで `lenis.scrollTo('#id', { offset: -headerH, duration: 1.2, easing: expo.out })`。

### 6.4 アンカーリンク

- すべてのセクションに安定した `id`（`#about #service #process #works #company #contact`）。
- `lenis.scrollTo` を使い、`prefers-reduced-motion` 時は `immediate: true`。
- 直接 URL ハッシュで着地した場合: 初回 `ScrollTrigger.refresh()` の後に該当位置へジャンプし、3D は **その位置のセクション重みを即時適用**（tween せず `progress()` をセット）。

### 6.5 CTA 配置

1. ヘッダー右端（常時）
2. Hero: 主「相談する」（アンバー塗り）+ 副「Works を見る」（テキスト + 矢印）
3. Service 末尾: 「この 4 つを、ひとつのチームで。→ 相談する」（テキストリンク）
4. Contact: 主 CTA（最大サイズ）
5. Footer: メールアドレス直書き

### 6.6 フォーカス / キーボード

- `.skip-link`（「本文へスキップ」）を `body` 先頭に。フォーカス時のみ表示。
- `:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 3px; }` を全インタラクティブ要素に。カードのホバー効果はフォーカスでも発火。
- `<canvas aria-hidden="true" tabindex="-1">`。3D の意味は本文が担う。
- Tab でフォーカスした要素がピン領域の内側にある場合、ブラウザの `scrollIntoView` と ScrollTrigger の pin がずれる。ピン内の要素（Service カード、Process ステップ）は **フォーカス可能にしない**（リンクを置かない）ことで回避。
- Lenis 使用時も Space / PageDown / Home / End / 矢印キーのネイティブ挙動は維持されることを確認（Lenis 1.x は `wheel`/`touch` のみ介入）。
- ヘッダーの「隠す」挙動はフォーカスがヘッダー内にある間は無効。

### 6.7 キャンバス上のテキストのコントラスト（必須要件）

- 本文 `#E8E4DA` / 背景 `#0B0D12` = 約 15.6:1、補助 `#9AA0AA` = 約 7.0:1（AA/AAA 適合）。
- ただし点の加算合成が重なると背景が局所的に明るくなる。**テキスト領域の実効背景輝度を `#2A2F3A` 以下に抑える** ためスクリムを必ず敷く:

```css
.scrim-l { background: linear-gradient(90deg, rgba(11,13,18,.78) 0%, rgba(11,13,18,.55) 45%, transparent 75%); }
.scrim-r { background: linear-gradient(270deg, rgba(11,13,18,.78) 0%, rgba(11,13,18,.55) 45%, transparent 75%); }
.scrim-c { background: radial-gradient(60% 50% at 50% 50%, rgba(11,13,18,.7) 0%, transparent 100%); }
```

- 使い分け: About `scrim-l` / Service `scrim-l` / Process `scrim-l` / Works（カード自身が背景を持つ）/ Company `scrim-r` / Contact `scrim-c` / Hero `scrim-c`（弱め `.5`）。
- 最小フォントサイズ 14px（`--c-muted` は 16px 以上）。行長 全角 38 字以内。
- 受け入れ基準: 各セクションを local 0.5 で静止させ、テキスト直下のキャンバスを含む合成結果でコントラスト 4.5:1 以上（DevTools のスクリーンショット + コントラストチェッカーで検証）。

---

## 7. パフォーマンス予算

| 指標 | 予算 |
|---|---|
| 初期 JS（gzip） | **≤ 230 kB** 合計（three ≈ 140 kB tree-shaken / gsap + ScrollTrigger ≈ 32 kB / lenis ≈ 6 kB / app ≤ 40 kB）。`three/examples` は import しない |
| CSS（gzip） | ≤ 25 kB |
| フォント | 欧文 variable 1 本 ≤ 60 kB、`font-display: swap`。日本語 Web フォントなし |
| 画像 | Hero / Works に画像なし。ロゴは inline SVG |
| LCP | ≤ 2.0s（4G）。LCP 要素は Hero 見出しテキスト。canvas は LCP 対象外にするため初回描画を `requestIdleCallback` 後に |
| CLS | 0（ピン高さは CSS で先に確保） |
| ドローコール | ≤ 6（points 本体 / points グロー / lines / knotMesh / slabMesh。同時可視は最大 4） |
| 頂点数 | desktop 12,167 点 + 最大 6,000 線分 + knot mesh 約 8k 三角形 / mobile 4,096 点 + 2,000 線分 |
| DPR | desktop `min(dpr, 2)` / mobile `min(dpr, 1.5)` |
| フレーム時間（3D） | ≤ 6ms（高性能）/ ≤ 10ms（ミドル Android）。`renderer.info.render.calls` を dev オーバーレイで表示 |
| メモリ | GPU バッファ 7 ターゲット × 12,167 × 12B ≈ 1.0 MB。問題なし |

**描画ループの制御**
- `document.hidden` で rAF 停止、復帰で再開。
- `prefers-reduced-motion` は初回 1 描画で停止（§5.3）。
- **適応 DPR**: 直近 60 フレームの平均が 22ms を超えたら DPR を 0.25 刻みで下げる（下限 1.0）。18ms 未満が 180 フレーム続いたら 0.25 戻す（上限は初期値）。
- Footer 到達（`uOpacityGlobal < 0.3`）時は 30fps に間引く（`dt` 累積で 2 フレームに 1 回描画）。
- ScrollTrigger の `onUpdate` 内で `renderer.render` を呼ばない。描画は rAF 1 箇所のみ。
- リサイズは 150ms デバウンス → `renderer.setSize` → `ScrollTrigger.refresh()`。モバイルのアドレスバー伸縮による高さ変化は無視（`innerWidth` 変化時のみ refresh）。

---

## 8. 実装チームへの申し送り（優先順）

1. **基盤**: Vite + TS の骨組み、`src/three/`（`scene.ts`, `targets/*.ts`, `materials/*.glsl.ts`）、`src/scroll/`（`lenis.ts`, `sections/*.ts`）、`src/styles/`（`tokens.css`, `layout.css`, `components.css`, `sections.css`）に分割。CSS 変数は §6.1 のトークンから開始。
2. **7 モーフターゲットの生成関数**を純関数として実装し、決定論的乱数（`mulberry32`）で同じ `N` なら同じ結果になるようにする。単体テストで長さと NaN 無しを検証。
3. **共有 BufferAttribute + カスタム ShaderMaterial** で Points / LineSegments を構築。`uW[7]` を毎フレーム正規化して送る。線のインデックス 2 セットと切替関数（`setLineMode('lattice' | 'knot')`）。
4. **Lenis + ScrollTrigger の同期**（`lenis.on('scroll', ScrollTrigger.update)`、`gsap.ticker` 駆動、`lagSmoothing(0)`）。`gsap.matchMedia()` で `sm / md / lg` と `reduced-motion` の 4 分岐を最初から用意する。
5. **セクションごとの ScrollTrigger**（§3 の local 進行表を 1:1 で timeline に翻訳）。3D 状態は `sceneState` という単一の平のオブジェクトに集約し、tween はそのオブジェクトの数値だけを触る。
6. **カメラステート補間**（§2.4）とマウス視差・アイドル回転・呼吸（§2.6）。
7. **Fresnel マテリアル**の knotMesh / slabMesh と、Works / Company での不透明度制御。
8. **CSS 背景 + ビネット + スクリム**（§2.5 / §6.7）。テキストコントラストの検証スクリーンショットを PR に添付。
9. **DOM 入場アニメーション**の共通ユーティリティ（`revealLines(el)`, `revealBlock(el)`）を 1 箇所に置き、各セクションはそれを呼ぶだけにする。
10. **ヘッダー**（透明 → 塗り、隠れる / 現れる、`aria-current`、モバイルメニューのフォーカストラップと `inert`）。
11. **セクションインジケーター**と `lenis.scrollTo` によるアンカー遷移、ハッシュ着地時の即時状態適用。
12. **フォールバック 3 種**: reduced-motion 静止描画、WebGL 不可の `data-webgl="0"` + SVG ドット、`webglcontextlost` 復帰。
13. **パフォーマンス計装**: dev 限定のオーバーレイ（fps / frame ms / draw calls / DPR）、適応 DPR、`document.hidden` 停止、Footer 30fps 間引き。
14. **受け入れテスト**: Lighthouse（Performance ≥ 90 / Accessibility 100）、iPhone 12 相当 Safari と Pixel 6 相当 Chrome で 3D フレーム時間、キーボードのみで全 CTA に到達できること、`prefers-reduced-motion` でスクロール中に一切の変形が起きないこと。
15. **禁止事項の確認**: GLTF / HDR / 画像テクスチャの読み込みなし、`three/examples/jsm/postprocessing` の import なし、`backdrop-filter` なし、自動再生カルーセルなし、日本語 Web フォントなし。

---

**UX Architect**: 実装判断が要らないように、数値・順序・分岐条件を確定した。
**Visual Storyteller**: 点 → 核 → 格子 → 設計図 → 結び目 → 実体 → 礎 → 輪。ひとつのオブジェクトが最後まで同じ点で語り切る。
**Next**: Frontend Developer が §8 の順に着手。§3 の数値は実機で見た上での微調整を歓迎するが、順序と意味は変えない。
