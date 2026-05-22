# Discord 開発日誌投稿

開発日誌は Webhook URL をリポジトリに保存せず、環境変数で渡して投稿します。

```powershell
$env:DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/..."
$env:DISCORD_THREAD_URL = "https://discord.com/channels/.../..."
npm run devlog:discord -- --file docs/devlog/v0.25.md
```

スレッド ID を直接渡す場合:

```powershell
npm run devlog:discord -- --file docs/devlog/v0.25.md --thread-id 1507207720254574605
```

投稿前に内容だけ確認したい場合は `--dry-run` を付けます。
