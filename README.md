# 弾幕メーカー

TypeScript + PixiJS + Vite で作成している、音楽同期型の回避アクションゲーム向け弾幕エディタです。

JSaB 風の避けゲーを想定し、タイムライン上に攻撃イベントを配置して、ブラウザ上でプレビュー・調整・JSON保存できることを目標にしています。

## 公開URL

GitHub Pages 設定後、以下のURLで公開されます。

https://marron22.github.io/bullet-hell-maker/

## 主な機能

- PixiJS によるゲーム画面風プレビュー
- マウス追従のプレイヤー表示
- タイムライン再生、停止、リセット
- イベントの追加、選択、削除、コピー、貼り付け
- イベントの開始時刻、継続時間、軌道、見た目などの編集
- BPM、小節、拍グリッド、スナップ編集
- 音楽ファイルの読み込み、再生、音量調整、波形表示
- JSON形式での書き出し、読み込み
- GitHub Pages への自動デプロイ

## 開発環境

- Node.js 22 以降推奨
- npm

## セットアップ

```bash
npm install
```

## 開発サーバー

```bash
npm run dev
```

標準では以下で起動します。

http://127.0.0.1:5173/

別ポートで固定起動したい場合は以下も使えます。

```bash
npm run dev:5174
```

## ビルド

```bash
npm run build
```

ビルド結果は `dist/` に出力されます。`dist/` は GitHub Actions 側で生成するため、リポジトリにはコミットしません。

## GitHub Pages への公開

このプロジェクトは GitHub Actions でビルドし、GitHub Pages にデプロイする構成です。

重要なファイル:

- `vite.config.ts`: GitHub Pages 用にビルド時の `base` を `/bullet-hell-maker/` に設定
- `.github/workflows/deploy.yml`: `main` ブランチへの push 時に自動デプロイ

GitHub 側で以下の設定をしてください。

1. GitHub の `marron22/bullet-hell-maker` リポジトリを開く
2. `Settings` → `Pages` を開く
3. `Build and deployment` の `Source` を `GitHub Actions` にする
4. このプロジェクトのファイルを `main` ブランチへ push する
5. `Actions` タブで `Deploy to GitHub Pages` が成功するのを確認する

公開先:

```text
https://marron22.github.io/bullet-hell-maker/
```

## プロジェクト構成

```text
src/
  core/
    eventFactory.ts      イベント生成
    eventTemplates.ts    追加メニュー用プリセット
    playback.ts          再生時計
    samplePattern.ts     初期サンプル弾幕
    simulation.ts        任意時刻の弾幕状態計算
    types.ts             弾幕データ型
  preview/
    PreviewStage.ts      PixiJS プレビュー描画
  main.ts                UI、タイムライン、保存/読み込み、音楽連携
```

## 注意

現在のローカルフォルダは Git 管理されていない可能性があります。`git status` が使えない場合は、GitHub のリポジトリを clone したフォルダへこのプロジェクトを移すか、このフォルダで `git init` してリモートを設定してください。
