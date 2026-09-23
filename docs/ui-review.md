# UI Finish Gate — 株式会社SD コーポレートサイト

**レビュー**: UI Finish-Gate Reviewer
**対象ビルド**: `index.html` / `src/styles/*.css` / `src/scroll/sections.ts` / `src/three/scene.ts`
**証拠**: `scratchpad/shots/1440x900-00..12.png`（デスクトップ）, `scratchpad/shots-m/390x844-00..10.png`（モバイル、1ビルド前。差分は3Dスケール0.75とカメラ距離のみ、レイアウト同一）
**注記**: ヘッドレス環境で Google Fonts が読めていないため、書体そのものは判定対象外。
**契約**: `docs/brand-brief.md`（ブランドの正）, `docs/scroll-storyboard.md`（3D・モーション・レイアウト・コントラスト要件）

---

## 0. プロダクト・レンズ（何を見るか）

- **ユーザーと仕事**: 自社サイトを「ちゃんと」つくりたい中小企業・スタートアップ・事業部門の担当者が、SDが何をどう作る会社かを理解し、「相談する」まで到達する。
- **最初に読まれるべきもの**: タグライン「構造が、動き出す。」と、その意味を体現する3D（点 → 構造 → 実体）。
- **主アクション**: `相談する`（ヒーロー／ヘッダー／Service末尾／Contact）。
- **密度**: 疎。暗い背景が主役、発光は「点と線」に限る（brief §3.1 運用ルール）。
- **禁止される既定値**: 3枚カードグリッド、番号だけのプレースホルダ、光る大面積オブジェクト、意味のないスクロール余白、読めない「非アクティブ」テキスト。

---

## 1. 判定

### HOLD

理由: ページの骨格（タグライン主導のヒーロー、1つの点群が7つの形に変わる物語、番号付きリストで語る Service / Process、装飾のない会社概要テーブル、コーラルをCTAだけに使う色の規律）は明確にこのプロダクトのものであり、書き直す必要はない。しかし、**モバイルで Service カード4枚・Process ステップが「非アクティブ状態（opacity 0.3〜0.35）」のまま画面内に並び、事業内容そのものが読めない**（`390x844-03.png`, `-05.png`）。これは storyboard §6.7 の必須要件（テキスト直下で 4.5:1）に対する明確な違反で、サイトの中核情報が欠落するのと同じである。加えて Works → Company の遷移で **真鍮色の結び目メッシュが1画面分を占め、テキストのないビューポートが約900px続く**（`1440x900-09.png`）。brief §3.1「発光色は画面全体の5%以下」と §6「副発光は10%以下」に反し、ページで最も「他社のWebGLデモ」に見える瞬間を作っている。この2件が解消され、下記 Major の About/Service の3D重なり・モバイルの空白・フッターの空洞が観測可能に直るまで出荷しない。

---

## 2. 所見（重大度順）

凡例: **C** = Critical（出荷停止）, **M** = Major（PASS前に必須）, **m** = Minor（推奨。PASSは阻まない）

| # | 重大度 | 画面 / 証拠 | 何が汎用的・破綻しているか | 観測可能な変更 | 検証条件 | 根拠 |
|---|---|---|---|---|---|---|
| 1 | **C** | モバイル Service / Process<br>`390x844-03.png`, `-04.png`, `-05.png` | ピンなしのモバイルでもカード／ステップの点灯がセクション進行（`0.3 + i×0.15` / `0.15 + i×0.17`）に scrub されるため、画面内にあるカード4枚すべて、ステップ5つのうち4つが opacity 0.35 / 0.3 のまま。見出し `#F2F4F7`@0.3 ≈ 2.4:1、説明 `#9AA3B2`@0.3 ≈ 1.5:1。事業内容と工程が読めない。 | `sections.ts`: `pinService / pinProcess` が false のとき、`.card` / `.step` の opacity tween を timeline に置かない。代わりに要素ごとの reveal（`start: 'top 80%'`, `toggleActions: 'play none none reverse'`）で opacity 1 に入場させ、`--bar` の点灯だけをセクション進行に残す。CSS の初期値 `.card{opacity:.35}` `.step{opacity:.3}` は `@media (min-width:1024px)` に限定する。 | 390×844 でセクションを100pxずつスクロールし、上端がビューポート80%より上にあるカード／ステップは常に opacity 1。`-03.png` 相当のフレームで4枚とも白文字。合成コントラスト ≥ 4.5:1。 | storyboard §5.2「各要素の入場は個別トリガー」, §6.7 受け入れ基準 |
| 2 | **C** | Works → Company 遷移（デスクトップ）<br>`1440x900-09.png` | Works local 0.85 まで `knotOpacity: 1`、カメラ z 5.2 で結び目メッシュが幅の約60%を真鍮色で占め、その間 DOM テキストがゼロ（Works 150vh + Company 120vh、いずれも中央寄せで上下に約450pxずつ空く）。brief の「暗さが主役」「副発光は節点だけ」に反し、ページ内で唯一「汎用WebGLショーリール」の絵になる。モバイルでも同様（`390x844-07.png` 下半分）。 | (a) `sections.ts` Works: `knotOpacity` の到達値を 1 → **0.55**、フェードアウトを local **0.6–0.8** に前倒し（カードが画面内にある間に実体が現れて消える）。(b) Works のカメラ `camZ: 5.2` → **6.2**（実体がカード列の背後に収まる）。(c) `sections.css`: `.section--works{min-height:120vh}`, `.section--company{min-height:100vh; align-items:start; padding-top:22vh}`。 | 1440×900 で Works local 0.5 のフレーム: 3枚のカードが全て見え、真鍮色（`#D4A65A` 系）のピクセル面積が画面の 10% 以下。Works カード下端から Company テーブル1行目までのスクロール中、テキストが一切ないビューポートが **50vh（450px）を超えない**。 | brief §3.1 運用ルール（5%）, §6-2（10%）, §6-4「密度は疎」; storyboard §4-2「テキストが読まれる区間で形が安定」 |
| 3 | **M** | Service / Process ピン（デスクトップ）<br>`1440x900-03.png`, `-06.png`, `-07.png` | ピン開始フレーム（`-03`）でカード4枚が全て 0.35 の灰色。非アクティブ opacity 0.3 は見出しで約 2.4:1、説明文で約 1.5:1 と、大きな文字の 3:1 にも届かない。「1つだけ光る」意図は正しいが、storyboard 自身の §6.7 と矛盾しており、§6.7（受け入れ基準）が優先。 | 非アクティブを **opacity 0.6** に（見出し `#F2F4F7`@0.6 ≈ 6.7:1、説明文 ≈ 3.4:1 で「次に読むもの」として許容）。Service はカード1の点灯位置を `s = 0.3` → **0.05** にし、ピン開始時に必ず1枚が読める状態にする。Process も同様に step 01 を `0.15` → `0.05`。 | 1440×900 で Service local 0.02 / Process local 0.02 のスクリーンショットに、白文字の項目が1つ以上ある。非アクティブ項目の見出しが合成で ≥ 4.5:1。 | storyboard §6.7, §3.3 / §3.4（意図は維持） |
| 4 | **M** | About（デスクトップ）<br>`1440x900-01.png` | 本文3段落（右 col 8–12）が球体の点群の真上に置かれ、スクリムは左（`scrim-l`）にしかない。見出し側は空、本文側だけ3Dと競合しており、storyboard §6.7「テキスト領域の実効背景を `#2A2F3A` 以下」が満たせない。 | `index.html` About を `scrim-l` → **`scrim-r`** に変更し、`sections.ts` の `X_ABOUT` を `-0.9` → **`+0.3`**（球の中心が幅の約40%位置、見出しの下の空き領域に来る）。 | About local 0.5 で本文カラム（x 832–1300px）の直下に点群が入らない。DevTools 合成スクリーンショットで本文 ≥ 4.5:1。 | storyboard §6.7, §3.2（右5列に本文） |
| 5 | **M** | Service / Process ピン（デスクトップ）<br>`1440x900-03.png`, `-04.png`, `-06.png` | 格子の左端（x≈600）がカード説明文の右端（x≈705）に約100px食い込む（「設計します」「実装します」の上に線が走る）。Process でも設計図の点が x 560–600 でステップ列に掛かる。 | `sections.ts`: `X_SERVICE: -1.3` → **`-1.9`**, `X_PROCESS: -1.1` → **`-1.5`**。または `.card__body, .step__body { max-width: 30em }` でテキストを col-5 相当に収める（storyboard §3.3「テキストは左50%」）。 | 1440×900 で Service local 0.5 / Process local 0.5 のフレームで、3Dのピクセルが x < 720px のテキスト行ボックスと交差しない。 | storyboard §3.3, §3.4, §6.1「テキストブロックは6列以内、3Dの可視領域を残す」 |
| 6 | **M** | モバイル セクション余白<br>`390x844-02.png`（下 450px 空）, `-05.png` 下部, `-08.png`（上 300px 空） | About 150vh / Works 150vh / Company 120vh がモバイルにもそのまま適用され、中央寄せの結果、セクション間に 300–450px のテキストなし領域が連続する。3Dは画面上部に小さく残るだけで、空白に意味がない。 | `sections.css` に `@media (max-width:767px){ .section--about, .section--works, .section--company, .section--contact { min-height:auto; padding: var(--space-16) 0; } }`。3D遷移は section 高さに紐づくため短くなるが、モバイルは簡略カメラで良い（storyboard §5.2）。 | 390×844 で Hero 〜 Footer を 200px 刻みでスクロールし、#2 で許容した Works→Company の1箇所を除き、テキストが一切ないフレームがない。 | storyboard §5.2, §3.0（高さは「目安」であり演出のためのもの） |
| 7 | **M** | Contact → Footer（両サイズ）<br>`1440x900-11.png`, `390x844-10.png` | `.footer{min-height:50vh; align-items:center}` により、補足文からフッター罫線まで約250px、罫線からフッター内容まで約200px、内容の下に約180px の空洞。ページの最後が「余韻」ではなく「切れた」印象で終わる。storyboard §6.5-5 のメールアドレス直書きも無い。 | `components.css`: `.footer{min-height:0; padding: var(--space-12) 0 calc(var(--space-8) + env(safe-area-inset-bottom));}` `.footer__inner` の gap を `var(--space-6)` に。`footer__brand` の下に `<a href="mailto:info@example.com">info@example.com</a>`（mono, text-2）を追加。 | 1440×900 でフッター全高 ≤ 260px、Contact 補足文からフッター1行目までのスクロール距離 ≤ 200px。390 でも同様。 | storyboard §3.8「auto（約40vh）」, §6.5, brief §5.9 |
| 8 | **M** | Works カード（両サイズ）<br>`1440x900-08.png`, `390x844-06.png`, `-07.png` | サムネイル領域が「グラデ + 24px グリッド + 巨大な数字 01/02/03」。どの制作会社のテンプレートにも入っている placeholder の見た目で、3件の違いが数字と色相しかない。brief §5.6 は「`--sd-surface` に 3D シーンの静止フレーム」、storyboard §3.5 は「CSS グラデ + 案件名タイポ」を指定。さらに `work__thumb--2` の surface → secondary グラデは brief §3.1「primary → 透明のみ許可」に外れる。 | 数字と格子を撤去し、各サムネに **案件のカテゴリ語（CORPORATE / SERVICE / BRAND）を mono 12px、案件名を Zen Kaku 500 で左下に組む**。背景は `--sd-surface` 単色＋ inline SVG で各案件に対応する3D状態の線画（01: 格子、02: 結び目、03: 輪。点と線のみ、画像不使用）。`work__thumb--2` のグラデを廃止。 | 3つのサムネが構造的に異なる（数字だけの違いでない）。390 でもサムネ内の案件名が読める（≥ 14px, ≥ 4.5:1）。`#D4A65A` へのグラデが CSS に残っていない。 | brief §5.6, §3.1（グラデ規則）; storyboard §3.5, §7（画像なし） |
| 9 | **M** | モバイル ヘッダー<br>`390x844-00.png`, `-01.png` | `.header__cta{display:none}` が 1024px 未満で有効。storyboard §6.2「sm では非表示にせずアイコン + 短縮ラベル『相談する』」、§6.5-1「ヘッダー右端（常時）」に反し、モバイルではヒーローと Contact 以外で主アクションに届かない。 | `components.css`: `.header__cta` を sm でも表示（`height:36px; padding:0 .75rem; font-size:.8125rem`）し、`.menu-btn` の左に配置。 | 390 幅でヘッダーに `SD ■` / `相談する` / メニューが1行に収まり、折り返しなし。タップ領域 ≥ 36×44px。 | storyboard §6.2, §6.5 |
| 10 | **M** | モバイル Contact<br>`390x844-09.png` | Company の石板が「06 — CONTACT」ラベルと見出しの真後ろに残っている（slab → ring が Contact local 0–0.5 で進むため、見出しが画面中央に来る時点で石板が約70%）。CTA セクションの見出しに3Dが重なる。 | `sections.ts` Contact: モバイルでは slab→ring を local **0–0.25** に短縮し、`groupY` を `-0.3` → **`+0.9`**（輪が見出しの上に浮く）。デスクトップは現状維持。 | 390×844 で Contact の h2 がビューポート中央にある時、h2 / lead のボックスと3Dピクセルが交差しない。 | storyboard §5.2「3Dは画面上部55%」, §6.7 |
| 11 | **M**（検証未了） | Contact（デスクトップ）<br>`1440x900-11.png` | CTAが画面上端にある時点で輪が視認できない（点は opacity ≥ 0.8 のはず）。「輪が CTA を囲む」という Contact の唯一の3D意図が証拠上確認できていない。 | 変更ではなく証拠の追加: Contact local 0.5（h2 が中央）で1枚、CTA が中央で1枚撮る。輪がボタン背後に見えない場合は `pointSize` 1.8 → 2.2、`accentMix` 0.3 → 0.4。 | 2枚のスクリーンショットで、輪の楕円が CTA ブロックを囲んで視認でき、かつ CTA 文字 `#0B0E14` on `#FF6B4A` ≥ 4.5:1。 | storyboard §3.7 |
| 12 | m | カード／ステップ／Works 説明文、Contact 補足<br>全画面 | `.card__body p` `.step__body p` `.work > p:last-child` が 14px × `--sd-text-2`。これらはキャプションではなく事業説明の本文。storyboard §6.7「`--c-muted` は 16px 以上」。 | 上記3つを `font-size: var(--sd-fs-body)`（16px）に。`.note` と `.company-table th` は 14px のまま可（メタ情報）。 | 1440 / 390 で該当段落の computed font-size が 16px。Service ピン内で4枚が 900px に収まる（現状 807px で CTA まで収まっているので +40px 程度は許容）。 | brief §3.2 型スケール（small はキャプション用）, storyboard §6.7 |
| 13 | m | Hero（両サイズ）<br>`1440x900-00.png`, `390x844-00.png` | 点群が一様に散っていて「星空テンプレート」に見える。storyboard T0 は curl noise で塊（星雲）と外殻ハローを作る指定だが、密度差がほとんど見えない。 | `targets` の cloud: curl 振幅 1.2 → **1.8**、ハロー比率 14% は維持。ティール点（10%）の `aSeed` サイズ係数を +0.2。 | Hero local 0 で、画面を 6×4 のブロックに分けた点密度の最大/最小比 ≥ 3。 | storyboard §2.2 T0, brief §6-6「散らばった点群」 |
| 14 | m | コピー照合（`index.html` vs brief §5） | 全セクション一致。差分は2点のみ: (a) Hero 副CTA「実績を見る」は brief §5.2 に無い（storyboard §6.5 の「Works を見る」の和訳、問題なし）。(b) About のキーワード3語は brief §1.5 Values から引用（§5.3 には無いが、ブランドと整合）。 | 変更不要。フッターにメールを追加する際は brief §5.9 の順序（ワードマーク→社名→©→TOP）を崩さない。 | — | brief §5 |

---

## 3. このプロダクト固有で、残すべきもの

1. **タグライン主導のヒーロー**（`1440x900-00.png`）— `SD ■` はナビ左端だけ、ヒーロー中央はタグライン。ラベル `SD — WEB PRODUCTION STUDIO` を mono で添え、CTA はコーラル1つ＋テキストリンク1つ。brief §2, §3.3, §5.2 の通り。
2. **1つの点群が形を変え続ける物語**（`-02` 球 → `-04` 格子 → `-06` 設計図 → `-07` 結び目 → `-10` 石板）— 同じオブジェクトが最後まで語る、という「一貫して手がける小さなスタジオ」の翻訳。Service でカードに合わせて象限が灯る（`-04`）、Process で1ステップだけが白くなる（`-06`〜`-08`）という DOM ↔ 3D の同期は他社サイトにない。
3. **Service / Process を「番号付きリスト」で語る**（真鍮の `01`〜`05`、ティールの縦バー、罫線のみ）— 3枚カードグリッドに逃げていない。密度と沈黙が brief §1.6「精密・静穏」に一致。
4. **色の規律** — コーラル `#FF6B4A` はヒーローと Contact のボタン2つだけ。ラベルは真鍮、リンクとアクティブ状態はティール、面は `--sd-surface`。純黒・純白なし。会社概要は装飾のない右寄せテーブル。
5. **セクションインジケーター**（右端の正方形ドット＋現在地ラベル）— ワードマークの `■` と同じ節点モチーフで、7段階の物語の位置を示す。

---

## 4. Frontend Developer への修正リスト（影響順）

1. **[C] モバイルの Service / Process 減光を廃止** — `sections.ts` でピンなし時は opacity tween を組まず、個別 reveal で opacity 1。CSS 初期 opacity を `min-width:1024px` に限定。検証: `390x844-03` 相当で4枚とも白。
2. **[C] Works → Company の真鍮メッシュと空白** — `knotOpacity` 上限 0.55、フェード local 0.6–0.8、Works `camZ` 6.2、Works 120vh / Company 100vh 上寄せ。検証: Works local 0.5 でカード3枚＋真鍮面積 ≤ 10%、テキストなしの連続スクロール ≤ 50vh。
3. **[M] デスクトップの非アクティブ opacity 0.3/0.35 → 0.6、最初の項目をピン開始直後（local 0.05）に点灯**。検証: ピン開始フレームに白い項目が1つ以上。
4. **[M] About のスクリムを `scrim-r` に、`X_ABOUT` を +0.3** — 球を見出し下の空き領域へ。検証: 本文カラム直下に点群なし、≥ 4.5:1。
5. **[M] Service / Process の3Dをテキスト列の外へ** — `X_SERVICE -1.9`, `X_PROCESS -1.5`（または本文 `max-width:30em`）。検証: local 0.5 で x < 720px にテキストと交差する3Dなし。
6. **[M] モバイルの `min-height` を auto に** — About / Works / Company / Contact、`padding: 4rem 0`。Contact はモバイルで slab→ring を local 0–0.25、`groupY +0.9`。検証: 200px 刻みでテキストなしフレームなし、h2 に3D非交差。
7. **[M] フッターの空洞** — `min-height:0`、gap 縮小、メールアドレス追加、Contact `padding-bottom` 4rem。検証: フッター全高 ≤ 260px。
8. **[M] Works サムネの汎用プレースホルダを置換** — 数字と格子を外し、カテゴリ＋案件名のタイポ＋ inline SVG の線画（格子／結び目／輪）。`work__thumb--2` の真鍮グラデ廃止。検証: 3枚が構造的に異なり、390 で案件名可読。
9. **[M] モバイルヘッダーに `相談する` を常時表示**（36px、メニュー左）。検証: 390 幅で1行。
10. **[M/検証] Contact の輪** — local 0.5 と CTA 中央の2枚を撮影し添付。見えなければ `pointSize 2.2 / accentMix 0.4`。  
    （Minor は余力があれば: 説明文 16px 化、Hero 点群の塊の強調。）

---

## 5. PASS 条件

- 390×844 で Service カード4枚・Process ステップ5つが、画面内にある間は常に opacity 1 で読める（合成 ≥ 4.5:1）。
- 1440×900 で、Hero 〜 Footer のどのスクロール位置でも「テキストが一切ないビューポート」が 50vh を超えて続かない（Works→Company の1箇所を含む）。
- Works local 0.5 で真鍮色の面積が画面の 10% 以下、かつカード3枚が見える。
- About / Service / Process の local 0.5 で、本文・カード・ステップの行ボックスに3Dのピクセルが交差せず、DevTools 合成スクリーンショットで ≥ 4.5:1。
- モバイルのヘッダーに `相談する` が常時表示される。
- Works サムネに数字だけのプレースホルダが残っていない。
- フッター全高 ≤ 260px、メールアドレスあり。
- Contact の輪が CTA を囲む証拠スクリーンショットが2枚添付されている。
- 上記をすべて満たした状態で、Hero のタグライン・ワードマーク・色の規律・番号付きリスト・インジケーターが変更されていないこと（§3 の「残すべきもの」）。

---

## 対応記録（Frontend Developer, 2026-09-23）

| # | 対応 |
|---|---|
| 1 | ピンなし（モバイル／タブレット）ではカード・ステップの opacity を scrub せず、要素ごとの入場（`start: 'top 85%'`）で常時 opacity 1。縦バーの点灯のみセクション進行に連動。CSS 初期値は `min-width: 1024px` に限定 |
| 2 | `knotOpacity` 上限 0.55、フェードアウトを local 0.6–0.8 に前倒し、Works カメラ `camZ` 6.2。Works 120vh / Company 110vh に短縮 |
| 3 | 非アクティブ opacity 0.6。Service カード1は local 0.12、Process ステップ01は 0.05 で点灯 |
| 4 | About は見出し・本文とも左 6 列に揃え、球は右（`X_ABOUT -1.1`）。スクリムは左のまま |
| 5 | `X_SERVICE -1.9`, `X_PROCESS -1.5`。説明文に `max-width: 30em` |
| 6 | `max-width: 767px` で About / Works / Company / Contact の `min-height: auto`、余白を `--space-16` に |
| 7 | フッター `min-height` 撤廃、gap 縮小、`info@example.com` の mailto を追加 |
| 8 | サムネイルを `--sd-surface` + inline SVG（01 格子 / 02 結び目 / 03 輪）+ mono ラベルに置換。secondary へのグラデを削除 |
| 9 | ヘッダー CTA「相談する」をモバイルでも表示（36px 高） |
| 10 | Contact のトリガーを `top 45%` 開始にし、モバイルは slab→ring を local 0–0.3、`groupY +0.9` |
| 11 | 1440×900 で h2 中央・CTA 中央の 2 枚を撮影し、輪が CTA ブロックを囲むことを確認 |
| 12 | カード／ステップ／Works 説明文を 16px に |
| 13 | Hero の cloud ターゲットのノイズ振幅 1.2 → 1.8 |
| 14 | 変更なし |
