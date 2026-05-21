# Gemini 譜面生成プロンプト

Gemini 3.5 Flash に楽曲を分析させるときは、音声をアップロードしたうえで、アプリ専用の軽量JSON `school-fes-ai-beatmap` を出力させます。
アプリでは「ファイル」→「AI譜面読み込み」からこのJSONを読み込めます。

## 出力フォーマット

```json
{
  "format": "school-fes-ai-beatmap",
  "version": 1,
  "title": "Song title or chart title",
  "duration": 120,
  "timeline": {
    "bpm": 140,
    "beatsPerMeasure": 4,
    "musicOffset": 0
  },
  "events": [
    {
      "time": 4.2,
      "kind": "package_grid_square",
      "name": "Intro grid hit",
      "lane": 0,
      "color": "#ff2f4f",
      "params": {
        "packageCount": 6,
        "packageInterval": 0.12,
        "packageX": 480,
        "packageY": 270,
        "packageWidth": 620,
        "packageHeight": 300,
        "packageSize": 92,
        "packageWarningTime": 0.65
      }
    }
  ]
}
```

## 使えるパッケージ

- `package_random_barrage`: 定点ランダム弾幕。密度を作る。
- `package_repeating_lasers`: 縦横レーザー連射。拍に合わせた反復に向く。
- `package_bomb_burst`: ボム破裂弾。大きいアクセントに向く。
- `package_random_circle`: ランダム円攻撃。軽い打点や散発的な音に向く。
- `package_grid_square`: グリッド四角攻撃。キック、スネア、強拍に向く。
- `package_lag_radial`: ラグ円形連射。短いフィルや上昇に向く。
- `package_split_lag_radial`: 分裂ラグ円形弾。サビ前やブレイク後の変化に向く。
- `package_random_lasers`: ランダムレーザー。ハイハットやノイズの緊張感に向く。
- `package_center_lasers`: 中心全方向レーザー。大きい展開に向く。
- `package_area_parallel`: エリア平行弾。流れや横移動感に向く。
- `package_snake_chain`: スネーク正方形。メロディのうねりに向く。
- `package_enter_exit_bar`: 入退場バー。長い音、ドロップ、場面転換に向く。
- `package_rotating_lasers`: 中央回転レーザー。サビや持続的な緊張に向く。
- `package_sequential_lasers`: 時間差平行レーザー。階段状のリズムに向く。

## Gemini に送るプロンプト

```text
あなたは JSaB 風の弾幕譜面デザイナーです。
添付した楽曲を分析し、音楽の構成、拍、強いアクセント、静かな区間、サビ、ブレイクに合わせて弾幕譜面を作ってください。

必ず次のJSONだけを返してください。説明文、Markdown、コードフェンスは不要です。

出力形式:
- format は必ず "school-fes-ai-beatmap"
- version は必ず 1
- title は曲名または譜面名
- duration は楽曲の秒数
- timeline.bpm は推定BPM
- timeline.beatsPerMeasure は通常 4
- timeline.musicOffset は最初の拍が始まる秒数。わからなければ 0
- events は 20〜70 個程度
- time は秒単位。小数2桁程度
- kind は下の許可リストから選ぶ
- params には、その kind に効くパラメータだけを書く
- 画面サイズは width=960, height=540 として配置する
- 生成される攻撃は、プレイヤーが回避できる密度にする
- 序盤は軽く、サビやドロップで密度を上げ、ブレイクでは一度下げる
- 同じパターンだけを連続させず、曲のセクションごとに変化を付ける
- packageWarningTime は 0.35〜0.9 の範囲を基本にする
- packageCount を高くしすぎない。強い区間でも 16 程度までを目安にする

許可する kind:
package_random_barrage
package_repeating_lasers
package_bomb_burst
package_random_circle
package_grid_square
package_lag_radial
package_split_lag_radial
package_random_lasers
package_center_lasers
package_area_parallel
package_snake_chain
package_enter_exit_bar
package_rotating_lasers
package_sequential_lasers

よく使う params:
- 共通: packageCount, packageInterval, packageDuration, packageWarningTime, packageWarningAlpha, packageX, packageY, packageSpeed, seed
- エリア系: packageWidth, packageHeight, packageSize
- レーザー/バー: packageLength, packageThickness, packageOrientation, packageMoveDirectionDeg, packageInitialPosition
- 角度系: packageStartAngle, packageAngleWidth, packageDirectionDeg, packageRotationSpeed
- ボム: packageStartX, packageStartY, packageBombSize, packageFuseTime, packageBulletCount
- スネーク: packageSpacing, packagePolynomialA, packagePolynomialB, packagePolynomialC, packagePolynomialD

JSON例:
{
  "format": "school-fes-ai-beatmap",
  "version": 1,
  "title": "AI generated chart",
  "duration": 120,
  "timeline": {
    "bpm": 140,
    "beatsPerMeasure": 4,
    "musicOffset": 0
  },
  "events": [
    {
      "time": 2.0,
      "kind": "package_random_circle",
      "name": "Intro soft hits",
      "lane": 0,
      "color": "#36f5ff",
      "params": {
        "packageCount": 4,
        "packageInterval": 0.25,
        "packageX": 480,
        "packageY": 270,
        "packageWidth": 520,
        "packageHeight": 260,
        "packageSize": 72,
        "packageWarningTime": 0.55
      }
    },
    {
      "time": 16.0,
      "kind": "package_enter_exit_bar",
      "name": "Drop sweep",
      "lane": 2,
      "color": "#ff2f4f",
      "params": {
        "packageX": 480,
        "packageY": 120,
        "packageLength": 960,
        "packageThickness": 28,
        "packageSpeed": 330,
        "packageDuration": 2.5,
        "packageOrientation": "horizontal",
        "packageMoveDirectionDeg": 90,
        "packageWarningTime": 0.65
      }
    }
  ]
}
```
