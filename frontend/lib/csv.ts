export interface CsvDocument {
  headers: string[];
  rows: string[][];
  truncated: boolean;
  totalRowCount: number;
}

/** Table view renders at most this many data rows (FR-011/FR-012); files with
 * more rows are truncated with a notice rather than rendered unbounded. */
export const MAX_TABLE_ROWS = 5000;

/** Splits raw CSV text into rows of fields, honoring RFC 4180 double-quote
 * escaping: a quoted field may contain commas or newlines, and `""` inside a
 * quoted field decodes to a literal `"`. */
function splitRows(text: string): string[][] {
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
    } else if (char === ",") {
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

  const [headers = [], ...allRows] = splitRows(text);
  const totalRowCount = allRows.length;
  const truncated = totalRowCount > MAX_TABLE_ROWS;
  const rows = truncated ? allRows.slice(0, MAX_TABLE_ROWS) : allRows;

  return { headers, rows, truncated, totalRowCount };
}
