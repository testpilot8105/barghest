// Split a document's text into passages of about 300 tokens, on paragraph and sentence boundaries, keeping the
// character offsets so a passage can be highlighted in its source. Deterministic. A document collection is never
// sent to the model whole; every passage goes through extraction on its own.

const TARGET_TOKENS = 300;
const CHARS_PER_TOKEN = 4; // a fair estimate for English and Filipino prose and for tabular lines
const TARGET = TARGET_TOKENS * CHARS_PER_TOKEN;
const MIN_TAIL = 200; // a trailing fragment shorter than this joins the passage before it

/** @returns {Array<{ index: number, text: string, charStart: number, charEnd: number }>} */
export function splitPassages(text) {
  const units = [];
  // Paragraphs first (a blank line ends one). A paragraph that is too long is cut on its own lines, so table rows,
  // chat lines and JSON rows each stay a unit whether or not they end in a full stop; only a single line that is
  // still too long is cut on sentences, with the trailing fragment kept.
  const paraRe = /[^\n]+(?:\n(?!\n)[^\n]+)*/g;
  const lineRe = /[^\n]+/g;
  const sentRe = /[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g;
  let m;
  while ((m = paraRe.exec(text)) !== null) {
    const start = m.index;
    const para = m[0];
    if (para.length <= TARGET) {
      units.push({ start, end: start + para.length });
      continue;
    }
    let l;
    lineRe.lastIndex = 0;
    while ((l = lineRe.exec(para)) !== null) {
      const lineStart = start + l.index;
      const line = l[0];
      if (!line.trim()) continue;
      if (line.length <= TARGET) {
        units.push({ start: lineStart, end: lineStart + line.length });
        continue;
      }
      let s;
      sentRe.lastIndex = 0;
      while ((s = sentRe.exec(line)) !== null) {
        if (!s[0].trim()) continue;
        units.push({ start: lineStart + s.index, end: lineStart + s.index + s[0].length });
      }
    }
  }

  const passages = [];
  let current = null;
  for (const u of units) {
    if (!current) {
      current = { start: u.start, end: u.end };
      continue;
    }
    if (u.end - current.start <= TARGET) current.end = u.end;
    else {
      passages.push(current);
      current = { start: u.start, end: u.end };
    }
  }
  if (current) {
    if (passages.length && current.end - current.start < MIN_TAIL) passages[passages.length - 1].end = current.end;
    else passages.push(current);
  }

  return passages
    .map((p) => ({ charStart: p.start, charEnd: p.end, text: text.slice(p.start, p.end).trim() }))
    .filter((p) => p.text.length > 0)
    .map((p, index) => ({ index, ...p }));
}

export function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
