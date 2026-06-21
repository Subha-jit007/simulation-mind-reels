import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Transcript, TranscriptMeta, SearchHit } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Package root is one level above dist/ (or src/ in dev). */
const PACKAGE_ROOT = path.resolve(__dirname, "..");

/** Markdown extensions we treat as transcripts. */
const TRANSCRIPT_EXTS = new Set([".md", ".markdown", ".txt"]);

/**
 * Directory transcripts are read from.
 * Override with the CHATVAULT_DIR environment variable (absolute path recommended).
 * Defaults to <package-root>/transcripts so the bundled seed transcript works out of the box.
 */
export function transcriptsDir(): string {
  const fromEnv = process.env.CHATVAULT_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(PACKAGE_ROOT, "transcripts");
}

/** Turn a filename into a stable id (slug of the basename without extension). */
function idFromFile(file: string): string {
  return path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface ParsedFrontmatter {
  title?: string;
  date?: string;
  tags: string[];
  body: string;
}

/** Minimal YAML-ish frontmatter parser: supports title, date, and tags (list or comma string). */
function parseFrontmatter(raw: string): ParsedFrontmatter {
  const result: ParsedFrontmatter = { tags: [], body: raw };
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return result;

  result.body = raw.slice(match[0].length);
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    let value = kv[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key === "title") result.title = value;
    else if (key === "date") result.date = value;
    else if (key === "tags") {
      const inner = value.replace(/^\[|\]$/g, "");
      result.tags = inner
        .split(",")
        .map((t) => t.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
  }
  return result;
}

/** Best-effort count of conversation turns in a transcript body. */
function countMessages(body: string): number {
  const patterns = [
    /^\s*#{1,6}\s*(user|human|you|assistant|claude|model|ai)\b/gim,
    /^\s*\*{0,2}(user|human|assistant|claude)\*{0,2}\s*:/gim,
  ];
  let best = 0;
  for (const re of patterns) {
    const n = (body.match(re) || []).length;
    if (n > best) best = n;
  }
  return best;
}

async function readTranscriptFile(file: string): Promise<Transcript> {
  const full = path.join(transcriptsDir(), file);
  const raw = await fs.readFile(full, "utf8");
  const fm = parseFrontmatter(raw);
  const body = fm.body.trimStart();
  const niceName = path
    .basename(file, path.extname(file))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: idFromFile(file),
    title: fm.title || niceName,
    date: fm.date,
    tags: fm.tags,
    chars: body.length,
    messages: countMessages(body),
    file,
    body,
  };
}

/** List all transcript metadata (no bodies), sorted by date desc then title. */
export async function listTranscripts(): Promise<TranscriptMeta[]> {
  const dir = transcriptsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const files = entries.filter((f) => TRANSCRIPT_EXTS.has(path.extname(f).toLowerCase()));
  const metas = await Promise.all(
    files.map(async (f) => {
      const t = await readTranscriptFile(f);
      const { body, ...meta } = t;
      void body;
      return meta;
    })
  );

  return metas.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** Resolve a transcript by id (case-insensitive). Returns null if not found. */
export async function getTranscript(id: string): Promise<Transcript | null> {
  const want = id.toLowerCase();
  const dir = transcriptsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  for (const f of entries) {
    if (!TRANSCRIPT_EXTS.has(path.extname(f).toLowerCase())) continue;
    if (idFromFile(f) === want) return readTranscriptFile(f);
  }
  return null;
}

/** Case-insensitive keyword search across all transcripts. */
export async function searchTranscripts(
  query: string,
  maxSnippetsPerHit = 3
): Promise<SearchHit[]> {
  const dir = transcriptsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const needle = query.toLowerCase();
  const hits: SearchHit[] = [];

  for (const f of entries) {
    if (!TRANSCRIPT_EXTS.has(path.extname(f).toLowerCase())) continue;
    const t = await readTranscriptFile(f);
    const hay = t.body.toLowerCase();

    let count = 0;
    let from = 0;
    const snippets: string[] = [];
    while (true) {
      const idx = hay.indexOf(needle, from);
      if (idx === -1) break;
      count++;
      if (snippets.length < maxSnippetsPerHit) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(t.body.length, idx + needle.length + 60);
        let snip = t.body.slice(start, end).replace(/\s+/g, " ").trim();
        if (start > 0) snip = "…" + snip;
        if (end < t.body.length) snip = snip + "…";
        snippets.push(snip);
      }
      from = idx + needle.length;
    }

    if (count > 0) {
      hits.push({ id: t.id, title: t.title, matches: count, snippets });
    }
  }

  return hits.sort((a, b) => b.matches - a.matches);
}
