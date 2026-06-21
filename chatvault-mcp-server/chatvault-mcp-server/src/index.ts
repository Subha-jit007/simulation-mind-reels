#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  listTranscripts,
  getTranscript,
  searchTranscripts,
  transcriptsDir,
} from "./store.js";

/** Max characters returned by a single get_transcript call before pagination kicks in. */
const CHARACTER_LIMIT = 50_000;

const server = new McpServer({
  name: "chatvault-mcp-server",
  version: "1.0.0",
});

// --------------------------------------------------------------------------
// Tool: list transcripts
// --------------------------------------------------------------------------
server.registerTool(
  "chatvault_list_transcripts",
  {
    title: "List Chat Transcripts",
    description: `List all saved chat transcripts available in the vault.

Returns metadata only (no full bodies): id, title, date, tags, character count, and an
approximate message count. Use the returned 'id' with chatvault_get_transcript to pull the
full text of a specific conversation.

Args: none.

Returns JSON: {
  "dir": string,                 // directory transcripts are read from
  "count": number,               // number of transcripts found
  "transcripts": [
    { "id": string, "title": string, "date": string|null,
      "tags": string[], "chars": number, "messages": number, "file": string }
  ]
}

If the vault is empty, 'count' is 0 and 'transcripts' is []. Drop a .md file into the
vault directory to add one.`,
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    const metas = await listTranscripts();
    const output = {
      dir: transcriptsDir(),
      count: metas.length,
      transcripts: metas.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date ?? null,
        tags: m.tags,
        chars: m.chars,
        messages: m.messages,
        file: m.file,
      })),
    };

    const lines =
      metas.length === 0
        ? [`No transcripts found in ${output.dir}. Add a .md file to populate the vault.`]
        : [
            `${metas.length} transcript(s) in ${output.dir}:`,
            "",
            ...metas.map(
              (m) =>
                `• ${m.id} — "${m.title}"` +
                (m.date ? ` (${m.date})` : "") +
                ` · ${m.chars} chars · ~${m.messages} msgs` +
                (m.tags.length ? ` · [${m.tags.join(", ")}]` : "")
            ),
          ];

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: output,
    };
  }
);

// --------------------------------------------------------------------------
// Tool: get transcript
// --------------------------------------------------------------------------
server.registerTool(
  "chatvault_get_transcript",
  {
    title: "Get Chat Transcript",
    description: `Fetch the full text of one saved chat transcript by id.

This is the tool to use to "load a whole conversation into context." Get the id first from
chatvault_list_transcripts (or chatvault_search_transcripts).

Large transcripts are paginated by character offset to stay within context limits. If the
response is truncated, call again with 'offset' set to the returned 'next_offset'.

Args:
  - id (string, required): transcript id, e.g. "simulation-philosophy" (case-insensitive).
  - offset (number, optional): character offset to start from (default 0).

Returns JSON: {
  "id": string, "title": string, "date": string|null, "tags": string[],
  "total_chars": number,          // full length of the transcript body
  "offset": number,               // start offset of this chunk
  "chunk": string,                // the transcript text for this chunk
  "truncated": boolean,           // true if more remains
  "next_offset": number|null      // pass this back as 'offset' to continue
}

Errors: returns a message listing valid ids if 'id' is not found.`,
    inputSchema: {
      id: z
        .string()
        .min(1, "id is required")
        .describe('Transcript id, e.g. "simulation-philosophy" (from chatvault_list_transcripts)'),
      offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Character offset to start from for pagination (default 0)"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ id, offset }) => {
    const t = await getTranscript(id);
    if (!t) {
      const metas = await listTranscripts();
      const valid = metas.map((m) => m.id).join(", ") || "(none)";
      return {
        content: [
          {
            type: "text",
            text: `No transcript with id "${id}". Valid ids: ${valid}. Use chatvault_list_transcripts to see all.`,
          },
        ],
        isError: true,
      };
    }

    const start = Math.min(offset, t.chars);
    const end = Math.min(start + CHARACTER_LIMIT, t.chars);
    const chunk = t.body.slice(start, end);
    const truncated = end < t.chars;

    const output = {
      id: t.id,
      title: t.title,
      date: t.date ?? null,
      tags: t.tags,
      total_chars: t.chars,
      offset: start,
      chunk,
      truncated,
      next_offset: truncated ? end : null,
    };

    const header =
      `# ${t.title}` +
      (t.date ? ` (${t.date})` : "") +
      (truncated
        ? `\n\n[showing chars ${start}-${end} of ${t.chars}; call again with offset=${end} for more]\n\n`
        : "\n\n");

    return {
      content: [{ type: "text", text: header + chunk }],
      structuredContent: output,
    };
  }
);

// --------------------------------------------------------------------------
// Tool: search transcripts
// --------------------------------------------------------------------------
server.registerTool(
  "chatvault_search_transcripts",
  {
    title: "Search Chat Transcripts",
    description: `Keyword search across all saved transcripts (case-insensitive substring match).

Use this to find which conversation discussed a topic before pulling it with
chatvault_get_transcript. Returns ranked hits with short context snippets.

Args:
  - query (string, required): text to search for, e.g. "simulation" or "ego".
  - limit (number, optional): max transcripts to return (default 10).

Returns JSON: {
  "query": string,
  "count": number,                // number of matching transcripts
  "results": [
    { "id": string, "title": string, "matches": number, "snippets": string[] }
  ]
}

Results are sorted by match count (most relevant first). Empty 'results' means no match.`,
    inputSchema: {
      query: z
        .string()
        .min(2, "query must be at least 2 characters")
        .max(200, "query must not exceed 200 characters")
        .describe('Text to search for across transcripts, e.g. "ego" or "upper beings"'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum number of matching transcripts to return (default 10)"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ query, limit }) => {
    const all = await searchTranscripts(query);
    const results = all.slice(0, limit);

    const output = {
      query,
      count: results.length,
      results,
    };

    const lines =
      results.length === 0
        ? [`No transcripts matched "${query}".`]
        : [
            `${all.length} transcript(s) matched "${query}"` +
              (all.length > results.length ? ` (showing ${results.length}):` : ":"),
            "",
            ...results.flatMap((r) => [
              `• ${r.id} — "${r.title}" (${r.matches} match${r.matches === 1 ? "" : "es"})`,
              ...r.snippets.map((s) => `    ${s}`),
            ]),
          ];

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: output,
    };
  }
);

// --------------------------------------------------------------------------
// Resources: expose each transcript at chatvault://transcript/{id}
// Lets clients that surface resources (e.g. Claude Code @-mentions) attach a
// whole conversation directly, without an explicit tool call.
// --------------------------------------------------------------------------
server.registerResource(
  "transcript",
  new ResourceTemplate("chatvault://transcript/{id}", {
    list: async () => {
      const metas = await listTranscripts();
      return {
        resources: metas.map((m) => ({
          uri: `chatvault://transcript/${m.id}`,
          name: m.title,
          description:
            `Saved chat transcript "${m.title}"` +
            (m.date ? ` from ${m.date}` : "") +
            ` (${m.chars} chars, ~${m.messages} msgs)`,
          mimeType: "text/markdown",
        })),
      };
    },
  }),
  {
    title: "Chat Transcript",
    description: "A saved chat transcript, addressable by id.",
    mimeType: "text/markdown",
  },
  async (uri, variables) => {
    const rawId = variables.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const t = await getTranscript(String(id));
    if (!t) {
      throw new Error(`No transcript with id "${String(id)}"`);
    }
    const front = `# ${t.title}\n` + (t.date ? `_${t.date}_\n` : "") + "\n";
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: front + t.body,
        },
      ],
    };
  }
);

// --------------------------------------------------------------------------
// Boot (stdio transport — works with Claude Code, Codex CLI, MCP Inspector)
// --------------------------------------------------------------------------
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs must go to stderr; stdout is reserved for the JSON-RPC protocol.
  console.error(`chatvault-mcp-server running (stdio). Vault: ${transcriptsDir()}`);
}

main().catch((err) => {
  console.error("Fatal error starting chatvault-mcp-server:", err);
  process.exit(1);
});
