# Custom Package Authoring Skill

この仕様は、弾幕メーカーの「コードからパッケージを追加」で読み込む `.mjs` パッケージを書くための AI 向けガイドです。

## 目的

AI は、この仕様に従って単独で動作する ES module を作成します。ファイル拡張子は `.mjs` とし、アプリ内の「追加」メニューから読み込みます。

## 重要な制約

- TypeScript ではなく、ブラウザでそのまま実行できる `.mjs` を出力する。
- `import` 文は使わない。Blob URL から読み込まれるため、相対 import は解決できない。
- `export default { ... }` でパッケージ定義オブジェクトを出力する。
- `kind` は必ず `custom_` で始め、英小文字、数字、アンダースコアだけにする。
- 読み込まれたコードはページ上で実行される。外部通信、DOM 操作、ストレージ操作、副作用のある処理は書かない。
- `build()` は同期関数にする。`async` や Promise は使わない。

## 定義形式

```js
export default {
  kind: "custom_example_package",
  label: "表示名",
  description: "任意の説明",
  color: 0xf82469,
  icon: "package",
  fields: [],
  defaults({ stage, helpers }) {
    return {};
  },
  build({ pkg, stage, helpers }) {
    return [];
  },
  getDuration({ pkg, generatedEvents }) {
    return pkg.packageDuration;
  },
};
```

## フィールド定義

`fields` にはパッケージタブに表示する編集項目を並べます。`startTime` と `seed` はアプリ側が自動で追加します。

数値:

```js
{ name: "count", label: "count", type: "number", min: 1, max: 64, step: 1, integer: true }
```

チェックボックス:

```js
{ name: "aimAtPlayer", label: "aimAtPlayer", type: "checkbox" }
```

選択:

```js
{
  name: "orientation",
  label: "orientation",
  type: "select",
  options: [
    { value: "horizontal", label: "Horizontal" },
    { value: "vertical", label: "Vertical" },
  ],
}
```

## defaults()

`defaults({ stage, helpers })` は、パッケージ追加時の初期値を返します。

よく使う値:

- `stage.width`
- `stage.height`
- `packageDuration`
- `packageInterval`
- `packageX`
- `packageY`
- custom field の初期値

## build()

`build({ pkg, stage, helpers })` は、通常攻撃イベントの配列を返します。パッケージ自身を返してはいけません。

イベントは必ず `helpers.createAttackEvent(kind, startTime)` で作り、必要な値だけ上書きします。返したイベントにはアプリ側が `packageId`、`packageLocked`、`visible`、`timelineLane` を付与します。

使える主な通常攻撃 kind:

- `"spawn_bullet"`
- `"spawn_bullet_spread"`
- `"spawn_aimed_spread"`
- `"spawn_radial"`
- `"spawn_curved_laser"`
- `"warningZone"`
- `"movingBlock"`
- `"laserBeam"`
- `"rotatingShape"`

使える helper:

- `helpers.createAttackEvent(kind, startTime)`
- `helpers.setBulletVisual(event, typeId, size)`
- `helpers.setLaserVisual(event, length, thickness, visualAngle)`
- `helpers.clamp(value, min, max)`
- `helpers.random01(seed)`
- `helpers.randomRange(seed, min, max)`
- `helpers.degreesToRadians(degrees)`

## サンプル

```js
export default {
  kind: "custom_spiral_radial",
  label: "螺旋ラジアル",
  description: "中心から開始角度をずらしながら円形弾を連射します。",
  color: 0xf82469,
  icon: "burst",
  fields: [
    { name: "count", label: "count", type: "number", min: 1, max: 64, step: 1, integer: true },
    { name: "bulletCount", label: "bulletCount", type: "number", min: 1, max: 128, step: 1, integer: true },
    { name: "interval", label: "interval", type: "number", min: 0, max: 5, step: 0.05 },
    { name: "speed", label: "speed", type: "number", min: 0, max: 1600, step: 5 },
    { name: "angleStep", label: "angleStep", type: "number", min: -360, max: 360, step: 1 },
    { name: "x", label: "x", type: "number", min: -1000, max: 2000, step: 1 },
    { name: "y", label: "y", type: "number", min: -1000, max: 2000, step: 1 },
    { name: "packageDuration", label: "duration", type: "number", min: 0.05, max: 30, step: 0.1 },
  ],
  defaults({ stage }) {
    return {
      count: 8,
      bulletCount: 12,
      interval: 0.16,
      speed: 250,
      angleStep: 18,
      x: stage.width / 2,
      y: stage.height / 2,
      packageDuration: 2.4,
    };
  },
  build({ pkg, helpers }) {
    const events = [];
    const count = Math.max(1, Math.round(Number(pkg.count) || 1));
    const bulletCount = Math.max(1, Math.round(Number(pkg.bulletCount) || 1));

    for (let index = 0; index < count; index += 1) {
      const event = helpers.createAttackEvent("spawn_radial", pkg.startTime + index * Number(pkg.interval || 0));

      event.name = `${pkg.name} ${index + 1}`;
      event.color = pkg.color;
      event.duration = Math.max(0.05, Number(pkg.packageDuration) || 1);
      event.originX = Number(pkg.x) || 0;
      event.originY = Number(pkg.y) || 0;
      event.aimAtPlayer = 0;
      event.radialCount = bulletCount;
      event.radialRepeat = 1;
      event.radialInterval = 0;
      event.radialStartAngle = index * Number(pkg.angleStep || 0);
      event.pathSpeed = Number(pkg.speed) || 0;
      helpers.setBulletVisual(event, 0, 7);
      events.push(event);
    }

    return events;
  },
  getDuration({ pkg }) {
    const count = Math.max(1, Math.round(Number(pkg.count) || 1));
    return Number(pkg.packageDuration || 1) + (count - 1) * Number(pkg.interval || 0);
  },
};
```

## 生成後の確認

1. `.mjs` ファイルとして保存する。
2. アプリの「追加」メニューから「コードからパッケージを追加」を選ぶ。
3. 読み込み後、追加メニューに `label` が表示されることを確認する。
4. パッケージを追加し、パッケージタブで fields が編集できることを確認する。
5. プレビューと Unity 向け書き出しで、生成された通常攻撃が既存イベントと同じように扱われることを確認する。

## 保存形式

プロジェクト書き出しでは、使用中の custom パッケージの `.mjs` ソースも JSON に同梱されます。プロジェクト読み込み時は、そのコードを実行する確認ダイアログが出ます。実行しない場合でも生成済み攻撃は保持されますが、パッケージの再生成には元の `.mjs` が必要です。
