# Gemini 譜面生成プロンプト

Gemini 3.5 Flash に楽曲を分析させるときは、音声をアップロードしたうえで、アプリ専用の軽量JSON `school-fes-ai-beatmap` を出力させます。
アプリでは「ファイル」→「AI譜面読み込み」からこのJSONを読み込めます。

## 出力フォーマット

JSONには、ここにあるフィールドだけを書かせます。攻撃の雰囲気、攻略アドバイス、説明文、コメント用フィールドは含めません。

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
      "beat": 8,
      "kind": "package_grid_square",
      "name": "GridSquare 1",
      "lane": 0,
      "color": "#ff2f4f",
      "params": {
        "packageCount": 6,
        "packageIntervalBeats": 0.25,
        "packageX": 480,
        "packageY": 270,
        "packageWidth": 620,
        "packageHeight": 300,
        "packageSize": 92,
        "packageWarningTimeBeats": 1
      }
    }
  ]
}
```

## 基本仕様

- `events` の件数は固定しません。曲の長さと分析結果に合わせて必要な数だけ作ります。
- ステージは `width=960`, `height=540` です。
- 座標は左上が `(0, 0)`、右方向が `x+`、下方向が `y+` です。
- 角度は度数法です。`0` は右、`90` は下、`-90` は上です。
- プレイヤーは通常移動に加えて Space キーで短時間の高速ダッシュができます。譜面はこのダッシュを前提にできますが、連続して常にダッシュしないと避けられない配置は避けます。
- イベントの開始位置は `time` 秒、または `beat` / `beats` 拍で指定できます。
- `timeline.bpm` を指定する場合は、イベント開始位置には `beat` を使えます。`beat=0` は `timeline.musicOffset` の位置、`beat=4` は4拍後です。
- `time` と `beat` の両方がある場合、アプリは互換性のため `time` を優先します。
- params の時間系フィールドは秒単位の名前、または拍数指定の `Beats` 接尾辞を使えます。例: `packageInterval` の代わりに `packageIntervalBeats`、`packageDuration` の代わりに `packageDurationBeats`、`packageWarningTime` の代わりに `packageWarningTimeBeats`。
- `lane` はタイムライン上の表示行です。指定しない場合はアプリ側で補います。
- `color` は `#rrggbb` 形式です。指定しない場合はパッケージの既定色になります。
- `seed` を指定するとランダム配置が固定されます。省略するとアプリ側の既定値が使われます。
- `packageWarningTime` があるパッケージでは、攻撃本体の前に予告表示が出ます。
- `packageWarningTimeBeats` を使う場合も、表示上は `packageWarningTime` に秒換算されます。
- `packageWarningAlpha` は予告表示の透明度です。
- `packageDuration` は生成される攻撃本体の表示時間または移動時間です。

## パッケージ仕様

### `package_random_barrage`

指定できる主なparams: `packageCount`, `packageInterval`, `packageX`, `packageY`, `packageAngleWidth`, `packageSpeed`, `packageDuration`, `seed`

`packageX`, `packageY` を発射点として、`packageCount` 個の小さい弾を `packageInterval` 秒ごとに発射します。基準方向は上方向で、`packageAngleWidth` の範囲にランダムな角度ずれが入ります。`packageSpeed` が弾速、`packageDuration` が弾の生存時間です。画面には小さい円弾として表示されます。

### `package_repeating_lasers`

指定できる主なparams: `packageCount`, `packageInterval`, `packageOrientation`, `packageInitialPosition`, `packageLength`, `packageThickness`, `packageDuration`, `packageWarningTime`, `packageWarningAlpha`, `seed`

`packageCount` 本の直線レーザーを `packageInterval` 秒ごとに出します。`packageOrientation` が `horizontal` の場合は横線レーザー、`vertical` の場合は縦線レーザーです。`packageInitialPosition` は配置範囲の中心で、実際の位置はその周辺にランダム配置されます。`packageLength` が線の長さ、`packageThickness` が太さです。画面には予告線のあと、同じ位置にレーザー本体が表示されます。

### `package_bomb_burst`

指定できる主なparams: `packageStartX`, `packageStartY`, `packageX`, `packageY`, `packageFuseTime`, `packageBombSize`, `packageBulletCount`, `packageBulletSize`, `packageSpeed`, `packageDuration`, `seed`

`packageStartX`, `packageStartY` から `packageX`, `packageY` へ円形のボム本体が移動します。移動時間は `packageFuseTime`、ボム本体の大きさは `packageBombSize` です。到達後、`packageX`, `packageY` から `packageBulletCount` 個の円弾を全方向に発射します。破裂後の弾の大きさは `packageBulletSize`、弾速は `packageSpeed`、生存時間は `packageDuration` です。画面には移動する円形ボムと、その後に広がる円弾として表示されます。

### `package_random_circle`

指定できる主なparams: `packageCount`, `packageInterval`, `packageX`, `packageY`, `packageWidth`, `packageHeight`, `packageSize`, `packageDuration`, `packageWarningTime`, `packageWarningAlpha`, `seed`

`packageX`, `packageY` を中心とする `packageWidth` x `packageHeight` の範囲に、`packageCount` 個の円攻撃をランダム配置します。各攻撃は `packageInterval` 秒ごとに発生します。`packageSize` が円の直径、`packageDuration` が表示時間です。画面には予告円のあと、同じ位置に円形の攻撃判定が表示されます。

### `package_grid_square`

指定できる主なparams: `packageCount`, `packageInterval`, `packageX`, `packageY`, `packageWidth`, `packageHeight`, `packageSize`, `packageDuration`, `packageWarningTime`, `packageWarningAlpha`, `seed`

`packageX`, `packageY` を中心とする `packageWidth` x `packageHeight` の範囲を `packageSize` 間隔のグリッドとして扱い、`packageCount` 個の四角攻撃をランダムなセルに配置します。各攻撃は `packageInterval` 秒ごとに発生します。画面には予告四角のあと、同じ位置に四角形の攻撃判定が表示されます。

### `package_lag_radial`

指定できる主なparams: `packageCount`, `packageInterval`, `packageBulletCount`, `packageX`, `packageY`, `packageStartAngle`, `packageAngleWidth`, `packageAimAtPlayer`, `packageSpeed`, `packageDuration`

`packageX`, `packageY` から円形弾を連続発射します。発射回数は `packageCount`、発射間隔は `packageInterval` です。各回の弾数は `packageBulletCount` です。`packageStartAngle` が最初の発射角で、回を重ねるごとに `packageAngleWidth` だけ開始角度がずれます。`packageAimAtPlayer` を `1` にすると発射時点のプレイヤー位置を基準にします。画面には同じ発射点から複数回の円形弾として表示されます。

### `package_split_lag_radial`

指定できる主なparams: `packageCount`, `packageBulletCount`, `packageX`, `packageY`, `packageStartAngle`, `packageSplitStartAngle`, `packageAimAtPlayer`, `packageSplitAimAtPlayer`, `packageSpeed`, `packageSplitSpeed`, `packageDuration`, `packageSplitDuration`

まず `packageX`, `packageY` から `packageCount` 個の円形弾を発射します。`packageDuration` 秒後、それぞれの到達位置から `packageBulletCount` 個の分裂弾を発射します。初回の弾速は `packageSpeed`、分裂後の弾速は `packageSplitSpeed` です。`packageStartAngle` が初回の開始角、`packageSplitStartAngle` が分裂時に加算される角度です。画面には親弾が広がったあと、各位置から追加の円形弾が出る形で表示されます。

### `package_random_lasers`

指定できる主なparams: `packageCount`, `packageX`, `packageY`, `packageWidth`, `packageHeight`, `packageLength`, `packageThickness`, `packageDuration`, `packageWarningTime`, `packageWarningAlpha`, `seed`

`packageX`, `packageY` を中心とする `packageWidth` x `packageHeight` の範囲に、`packageCount` 本のレーザー中心点をランダム配置します。角度もランダムです。`packageLength` がレーザーの長さ、`packageThickness` が太さ、`packageDuration` が表示時間です。画面にはランダム角度の予告線のあと、同じ線上にレーザー本体が表示されます。

### `package_center_lasers`

指定できる主なparams: `packageCount`, `packageX`, `packageY`, `packageStartAngle`, `packageLength`, `packageThickness`, `packageDuration`, `packageWarningTime`, `packageWarningAlpha`

`packageX`, `packageY` を中心として、`packageCount` 本のレーザーを等角度に配置します。`packageStartAngle` が最初の角度です。`packageLength` が長さ、`packageThickness` が太さです。画面には中心から放射状に伸びる予告線のあと、同じ位置にレーザー本体が表示されます。

### `package_area_parallel`

指定できる主なparams: `packageCount`, `packageInterval`, `packageX`, `packageY`, `packageWidth`, `packageHeight`, `packageDirectionDeg`, `packageSpeed`, `packageDuration`, `seed`

`packageX`, `packageY` を中心とする `packageWidth` x `packageHeight` の範囲から、`packageCount` 個の小さい弾をランダムな発射点で生成します。各弾は `packageInterval` 秒ごとに発生し、すべて `packageDirectionDeg` の方向へ `packageSpeed` で移動します。画面には同じ方向へ流れる小さい円弾として表示されます。

### `package_snake_chain`

指定できる主なparams: `packageCount`, `packageSpacing`, `packageX`, `packageY`, `packageSize`, `packageSpeed`, `packageDuration`, `packagePolynomialA`, `packagePolynomialB`, `packagePolynomialC`, `packagePolynomialD`

`packageX`, `packageY` から四角弾を `packageSpacing` 秒ずつずらして連続生成します。弾は多項式 `y = ax^4 + bx^3 + cx^2 + dx` の軌道を進みます。係数は `packagePolynomialA`, `packagePolynomialB`, `packagePolynomialC`, `packagePolynomialD` です。`packageSize` が四角の大きさ、`packageSpeed` が軌道上の移動速度です。画面には曲線状に並んで進む四角弾として表示されます。

### `package_enter_exit_bar`

指定できる主なparams: `packageX`, `packageY`, `packageLength`, `packageThickness`, `packageSpeed`, `packageDuration`, `packageOrientation`, `packageMoveDirectionDeg`, `packageWarningTime`, `packageWarningAlpha`

`packageX`, `packageY` を中心に長いバーを生成し、`packageMoveDirectionDeg` の方向へ移動させます。`packageOrientation` が `horizontal` の場合は横向きバー、`vertical` の場合は縦向きバーです。`packageLength` が長さ、`packageThickness` が太さ、`packageSpeed` が移動速度です。画面には予告線のあと、同じ向きの長いバーが移動して表示されます。

### `package_rotating_lasers`

指定できる主なparams: `packageCount`, `packageX`, `packageY`, `packageStartAngle`, `packageLength`, `packageThickness`, `packageRotationSpeed`, `packageDuration`, `packageWarningTime`, `packageWarningAlpha`

`packageX`, `packageY` を中心として、`packageCount` 本のレーザーを等角度に配置します。レーザー群は `packageRotationSpeed` の速度で回転します。`packageStartAngle` が初期角度、`packageLength` が長さ、`packageThickness` が太さです。画面には初期位置の予告線のあと、中心周りに回転するレーザーとして表示されます。

### `package_sequential_lasers`

指定できる主なparams: `packageCount`, `packageInterval`, `packageInitialPosition`, `packageDistance`, `packageOrientation`, `packageLength`, `packageThickness`, `packageDuration`, `packageWarningTime`, `packageWarningAlpha`

`packageCount` 本の平行レーザーを `packageInterval` 秒ごとに順番に出します。`packageOrientation` が `horizontal` の場合は横線レーザーで、位置は `y = packageInitialPosition + index * packageDistance` です。`vertical` の場合は縦線レーザーで、位置は `x = packageInitialPosition + index * packageDistance` です。`packageLength` が長さ、`packageThickness` が太さです。画面には順番に予告線が出て、その後にレーザー本体が表示されます。

## Gemini に送るプロンプト

```text
あなたは JSaB 風の弾幕譜面データを作るアシスタントです。
添付した楽曲を分析し、アプリに読み込める JSON を作ってください。

必ず JSON だけを返してください。説明文、Markdown、コードフェンス、コメント、攻略アドバイスは不要です。
JSON には指定されたフィールドだけを含めてください。攻撃の雰囲気、セクション説明、難易度コメント、意図説明のような追加フィールドは作らないでください。

出力形式:
- format は必ず "school-fes-ai-beatmap"
- version は必ず 1
- title は曲名または譜面名
- duration は楽曲の秒数
- timeline.bpm は推定BPM
- timeline.beatsPerMeasure は通常 4
- timeline.musicOffset は最初の拍が始まる秒数。わからなければ 0
- events の件数は固定しない。楽曲全体に必要な数だけ作る
- イベント開始位置は beat で指定する。beat は timeline.musicOffset から数えた拍数
- beat が使えない場合だけ time 秒を使う。time と beat を同じイベントに両方書かない
- kind は許可リストから選ぶ
- params には、その kind に効くパラメータだけを書く
- params の時間系フィールドは拍数で指定してよい。packageIntervalBeats、packageDurationBeats、packageWarningTimeBeats、packageFuseTimeBeats、packageSpacingBeats などを使える
- 画面サイズは width=960, height=540 として配置する
- プレイヤーは通常移動に加えて Space キーで短時間の高速ダッシュができる
- ダッシュを考慮してよいが、連続して常にダッシュしないと避けられない配置にはしない

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

パッケージ仕様:
- package_random_barrage: packageX/packageY から packageCount 個の小さい円弾を packageInterval 秒ごとに発射する。packageAngleWidth は上方向基準のランダム角度幅、packageSpeed は弾速、packageDuration は生存時間。
- package_repeating_lasers: packageCount 本の直線レーザーを packageInterval 秒ごとに出す。packageOrientation は horizontal/vertical。packageInitialPosition は配置範囲の中心。packageLength は長さ、packageThickness は太さ。予告線のあと同じ位置に表示される。
- package_bomb_burst: packageStartX/packageStartY から packageX/packageY へ packageBombSize の円形ボムが packageFuseTime 秒で移動し、その後 packageBulletCount 個の円弾を発射する。packageBulletSize は破裂後の弾の大きさ、packageSpeed は弾速、packageDuration は弾の生存時間。
- package_random_circle: packageX/packageY を中心とする packageWidth x packageHeight 範囲に packageCount 個の円攻撃をランダム配置する。packageSize は直径。予告円のあと同じ位置に円形攻撃が出る。
- package_grid_square: packageX/packageY を中心とする packageWidth x packageHeight 範囲を packageSize 間隔のグリッドにし、packageCount 個の四角攻撃をランダムセルに配置する。予告四角のあと同じ位置に四角攻撃が出る。
- package_lag_radial: packageX/packageY から packageCount 回の円形弾を packageInterval 秒ごとに発射する。各回の弾数は packageBulletCount。packageStartAngle が初回角度、packageAngleWidth が回ごとの角度ずれ。packageAimAtPlayer=1 でプレイヤー方向基準。
- package_split_lag_radial: packageX/packageY から packageCount 個の親弾を出し、packageDuration 秒後に各到達位置から packageBulletCount 個の分裂弾を出す。packageSpeed/packageSplitSpeed と packageStartAngle/packageSplitStartAngle でそれぞれを調整する。
- package_random_lasers: packageX/packageY を中心とする packageWidth x packageHeight 範囲に packageCount 本のレーザー中心点をランダム配置し、角度もランダムにする。packageLength は長さ、packageThickness は太さ。
- package_center_lasers: packageX/packageY を中心に packageCount 本のレーザーを等角度配置する。packageStartAngle が最初の角度、packageLength が長さ、packageThickness が太さ。
- package_area_parallel: packageX/packageY を中心とする packageWidth x packageHeight 範囲から packageCount 個の小さい円弾をランダム生成し、すべて packageDirectionDeg 方向へ packageSpeed で移動させる。
- package_snake_chain: packageX/packageY から packageCount 個の四角弾を packageSpacing 秒ずつずらして生成し、多項式 y=ax^4+bx^3+cx^2+dx の軌道を進ませる。係数は packagePolynomialA/B/C/D。
- package_enter_exit_bar: packageX/packageY を中心に長いバーを生成し、packageMoveDirectionDeg 方向へ移動させる。packageOrientation は horizontal/vertical、packageLength は長さ、packageThickness は太さ、packageSpeed は移動速度。
- package_rotating_lasers: packageX/packageY を中心に packageCount 本のレーザーを等角度配置し、packageRotationSpeed で回転させる。packageStartAngle は初期角度、packageLength は長さ、packageThickness は太さ。
- package_sequential_lasers: packageCount 本の平行レーザーを packageInterval 秒ごとに順番に出す。horizontal なら y=packageInitialPosition+index*packageDistance、vertical なら x=packageInitialPosition+index*packageDistance。packageLength は長さ、packageThickness は太さ。

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
      "beat": 4,
      "kind": "package_random_circle",
      "name": "RandomCircle 1",
      "lane": 0,
      "color": "#36f5ff",
      "params": {
        "packageCount": 4,
        "packageIntervalBeats": 0.5,
        "packageX": 480,
        "packageY": 270,
        "packageWidth": 520,
        "packageHeight": 260,
        "packageSize": 72,
        "packageWarningTimeBeats": 1
      }
    },
    {
      "beat": 32,
      "kind": "package_enter_exit_bar",
      "name": "EnterExitBar 1",
      "lane": 2,
      "color": "#ff2f4f",
      "params": {
        "packageX": 480,
        "packageY": 120,
        "packageLength": 960,
        "packageThickness": 28,
        "packageSpeed": 330,
        "packageDurationBeats": 5,
        "packageOrientation": "horizontal",
        "packageMoveDirectionDeg": 90,
        "packageWarningTimeBeats": 1
      }
    }
  ]
}
```
