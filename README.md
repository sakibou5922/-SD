# 株式会社SD コーポレートサイト

「構造が、動き出す。」— Web制作事業を営む株式会社SDのワンページ・スクロール駆動サイトです。
背景の 3D 点群（Three.js）がスクロールに合わせて **銀河 → 惑星 → 格子 → 設計図 → 結び目 → 礎 → 輪** と変形し、Web制作の工程を一つのオブジェクトで語ります。

公開 URL: https://sakibou5922.github.io/-SD/

## 開発

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 型チェック + dist/ へビルド
npm run preview    # ビルド結果の確認
```

- Node.js 22 / npm 10 以上
- 依存: three, gsap (ScrollTrigger), lenis / Vite 8, TypeScript

## 構成

```
index.html                 全セクションのマークアップ・コピー（docs/brand-brief.md §5 準拠）
src/main.ts                起動・分岐（reduced-motion / WebGL 不可 / モバイル）
src/three/targets.ts       7 つのモーフターゲットを決定論的に生成（純関数）
src/three/shaders.ts       点・線・フレネル用 GLSL
src/three/background.ts    シーン内背景（グラデーション・星雲・遠景の星・ビネット）
src/three/post.ts          ポストプロセス（ブルーム、グレイン、ビネット、色収差）
src/three/scene.ts         レンダラー、共有ジオメトリ、惑星・軌道・遠景惑星、描画ループ、適応 DPR
src/three/state.ts         スクロールで tween される単一のシーン状態
src/scroll/sections.ts     セクション別 ScrollTrigger タイムライン（3D・カメラ・背景・DOM）
src/scroll/reveal.ts       DOM 入場アニメーションの共通ユーティリティ
src/scroll/smooth.ts       Lenis + ScrollTrigger 同期
src/ui/header.ts           固定ヘッダー、モバイルメニュー、アンカー遷移
src/ui/indicator.ts        セクションインジケーター
src/ui/cursor.ts           カスタムカーソル、マグネティックボタン
src/ui/effects.ts          プリローダー、文字分割リビール、進捗バー、セクション番号、カードのチルト
src/styles/*.css           トークン / ベース / コンポーネント / セクション
docs/brand-brief.md        ブランド戦略・VI・ボイス・全コピー（Brand Guardian / Content Creator）
docs/scroll-storyboard.md  3D シーン設計・ストーリーボード・性能予算（UX Architect / Visual Storyteller）
docs/ui-review.md          実装後のレビュー（UI Finish-Gate Reviewer）
.claude/agents/            使用した agency-agents のペルソナ定義（MIT）
```

## 公開前に差し替えるもの

- `index.html` の会社概要（所在地・代表者・設立）とメールアドレス `info@example.com`
- Works の 3 件のサンプルカード（`〔サンプル〕`）と注記
- OG 画像 `public/og.png`（1200×630）。現在はヘッドレス環境の代替フォントで生成した仮画像です。公開時は `og:image` を絶対 URL（例 `https://example.com/og.png`）に書き換え、必要なら本番フォントで撮り直してください
- `public/robots.txt` の Sitemap 行（公開ドメインに合わせる）

## デプロイ

`main` への push で GitHub Pages に自動デプロイされます（`.github/workflows/deploy-pages.yml`）。
リポジトリの Settings → Pages で Source を「GitHub Actions」にしてください。
`vite.config.ts` の `base: './'` により、サブパス配信でも動作します。

## 動作方針

- `prefers-reduced-motion: reduce` … スムーススクロールとスクロール連動の変形を停止し、3D は静止した完成形を 1 回だけ描画。DOM はフェードのみ
- WebGL 非対応 … キャンバスを外し、CSS グラデーション + ドット模様の背景に切替
- モバイル … 点数を 4,096 に減らし、ピン留めとポストプロセスを解除、DPR を 1.5 に制限
- カスタムカーソルとマグネティックボタンは `pointer: fine` の端末のみ

## クレジット

エージェント定義は [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)（MIT License）より。
