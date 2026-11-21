// Fast csv-reader 1.0.0 drop-in: readCsv semantics, written from scratch.
// Single pass over the text. Lines with no quote and no stray CR take a
// fast path (indexOf-driven splits); quoted / broken fields take a slow path
// that mirrors the reference policy exactly.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and its index in rows.
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Read an unquoted field starting at pos, appending onto `value`.
  // Returns { value, ended, added } where added counts kept characters.
  function readUnquoted(value) {
    let added = 0;
    for (;;) {
      // Next delimiter: comma or LF, whichever comes first.
      let comma = text.indexOf(',', pos);
      let nl = text.indexOf('\n', pos);
      if (comma === -1) comma = n + 1;
      if (nl === -1) nl = n + 1;
      let end = comma < nl ? comma : nl;
      // A CR before that delimiter: if it is the CRLF pair it ends the
      // field; otherwise it is a stray CR (dropped, error, keep going).
      const cr = text.indexOf('\r', pos);
      if (cr !== -1 && cr < end) {
        if (text.charCodeAt(cr + 1) === 10) {
          if (cr > pos) {
            value += text.slice(pos, cr);
            added += cr - pos;
          }
          pos = cr + 2;
          line += 1;
          return { value, ended: LINE_BREAK, added };
        }
        if (cr > pos) {
          value += text.slice(pos, cr);
          added += cr - pos;
        }
        error('stray_cr');
        pos = cr + 1;
        continue;
      }
      if (end > n) end = n;
      if (end > pos) {
        value += text.slice(pos, end);
        added += end - pos;
      }
      pos = end;
      if (pos >= n) return { value, ended: END, added };
      if (text.charCodeAt(pos) === 44) {
        pos += 1;
        return { value, ended: COMMA, added };
      }
      // Must be '\n'.
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK, added };
    }
  }

  // Read a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    // Pass 1: find the closing quote, skipping doubled quotes.
    let scan = pos;
    let segStart = pos;
    let parts = null; // segments + one '"' per doubled quote, when any
    let closed = -1;
    for (;;) {
      const q = text.indexOf('"', scan);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === 34) {
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, q), '"');
        scan = q + 2;
        segStart = q + 2;
        continue;
      }
      closed = q;
      break;
    }
    if (closed === -1) {
      // Never closes: literal quote, text after it re-read as unquoted.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }
    let value;
    // Does the quoted region hold any CR or LF? If so, rebuild it
    // char-wise (rare): CRLF / lone CR each become one LF, lines counted.
    if (text.indexOf('\r', pos) !== -1 && text.indexOf('\r', pos) < closed ||
        text.indexOf('\n', pos) !== -1 && text.indexOf('\n', pos) < closed) {
      let v = '';
      for (let i = pos; i < closed; i++) {
        const c = text.charCodeAt(i);
        if (c === 34) {
          v += '"';
          i += 1; // skip the doubled quote's second half
        } else if (c === 13) {
          v += '\n';
          line += 1;
          if (text.charCodeAt(i + 1) === 10) i += 1;
        } else {
          if (c === 10) line += 1;
          v += text[i];
        }
      }
      value = v;
    } else if (parts === null) {
      value = text.slice(pos, closed);
    } else {
      parts.push(text.slice(segStart, closed));
      value = parts.join('');
    }
    pos = closed + 1;
    if (pos >= n) return { value, ended: END };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // Junk after the closing quote, appended as it stands.
    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: the rest of this line holds no quote and no stray CR.
    const lineEnd0 = text.indexOf('\n', pos);
    const lineEnd = lineEnd0 === -1 ? n : lineEnd0;
    const q = text.indexOf('"', pos);
    const cr = text.indexOf('\r', pos);
    const fast =
      (q === -1 || q >= lineEnd) &&
      (cr === -1 || cr >= lineEnd ||
        (cr === lineEnd - 1 && lineEnd < n));
    if (fast) {
      const fieldEnd = cr === lineEnd - 1 && lineEnd < n ? lineEnd - 1 : lineEnd;
      const fields = text.slice(pos, fieldEnd).split(',');
      pos = lineEnd < n ? lineEnd + 1 : n;
      line += 1;
      // A line that held only stray CRs is no record (cannot happen on
      // the fast path except the CRLF-only line, which yields ['']).
      if (fields.length === 1 && fields[0] === '') continue;
      if (width < 0) width = fields.length;
      if (header && columns === null) {
        columns = fields;
        continue;
      }
      if (fields.length < width) {
        errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
        while (fields.length < width) fields.push('');
      } else if (fields.length > width) {
        errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
      }
      rows.push(fields);
      continue;
    }

    // Slow path: parse field by field.
    const fields = [];
    let field;
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
