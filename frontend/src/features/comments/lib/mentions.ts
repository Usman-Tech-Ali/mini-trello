/** Names can contain spaces ("Sara Khan"), so a query may too, but not a line break or "@". */
const MENTION_QUERY = /(?:^|\s)@([^@\n]{0,40})$/;

export interface MentionQuery {
  /** Index of the "@". */
  start: number;
  /** What was typed after the "@". */
  query: string;
}

/** The "@…" being typed just before the caret, if any. */
export function activeMentionQuery(text: string, caret: number): MentionQuery | null {
  const match = MENTION_QUERY.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[1] ?? '';
  return { start: caret - query.length - 1, query };
}

/** Members whose name matches the query (start of any word), best matches first. */
export function matchMembers<T extends { name: string }>(
  members: readonly T[],
  query: string,
  limit = 6,
): T[] {
  const needle = query.trim().toLowerCase();
  const score = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith(needle)) return 0;
    if (lower.split(/\s+/).some((word) => word.startsWith(needle))) return 1;
    return -1;
  };
  return members
    .map((member) => ({ member, rank: score(member.name) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.member.name.localeCompare(b.member.name))
    .slice(0, limit)
    .map(({ member }) => member);
}

/** Replaces the "@query" before the caret with "@Name " and returns the new text and caret. */
export function insertMention(
  text: string,
  mention: MentionQuery,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const inserted = `@${name} `;
  return {
    text: text.slice(0, mention.start) + inserted + text.slice(caret),
    caret: mention.start + inserted.length,
  };
}

export type BodySegment = { text: string; mention: boolean };

/** Splits a comment body so each "@Name" of a mentioned member can be highlighted. */
export function splitMentions(body: string, names: readonly string[]): BodySegment[] {
  const unique = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (unique.length === 0) return [{ text: body, mention: false }];
  const escaped = unique.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // With one capture group, split() alternates: text, mention, text, mention, …
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`);
  return body
    .split(pattern)
    .map((text, index) => ({ text, mention: index % 2 === 1 }))
    .filter((segment) => segment.text !== '');
}
