import { isValidSliceQuery, SliceQuery } from "@depmap/types";

// Which metadata columns someone last had open in a slice table.
//
// Remembered rather than recomputed because these tables are used iteratively —
// open one, adjust, close, reopen on another gene — and re-picking the same
// columns every time is the sort of friction that stops people using a feature.
// Deliberately NOT part of the plot config: these columns describe the entities,
// not the plot, and nothing about them changes what gets drawn. Putting them in
// a frozen wire format would mean a view preference of a transient modal
// outliving every link that carried it.
//
// Keyed by (namespace, slice_type). The slice_type because a transcript's useful
// columns say nothing about a compound dose's. The namespace because two tables
// over the SAME type can still want different columns: the expansion member
// picker already spends its width on four statistics and wants metadata
// sparingly, while a table whose whole purpose is annotations wants the
// opposite. Sharing one entry made each table's default the other's surprise.
const STORAGE_KEY = "data_explorer_2_remembered_table_columns";

type StoredColumns = Record<string, SliceQuery[]>;

// Namespaces in use. A union rather than a bare string so a typo silently
// starts a fresh, permanently-empty memory at compile time instead of at
// runtime.
export type RememberedColumnsScope =
  // The "Choose transcripts…" member picker in Data Explorer.
  | "expansion-members"
  // Transcript Explorer's read-only gene annotation modal.
  | "gene-transcripts";

const entryKey = (scope: RememberedColumnsScope, slice_type: string) =>
  `${scope}/${slice_type}`;

function readAll(): StoredColumns {
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    const parsed = json ? JSON.parse(json) : {};

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    // Corrupt or unavailable storage must not take the modal down with it.
    // Losing a column preference is not worth an error.
    return {};
  }
}

// Null when nothing has ever been stored for this scope, as distinct from an
// empty array, which means someone deliberately closed every column. Callers
// with a default set of columns need to tell those apart — otherwise clearing
// the last column brings the default back on reopen, which reads as the table
// refusing to be closed.
export function loadRememberedColumns(
  scope: RememberedColumnsScope,
  slice_type: string
): SliceQuery[] | null {
  const stored = readAll()[entryKey(scope, slice_type)];

  if (!Array.isArray(stored)) {
    return null;
  }

  // Validated on the way out rather than on the way in: what was a well-formed
  // slice when it was saved can stop being one when a dataset is retired, and
  // that shouldn't wedge the table for whoever saved it.
  return stored.filter(isValidSliceQuery);
}

export function rememberColumns(
  scope: RememberedColumnsScope,
  slice_type: string,
  slices: SliceQuery[]
) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readAll(), [entryKey(scope, slice_type)]: slices })
    );
  } catch (e) {
    // Private browsing, a full quota — nothing worth interrupting anyone over.
  }
}
