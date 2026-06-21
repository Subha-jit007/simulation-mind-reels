export interface TranscriptMeta {
  /** Stable id derived from the filename (without extension). */
  id: string;
  /** Human-readable title (from frontmatter `title:` or derived from filename). */
  title: string;
  /** Optional ISO-ish date string from frontmatter. */
  date?: string;
  /** Tags from frontmatter. */
  tags: string[];
  /** Total character count of the body (excluding frontmatter). */
  chars: number;
  /** Best-effort count of conversation turns detected in the body. */
  messages: number;
  /** Source filename. */
  file: string;
}

export interface Transcript extends TranscriptMeta {
  /** Full body text (frontmatter stripped). */
  body: string;
}

export interface SearchHit {
  id: string;
  title: string;
  /** Number of times the query matched in this transcript. */
  matches: number;
  /** Short context snippets around the first few matches. */
  snippets: string[];
}
