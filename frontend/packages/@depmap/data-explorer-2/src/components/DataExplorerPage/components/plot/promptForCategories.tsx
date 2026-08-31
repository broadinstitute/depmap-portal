import React, { useMemo, useRef, useState } from "react";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import ReactTable, {
  ColumnDef,
  ReactTableHandle,
  RowSelectionState,
  SearchBar,
} from "@depmap/react-table";
import { compareNaturally } from "@depmap/utils";
import {
  HARD_MAX_CATEGORIES,
  SOFT_MAX_CATEGORIES,
} from "../../../../constants/plotConstants";
import {
  scoreCategories,
  selectBestCategories,
} from "../../../../utils/bestCategories";
import HelpTip from "../HelpTip";
import styles from "../../styles/DataExplorer2.scss";

// Referenced by the initial sort, so the column is named rather than relying
// on the id TanStack would derive from its accessor. The header reads "Score";
// this is the underlying field.
const SCORE_COLUMN_ID = "score";

// The only column worth searching. The others are computed statistics, where a
// substring match is an accident rather than a lookup — typing "2" to find a
// category would stop at every score containing a 2 on the way there.
const CATEGORY_COLUMN_ID = "category";
const SEARCHABLE_COLUMN_IDS = [CATEGORY_COLUMN_ID];

interface CategoryRow {
  category: string;
  count: number;
  score: number;
  meanX?: number;
  meanY?: number;
}

function formatStat(value: number | undefined) {
  if (value === undefined) {
    return "—";
  }

  if (!Number.isFinite(value)) {
    // Perfect separation. Reads better than "Infinity" in a table cell, and is
    // reachable on a binary axis.
    return "∞";
  }

  if (value !== 0 && (Math.abs(value) >= 10000 || Math.abs(value) < 0.001)) {
    return value.toExponential(2);
  }

  return value.toFixed(3);
}

interface TableProps {
  rows: CategoryRow[];
  axisLabels: string[];
  noun: string;
  swatchLimit: number | null;
  initialSelection: string[];
  // Whether the checkboxes started from a selection someone accepted earlier,
  // rather than from the ranking. The two look identical, and only one of them
  // tracks the Score column — so which it is has to be said, or a saved choice
  // reads as the ranking having gone wrong.
  isSavedSelection: boolean;
  onChangeSelection: (categories: string[]) => void;
}

function CategoriesTable({
  rows,
  axisLabels,
  noun,
  swatchLimit,
  initialSelection,
  isSavedSelection,
  onChangeSelection,
}: TableProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(() =>
    Object.fromEntries(initialSelection.map((c) => [c, true]))
  );

  // SearchBar drives the table through this rather than through props: the
  // query, the match index and next/previous all live inside the table.
  const tableRef = useRef<ReactTableHandle>(null);

  const columns = useMemo<ColumnDef<CategoryRow, unknown>[]>(() => {
    const numStats = [axisLabels[0], axisLabels[1]].filter(Boolean).length;

    const stat = (
      accessorKey: keyof CategoryRow,
      header: string
    ): ColumnDef<CategoryRow, unknown> => ({
      accessorKey,
      header,
      size: 474 / numStats,
      cell: (info) => formatStat(info.getValue() as number | undefined),
    });

    return [
      { accessorKey: CATEGORY_COLUMN_ID, header: "Category", size: 354 },
      { accessorKey: "count", header: "Points", size: 150 },
      {
        accessorKey: "score",
        // Named explicitly rather than derived from accessorKey, since the
        // initial sort below refers to it.
        id: SCORE_COLUMN_ID,
        // Wide enough for the header text plus the info icon.
        size: 150,
        cell: (info) => formatStat(info.getValue() as number | undefined),
        // A render function, because `header` goes through flexRender and so
        // takes any node. The tip is mounted on document.body: the table clips
        // (`overflow: hidden` on the container, `overflow-y: hidden` on the
        // header strip), so an in-place popover is cut off at the header's own
        // height. The click is swallowed so hitting the icon doesn't also
        // toggle the column's sort, which the whole header cell triggers.
        header: () => (
          <span role="presentation">
            Score
            <HelpTip id="category-score-help" />
          </span>
        ),
      },
      ...(axisLabels[0] ? [stat("meanX", `Mean ${axisLabels[0]}`)] : []),
      ...(axisLabels[1] ? [stat("meanY", `Mean ${axisLabels[1]}`)] : []),
    ];
  }, [axisLabels]);

  // The selection as it was when the table opened, never as it is now. The
  // sort below reads this so that ticking a box reorders nothing under the
  // cursor — a row that jumps away the moment you click it is worse than a
  // stale order.
  const initiallySelected = useMemo(() => new Set(initialSelection), [
    initialSelection,
  ]);

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  const handleRowSelectionChange = (
    updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)
  ) => {
    // Resolved against current state rather than inside a setState updater,
    // which React is entitled to run more than once. This is an event handler,
    // so `rowSelection` is already current and the callback form buys nothing.
    const next =
      typeof updater === "function" ? updater(rowSelection) : updater;
    const ids = rows.map((r) => r.category).filter((c) => next[c]);

    // The ceiling. Only reachable one tick at a time now — select-all is capped
    // by the table itself, which is the only thing that knows what order the
    // rows are currently in. Trimming here instead produced a selection drawn
    // from this component's own unsorted array, so the survivors bore no
    // relation to anything on screen.
    //
    // Only growth is refused. Judging the result alone locked up any selection
    // already above the ceiling: every click, in either direction, still landed
    // above it and was thrown away, so the categories couldn't even be removed.
    // That is not hypothetical — a plot saved when the ceiling was higher opens
    // in exactly that state.
    //
    // Growth is refused rather than trimmed, because making room would untick a
    // category the user never touched.
    if (ids.length > selectedCount && ids.length > HARD_MAX_CATEGORIES) {
      return;
    }

    setRowSelection(next);
    onChangeSelection(ids);
  };

  return (
    <div className={styles.categoryPicker}>
      <p className={styles.categoryPickerIntro}>
        {isSavedSelection ? (
          <>
            These are the {noun} you picked. <b>Restore default</b> goes back to
            picking them automatically.
          </>
        ) : (
          <>
            These are the {noun} picked automatically — the highest scoring,
            which is the order shown.
          </>
        )}{" "}
        Whatever isn&rsquo;t picked shares a single bucket.
      </p>
      <SearchBar
        tableRef={tableRef}
        className={styles.categoryPickerSearch}
        // Not "Find in table": only the Category column is searched, and the
        // stat columns sitting right there would otherwise look included.
        placeholder={`Find ${noun}`}
      />
      <div className={styles.categoryPickerTable}>
        <ReactTable
          columns={columns}
          data={rows}
          height={420}
          getRowId={(row) => row.category}
          enableRowSelection
          enableMultiRowSelection
          enableSearch
          searchableColumnIds={SEARCHABLE_COLUMN_IDS}
          tableRef={tableRef}
          enableStickyFirstColumn
          rowSelection={rowSelection}
          onRowSelectionChange={handleRowSelectionChange}
          maxRowSelection={HARD_MAX_CATEGORIES}
          // Opens sorted by Score when the selection came from the ranking,
          // because that is what chose it — the header's indicator is
          // the only thing on screen that says so. selectBestCategories takes
          // the top scores outright, so the column really does reproduce the
          // choice rather than merely resembling it.
          initialSorting={
            isSavedSelection ? undefined : [{ id: SCORE_COLUMN_ID, desc: true }]
          }
          // Only reached for a saved selection now, which is the case it was
          // always for: picked rows first, then by score within each group.
          // Clicking Score visibly breaks that grouping apart, and that is what
          // tells you the selection is yours rather than the column's.
          defaultSort={(a, b) => {
            const aSelected = initiallySelected.has(a.category);
            const bSelected = initiallySelected.has(b.category);

            if (aSelected !== bSelected) {
              return aSelected ? -1 : 1;
            }

            return b.score - a.score;
          }}
        />
      </div>
      <div className={styles.categoryPickerFooter}>
        <span>
          {selectedCount} of {rows.length} {noun} selected
        </span>
        {/* Derived from the count rather than remembered from the last
            action: a flag set on refusal outlives the state that caused it,
            and says nothing at all when someone arrives at the ceiling by
            ticking boxes one at a time. */}
        {selectedCount >= HARD_MAX_CATEGORIES && (
          <span className={styles.categoryPickerWarning}>
            At {HARD_MAX_CATEGORIES}, which is all a plot will draw.
          </span>
        )}
        {selectedCount < HARD_MAX_CATEGORIES &&
          swatchLimit !== null &&
          selectedCount > swatchLimit && (
            <span className={styles.categoryPickerWarning}>
              Past {swatchLimit} there aren&rsquo;t enough distinct colors, so
              some will repeat.
            </span>
          )}
      </div>
    </div>
  );
}

export interface CategoriesChoice {
  // The chosen names, or null to hand the decision back to the ranking.
  categories: string[] | null;
}

// Opens the category picker. Resolves undefined on cancel — distinct from
// `{ categories: null }`, which is the deliberate "restore default".
export default async function promptForCategories({
  values,
  axes,
  axisLabels,
  visible,
  chosen,
  noun,
  swatchLimit,
}: {
  values: (string | null)[];
  axes: (number | null)[][];
  axisLabels: string[];
  visible: boolean[];
  chosen: string[] | null;
  noun: string;
  // Past this many, colors repeat and the picker says so. Null for facets,
  // where the degradation is panels getting small rather than ambiguous.
  swatchLimit: number | null;
}): Promise<CategoriesChoice | undefined> {
  const scores = scoreCategories(values, axes, visible);

  const rows: CategoryRow[] = scores
    .map((s) => ({
      category: s.category,
      count: s.count,
      score: s.score,
      // `undefined` rather than null, so react-table sorts them last.
      meanX: s.means[0] ?? undefined,
      meanY: s.means[1] ?? undefined,
    }))
    .sort((a, b) => compareNaturally(a.category, b.category));

  // Seeded from what the plot is drawing now, so opening the picker and
  // accepting without touching anything changes nothing. With nothing chosen
  // that means re-running the ranking the renderer ran.
  const isSavedSelection = Boolean(chosen && chosen.length > 0);

  const seed =
    chosen && chosen.length > 0
      ? chosen.filter((c) => rows.some((r) => r.category === c))
      : selectBestCategories(scores, SOFT_MAX_CATEGORIES, compareNaturally);

  // Held in a closure rather than as the prompt's value: promptForValue
  // disables accept while `value === defaultValue`, so a selection left
  // deliberately alone would be unacceptable. The boolean exists only to flip
  // that comparison, and doubles as the way to refuse an empty selection.
  let selection = seed;
  let wantsAutomatic = false;

  const accepted = await promptForValue<boolean>({
    title: `Choose ${noun}`,
    defaultValue: false,
    acceptButtonText: "Update plot",
    modalProps: { className: styles.categoryPickerModal, bsSize: "lg" },
    secondaryAction: {
      buttonText: "Restore default",
      bsStyle: "info",
      onClick: async () => {
        wantsAutomatic = true;
        return true;
      },
    },
    PromptComponent: ({ onChange }: PromptComponentProps<boolean>) => (
      <CategoriesTable
        rows={rows}
        axisLabels={axisLabels}
        noun={noun}
        swatchLimit={swatchLimit}
        initialSelection={seed}
        isSavedSelection={isSavedSelection}
        onChangeSelection={(next) => {
          selection = next;
          onChange(next.length > 0);
        }}
      />
    ),
  });

  if (wantsAutomatic) {
    return { categories: null };
  }

  if (!accepted) {
    return undefined;
  }

  return { categories: selection };
}
