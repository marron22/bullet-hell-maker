import { readFile } from "node:fs/promises";

const args = parseArgs(process.argv.slice(2));
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const threadId = args.threadId ?? parseDiscordThreadId(args.threadUrl ?? process.env.DISCORD_THREAD_URL) ?? process.env.DISCORD_THREAD_ID;
const content = await resolveContent(args);

if (!content.trim()) {
  throw new Error("Devlog content is empty.");
}

const payload = {
  content: content.trim(),
  allowed_mentions: {
    parse: [],
  },
};

if (args.dryRun) {
  console.log(JSON.stringify({ threadId: threadId ?? null, payload }, null, 2));
  process.exit(0);
}

if (!webhookUrl) {
  throw new Error("DISCORD_WEBHOOK_URL is required.");
}

const postUrl = buildWebhookUrl(webhookUrl, threadId);
const response = await fetch(postUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const detail = await response.text();
  throw new Error(`Discord webhook failed: ${response.status} ${response.statusText} ${detail}`);
}

const result = await response.json();
console.log(`Posted Discord devlog message ${result.id ?? "(no id)"} to channel ${result.channel_id ?? "(unknown)"}.`);

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--file") {
      parsed.file = requireValue(argv, ++index, arg);
    } else if (arg === "--message") {
      parsed.message = requireValue(argv, ++index, arg);
    } else if (arg === "--message-env") {
      parsed.messageEnv = requireValue(argv, ++index, arg);
    } else if (arg === "--stdin") {
      parsed.stdin = true;
    } else if (arg === "--title") {
      parsed.title = requireValue(argv, ++index, arg);
    } else if (arg === "--thread-id") {
      parsed.threadId = requireValue(argv, ++index, arg);
    } else if (arg === "--thread-url") {
      parsed.threadUrl = requireValue(argv, ++index, arg);
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

async function resolveContent(parsed) {
  const bodySources = [parsed.file, parsed.message, parsed.messageEnv, parsed.stdin].filter(Boolean).length;

  if (bodySources > 1) {
    throw new Error("Use only one of --message, --message-env, --stdin, or --file.");
  }

  const body = parsed.file
    ? await readFile(parsed.file, "utf8")
    : parsed.stdin
      ? await readFile(0, "utf8")
      : parsed.messageEnv
        ? process.env[parsed.messageEnv] ?? ""
        : parsed.message ?? process.env.DISCORD_DEVLOG_MESSAGE ?? "";

  if (!parsed.title) {
    return body;
  }

  return `## ${parsed.title}\n${body}`;
}

function buildWebhookUrl(rawUrl, targetThreadId) {
  const url = new URL(rawUrl);
  url.searchParams.set("wait", "true");

  if (targetThreadId) {
    url.searchParams.set("thread_id", targetThreadId);
  }

  return url;
}

function parseDiscordThreadId(threadUrl) {
  if (!threadUrl) {
    return null;
  }

  const url = new URL(threadUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[2] ?? null;
}

function requireValue(argv, index, option) {
  const value = argv[index];

  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}
