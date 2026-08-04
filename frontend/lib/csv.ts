export interface CsvDocument {
  headers: string[];
  rows: string[][];
  truncated: boolean;
  totalRowCount: number;
}

/** Table view renders at most this many data rows (FR-011/FR-012); files with
 * more rows are truncated with a notice rather than rendered unbounded. */
export const MAX_TABLE_ROWS = 5000;

const CANDIDATE_DELIMITERS = [",", ";", "\t"] as const;

/** Picks the delimiter that occurs most often (outside quoted fields) in the
 * header line, so files exported with `;` (common in European locales) or
 * tabs render as columns instead of one giant first field. Defaults to `,`
 * when nothing else appears. */
function detectDelimiter(headerLine: string): string {
  let best = ",";
  let bestCount = 0;
  let inQuotes = false;
  const counts = new Map<string, number>(CANDIDATE_DELIMITERS.map((d) => [d, 0]));

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && counts.has(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }

  for (const [delimiter, count] of counts) {
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
}

/** Splits raw CSV text into rows of fields, honoring RFC 4180 double-quote
 * escaping: a quoted field may contain the delimiter or newlines, and `""`
 * inside a quoted field decodes to a literal `"`. */
function splitRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // Skip; a following "\n" (if any) ends the row.
    } else {
      field += char;
    }
  }

  // Flush the final field/row for input not ending in a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseCsv(text: string): CsvDocument {
  if (text === "") {
    return { headers: [], rows: [], truncated: false, totalRowCount: 0 };
  }

  const headerLineEnd = text.indexOf("\n");
  const delimiter = detectDelimiter(headerLineEnd === -1 ? text : text.slice(0, headerLineEnd));

  const [headers = [], ...allRows] = splitRows(text, delimiter);
  const totalRowCount = allRows.length;
  const truncated = totalRowCount > MAX_TABLE_ROWS;
  const rows = truncated ? allRows.slice(0, MAX_TABLE_ROWS) : allRows;

  return { headers, rows, truncated, totalRowCount };
}
