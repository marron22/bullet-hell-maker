# ESP32-S3 Serial Controller

弾幕メーカーのプレビューモードへ Web Serial API で入力を送るための PlatformIO プロジェクトです。

## 配線

各スイッチは `GPIO` と `GND` の間につなぎます。ファーム側で `INPUT_PULLUP` を使うため、押していないときは HIGH、押したときは LOW になります。

| 操作 | 既定GPIO |
| --- | --- |
| J-Stik 上 | GPIO4 |
| J-Stik 下 | GPIO5 |
| J-Stik 左 | GPIO6 |
| J-Stik 右 | GPIO7 |
| OBSF-30 ダッシュ | GPIO8 |

Ultimarc J-Stik はマイクロスイッチ式なので、各方向の NO 端子を GPIO、COM 端子を GND に接続してください。OBSF-30 も同様に、片側を GPIO8、もう片側を GND に接続します。

## 書き込み

VS Code の PlatformIO 拡張で `firmware/esp32-s3-serial-controller` を開き、`Build` / `Upload` を実行します。

シリアル速度は `115200bps` です。ファームは以下の JSON Lines を約 60fps で送ります。

```json
{"x":0,"y":-1,"dash":false}
```

ブラウザ側ではプレビューモードに入り、上部の `Serial接続` から ESP32-S3 のポートを選びます。
