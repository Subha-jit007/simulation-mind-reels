# chatvault-mcp-server

A tiny **local MCP server** that serves saved chat transcripts (markdown files) to any MCP
client over stdio — **Claude Code**, **Codex CLI**, Claude Desktop, Cursor, MCP Inspector, etc.

The point: take a whole conversation (like the simulation/consciousness chat that ships with
this) and **pull it into your coding terminal as context** with a single tool call or an
`@`-mention — instead of copy-pasting walls of text.

It comes pre-seeded with one transcript (`simulation-philosophy`) so it works the moment you
install it. Drop more `.md` files into the `transcripts/` folder to add your own.

---

## What it exposes

**Tools**
| Tool | What it does |
|------|--------------|
| `chatvault_list_transcripts` | List every transcript with id, title, date, tags, size, ~msg count |
| `chatvault_get_transcript` | Fetch the full text of one transcript by id (auto-paginates if huge) |
| `chatvault_search_transcripts` | Keyword search across all transcripts, returns ranked snippets |

**Resources**
- `chatvault://transcript/{id}` — each transcript is also a resource, so clients that surface
  resources (Claude Code's `@` menu) can attach a whole conversation directly.

---

## Setup

### 1. Build it

```bash
cd chatvault-mcp-server
npm install        # also builds via the prepare hook
npm run build      # (safe to run again)
```

This produces `dist/index.js`, the server entry point.

### 2. Note the absolute path

stdio servers must be referenced by **absolute path**. Get it:

```bash
pwd
# e.g. /home/tapas/chatvault-mcp-server  -> entry is /home/tapas/chatvault-mcp-server/dist/index.js
```

### 3a. Wire it into **Claude Code**

```bash
# from anywhere; replace the path with YOUR absolute path
claude mcp add --transport stdio chatvault -- node /ABSOLUTE/PATH/TO/chatvault-mcp-server/dist/index.js
```

Useful variants (flags go **before** the name, `--` separates the launch command):

```bash
# available in every project, not just this one
claude mcp add --transport stdio --scope user chatvault -- node /ABS/PATH/dist/index.js

# point the vault at a different folder of transcripts
claude mcp add --transport stdio --env CHATVAULT_DIR=/ABS/PATH/to/my/transcripts chatvault \
  -- node /ABS/PATH/dist/index.js
```

Then inside Claude Code, run `/mcp` to confirm `chatvault` is connected. Ask it to
"list chatvault transcripts" or "load the simulation-philosophy transcript", or type `@` and
pick the transcript resource.

### 3b. Wire it into **Codex CLI**

Codex is stdio-only, so the same server works. Easiest:

```bash
codex mcp add chatvault -- node /ABSOLUTE/PATH/TO/chatvault-mcp-server/dist/index.js
```

Or edit `~/.codex/config.toml` directly:

```toml
[mcp_servers.chatvault]
command = "node"
args = ["/ABSOLUTE/PATH/TO/chatvault-mcp-server/dist/index.js"]
# optional: point at a different transcripts folder
# env = { CHATVAULT_DIR = "/ABS/PATH/to/my/transcripts" }
```

Start a Codex session and run `/mcp` to verify.

### 3c. Claude Desktop / Cursor (JSON config)

```json
{
  "mcpServers": {
    "chatvault": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/chatvault-mcp-server/dist/index.js"]
    }
  }
}
```

---

## Adding your own transcripts

Just drop a `.md` (or `.markdown`/`.txt`) file into `transcripts/`. The filename becomes the id
(`my-great-chat.md` → id `my-great-chat`).

Optional frontmatter sets the title, date, and tags:

```markdown
---
title: My Great Chat
date: 2026-06-20
tags: [research, planning]
---

## User
...your message...

## Assistant
...the reply...
```

No frontmatter is fine too — the title is derived from the filename. To keep your transcripts
somewhere else (e.g. a synced notes folder), set the `CHATVAULT_DIR` env var to that path.

---

## Test it without a client (MCP Inspector)

```bash
npx @modelcontextprotocol/inspector node /ABS/PATH/dist/index.js
```

---

## Troubleshooting

- **Server shows as failed / "connection closed":** run the launch command directly first —
  `node /ABS/PATH/dist/index.js` — and watch stderr. It should print
  `chatvault-mcp-server running (stdio). Vault: ...`. Fix any error there.
- **Always use absolute paths** in the client config; relative paths resolve against the
  client's working directory, not yours.
- **No transcripts listed:** check the `Vault:` path the server logs on startup actually
  contains your `.md` files (or set `CHATVAULT_DIR`).
- **stdout must stay clean:** this server only prints logs to stderr. If you fork it, never
  `console.log` — stdout is the JSON-RPC channel.
- **Windows + npx servers** need a `cmd /c` wrapper, but this server launches with plain
  `node`, so that doesn't apply here.

---

## How it's built

- TypeScript, strict mode, ESM (`Node16` module resolution).
- `@modelcontextprotocol/sdk` with the modern `registerTool` / `registerResource` API.
- Zod for input validation; read-only tools with proper annotations.
- stdio transport (works for both Claude Code and Codex; no network, no auth).
- Zero external services — it just reads markdown from a folder.

MIT licensed. Fork it, point it at your Obsidian vault, add a `tags` filter, whatever you need.
