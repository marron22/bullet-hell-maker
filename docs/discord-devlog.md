# Discord 開発日誌投稿

開発日誌は `.md` ファイルを作らず、その場で本文を渡して投稿します。Webhook URL はリポジトリに保存せず、環境変数で渡します。

```powershell
$env:DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/..."
$env:DISCORD_THREAD_URL = "https://discord.com/channels/.../..."
npm run devlog:discord -- --title "開発日誌 v0.28" --message "今回の更新内容をここに書きます。"
```

長い本文を環境変数で渡す場合:

```powershell
$env:DISCORD_DEVLOG_MESSAGE = "今回の更新内容をここに書きます。"
npm run devlog:discord -- --title "開発日誌 v0.28"
```

標準入力から渡す場合:

```powershell
"今回の更新内容をここに書きます。" | npm run devlog:discord -- --title "開発日誌 v0.28" --stdin
```

投稿前に内容だけ確認したい場合は `--dry-run` を付けます。過去ログをファイルから投稿したい場合だけ `--file` も使えます。
