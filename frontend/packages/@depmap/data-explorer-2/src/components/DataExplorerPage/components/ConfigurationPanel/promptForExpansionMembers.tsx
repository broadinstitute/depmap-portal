import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { evaluateContextPersisted } from "@depmap/api";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import SliceTable, { CustomColumn } from "@depmap/slice-table";
import { DataExplorerContextV2, SliceQuery } from "@depmap/types";
import { usePlotlyLoader } from "../../../../contexts/PlotlyLoaderContext";
import {
  ExpansionMemberStats,
  fetchExpansionMemberStats,
  maxExpansionMembersFor,
  selectBestMembers,
  varianceLowerBound,
} from "../../../../services/dataExplorerAPI/expansionMembers";
import {
  forgetRememberedColumns,
  loadRememberedColumns,
  rememberColumns,
} from "../../../../utils/rememberedTableColumns";
import { getDimensionTypeLabel, pluralize } from "../../../../utils/misc";
import HelpTip from "../HelpTip";
import styles from "../../styles/ConfigurationPanel.scss";

// Referenced by the initial sort below, so it needs a name rather than the
// positional id SliceTable would otherwise assign it. The header reads
// "Score"; this is what it holds.
const RANKING_COLUMN_ID = "variance-lower-bound";

// Expression data spans orders of magnitude, and a variance column reading
// "0.000" forty times over tells the reader nothing.
function formatStat(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (value !== 0 && (Math.abs(value) >= 10000 || Math.abs(value) < 0.001)) {
    return value.toExponential(2);
  }

  return value.toFixed(3);
}

// Counts are whole numbers of entities, so they get none of the above: three
// decimal places on "482 cell lines" is noise, and the exponential threshold
// would eventually turn a large cohort into "1.20e+4".
function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return value.toLocaleString();
}

interface MembersTableProps {
  candidateIds: string[];
  index_type: string;
  dataset_id: string;
  slice_type: string;
  visibleFilter: DataExplorerContextV2 | undefined;
  initialMembers: string[] | null;
  onChangeSelection: (ids: string[]) => void;
  PlotlyLoader: ReturnType<typeof usePlotlyLoader>;
  memberNoun: string;
  downloadFilename: string;
  // Resolved by the caller rather than here. It depends on the size of the
  // index, which takes a request to learn, and the caller is already async and
  // already needs the number itself to decide whether to enable "Update plot".
  cap: number;
}

function MembersTable({
  candidateIds,
  index_type,
  dataset_id,
  slice_type,
  visibleFilter,
  initialMembers,
  onChangeSelection,
  memberNoun,
  downloadFilename,
  PlotlyLoader,
  cap,
}: MembersTableProps) {
  const [statsById, setStatsById] = useState<Map<
    string,
    ExpansionMemberStats
  > | null>(null);
  const [indexSize, setIndexSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(
    initialMembers?.length ?? 0
  );

  // Holds the seed until the stats that determine it arrive. Read by
  // getInitialState, which is re-run through the ref below once it's set.
  const seedRef = useRef<Record<string, boolean>>({});
  const sliceTableRef = useRef<{ forceInitialize: () => void }>(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    fetchExpansionMemberStats({
      candidateIds,
      index_type,
      dataset_id,
      slice_type,
      visibleFilter,
    })
      .then((result) => {
        if (latestRequest.current !== requestId) {
          return;
        }

        // Seeded from what the plot is drawing right now, so opening the table
        // and accepting without touching anything is a no-op. With nothing
        // pinned that means re-running the ranking the fetcher ran, which is
        // what makes it a seed rather than a second opinion.
        const seed =
          initialMembers ??
          selectBestMembers(
            candidateIds,
            Object.fromEntries(result.stats.map((s) => [s.id, s.variance])),
            Object.fromEntries(result.stats.map((s) => [s.id, s.count])),
            cap
          );

        // Narrowed to members the table will show. A member with no
        // observations is filtered out below, so seeding it would leave a
        // selection the user can neither see nor clear.
        const measured = new Set(
          result.stats.filter((s) => (s.count ?? 0) > 0).map((s) => s.id)
        );
        const visibleSeed = seed.filter((id) => measured.has(id));

        seedRef.current = Object.fromEntries(
          visibleSeed.map((id) => [id, true])
        );
        setStatsById(new Map(result.stats.map((s) => [s.id, s])));
        setIndexSize(result.indexSize);
        setSelectedCount(visibleSeed.length);
        onChangeSelection(visibleSeed);

        // The table mounted before the seed existed, so ask it to re-read
        // getInitialState now that it does.
        sliceTableRef.current?.forceInitialize();
      })
      .catch((e) => {
        if (latestRequest.current === requestId) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateIds, index_type, dataset_id, slice_type, visibleFilter]);

  const candidateIdSet = useMemo(() => new Set(candidateIds), [candidateIds]);

  const hiddenCount = useMemo(() => {
    if (!statsById) {
      return 0;
    }

    return candidateIds.filter((id) => (statsById.get(id)?.count ?? 0) === 0)
      .length;
  }, [candidateIds, statsById]);

  // A member the dataset simply doesn't track. Its stats aren't merely
  // uncomputable, they're meaningless — there was nothing to compute them over
  // — and selecting it would add an empty panel to the plot.
  //
  // These rows are filtered out entirely rather than shown and marked. Marking
  // them worked only until someone added an annotation column and sorted by it:
  // a member with no *measurements* still has metadata, so it sorts into the
  // middle of the rows that do have data, and the table becomes unreadable. A
  // per-row sort rank can't help, since any active column sort replaces the
  // default ordering outright. The footer says how many went, so the count
  // still reconciles with the expansion.
  const hasNoData = useCallback(
    (id: string) => {
      const stats = statsById?.get(id);
      return Boolean(statsById) && (stats?.count ?? 0) === 0;
    },
    [statsById]
  );

  const customColumns = useMemo<CustomColumn[]>(() => {
    const statColumn = (
      id: string,
      label: string,
      read: (s: ExpansionMemberStats) => number | null,
      width: number,
      format: (value: number | null | undefined) => string = formatStat,
      // Rendered beside the label. The click is swallowed so hitting the icon
      // doesn't also toggle the column's sort, which the whole header cell
      // triggers — same arrangement the category picker uses.
      help: React.ReactNode = null,
      // What the download calls this column. Defaults to the on-screen label,
      // and differs for the ranking column: a CSV travels without its tooltip,
      // so it is the one place the fully descriptive name earns its width.
      csvHeader: string = label
    ): CustomColumn => ({
      id,
      width,
      csvHeader,
      header: () =>
        help ? (
          <span onClick={(e) => e.stopPropagation()} role="presentation">
            {label}
            {help}
          </span>
        ) : (
          label
        ),
      // The accessor is what makes this a real column rather than decoration:
      // react-table drives sorting, search and CSV from it, not from `cell`.
      // Returns undefined rather than null for a missing value, because
      // `sortUndefined: "last"` then floats un-computable members to the
      // bottom — matching how selectBestMembers ranks them.
      accessorFn: (row) => {
        const value = statsById?.get(row.id as string);
        const stat = value ? read(value) : null;
        return stat === null ? undefined : stat;
      },
      cell: (ctx) => {
        const stats = statsById?.get(ctx.row.id);
        return format(stats ? read(stats) : null);
      },
    });

    return [
      // The statistic that actually ranks, so sorting by this column
      // reproduces the selection — which raw variance did not, and which is why
      // the chosen rows used to appear scattered through a variance sort.
      //
      // It replaces the raw Variance column rather than joining it: variance is
      // Std dev squared, so nothing is lost, and two columns differing only by
      // a small-sample discount invite the reader to compare them instead of
      // reading either.
      statColumn(
        RANKING_COLUMN_ID,
        "Score",
        (s) => varianceLowerBound(s.variance, s.count),
        110,
        formatStat,
        <HelpTip id="expansion-member-score-help" />,
        "Variance (95% lower bound)"
      ),
      statColumn("stddev", "Std dev", (s) => s.stddev, 100),
      statColumn("mean", "Mean", (s) => s.mean, 100),
      statColumn(
        "count",
        "N",
        (s) => s.count,
        90,
        formatCount,
        <HelpTip
          id="expansion-member-count-help"
          customContent={
            <div>
              <p>
                How many of the {indexSize.toLocaleString()} entities this plot
                covers had a value here. The statistics beside it describe how
                this {memberNoun.replace(/s$/, "")} behaves across those
                entities, rather than in general.
              </p>
              <p>
                A low N lowers the <b>Score</b> too. Members with no values at
                all aren&rsquo;t listed.
              </p>
            </div>
          }
        />
      ),
    ];
  }, [statsById, indexSize, memberNoun]);

  if (error) {
    return (
      <div className={styles.expansionMembersError}>
        Could not compute statistics for these {memberNoun}: {error}
      </div>
    );
  }

  return (
    <div>
      <p className={styles.expansionMembersIntro}>
        The plot shows the {memberNoun} checked below. Use{" "}
        <strong>Add column</strong> to bring in annotations.
      </p>
      <div className={styles.expansionMembersTable}>
        <SliceTable
          PlotlyLoader={PlotlyLoader}
          sliceTableRef={sliceTableRef}
          index_type_name={slice_type}
          downloadFilename={downloadFilename}
          isLoading={statsById === null}
          // HACK: this filters client-side, *after* every column has been
          // fetched for every entity of the type — so scoping to one gene's
          // transcripts still pulls a quarter of a million rows per column.
          // showGeneTranscriptTable already pays this, so it isn't new, but the
          // real fix is teaching Breadbox's /datasets/dimension/data/ to accept
          // an id list.
          implicitFilter={({ id }) => candidateIdSet.has(id) && !hasNoData(id)}
          // Opens sorted by Variance when nothing was hand-picked, because
          // that IS how the shown members were chosen — the header's sort
          // indicator is the only thing on screen that says so. Ordering by
          // "selected first" instead put the same rows on top by a different
          // rule, close enough to look identical and different enough to be
          // subtly reshuffled, while explaining nothing.
          //
          // A hand-picked selection keeps "selected first": there the ranking
          // is not the reason those rows are chosen, and leading with it would
          // misattribute the user's own decision to the statistic.
          initialSorting={
            initialMembers ? undefined : [{ id: RANKING_COLUMN_ID, desc: true }]
          }
          customColumns={customColumns}
          customColumnPlacement="beforeSliceColumns"
          enableRowSelection
          enableMultiRowSelection
          // Select-all stops at what the plot can draw, which is what the
          // category picker's does. It takes from the top of the current display
          // order, so whatever the table is showing first is what gets ticked —
          // and under the default sort that is the Score column, the same
          // statistic selectBestMembers ranks on. Sort by something else and
          // select-all follows that instead, which is the point: the ceiling is
          // visible in the rows it picks rather than applied out of sight.
          //
          // Individual checkboxes stay unrestricted — see the cap handling in
          // promptForExpansionMembers' onChangeSelection for why.
          maxRowSelection={cap}
          getInitialState={() => ({
            initialSlices:
              loadRememberedColumns("expansion-members", slice_type) ?? [],
            initialRowSelection: seedRef.current,
          })}
          onChangeSlices={(nextSlices: SliceQuery[]) =>
            rememberColumns("expansion-members", slice_type, nextSlices)
          }
          // Each remembered column is a full fetch of every entity of the type
          // (see the implicitFilter HACK above), so a set someone built up over
          // several sittings can arrive as enough concurrent load for Breadbox
          // to refuse the batch outright. That failure is deterministic —
          // reopening or refreshing replays the identical requests — so the
          // memory has to go for the retry to have any chance. Dropping it puts
          // the table back to id and label, which is what a first-time open
          // would have loaded.
          onLoadError={() =>
            forgetRememberedColumns("expansion-members", slice_type)
          }
          onChangeRowSelection={(nextSelection) => {
            const ids = candidateIds.filter((id) => nextSelection[id]);
            setSelectedCount(ids.length);
            onChangeSelection(ids);
          }}
        />
      </div>
      <div className={styles.expansionMembersFooter}>
        <span
          className={
            selectedCount > cap ? styles.expansionMembersCapHint : undefined
          }
        >
          {selectedCount} selected
          {/* "a plot this size" because the cap is not a constant: it scales
              down as the index the expansion multiplies grows, so the same
              plot type can allow 9 here and 3 elsewhere. Without that hedge
              the difference reads as a bug. */}
          {selectedCount > cap && ` — a plot this size shows at most ${cap}`}
        </span>
        {/* Says where the missing rows went. Without it the table just holds
            fewer rows than the expansion has members, with nothing to indicate
            whether they were dropped or never existed. Rendered only when there
            is something to say — the span is margin-left:auto, so an empty one
            still takes part in the layout. */}
        {hiddenCount > 0 && (
          <span className={styles.expansionMembersFloorHint}>
            {hiddenCount} not measured here and hidden.
          </span>
        )}
      </div>
    </div>
  );
}

export interface ExpansionMembersChoice {
  // The ids to pin, or null to hand the choice back to the ranking.
  members: string[] | null;
}

// Opens the member table. Resolves undefined when the user cancels — as
// distinct from `{ members: null }`, which is the deliberate "restore default".
export default async function promptForExpansionMembers({
  context,
  slice_type,
  index_type,
  dataset_id,
  visibleFilter,
  currentMembers,
  PlotlyLoader,
}: {
  context: DataExplorerContextV2;
  slice_type: string;
  index_type: string;
  dataset_id: string;
  visibleFilter: DataExplorerContextV2 | undefined;
  currentMembers: string[] | null;
  // Captured by the caller, which is in the React tree, because this modal
  // isn't: promptForValue renders into a detached div, so no provider above the
  // app reaches it.
  PlotlyLoader: ReturnType<typeof usePlotlyLoader>;
}): Promise<ExpansionMembersChoice | undefined> {
  const [{ ids }, cap] = await Promise.all([
    evaluateContextPersisted(context),
    maxExpansionMembersFor(index_type, dataset_id),
  ]);

  const typeLabel = getDimensionTypeLabel(slice_type) || "member";
  const memberNoun = pluralize(typeLabel).toLowerCase();

  // Held in a closure rather than as the prompt's value: promptForValue
  // disables its accept button while `value === defaultValue`, so a selection
  // the user opened and deliberately left alone would be unacceptable. The
  // boolean value exists only to flip that comparison — which doubles as the
  // way to refuse an over-cap selection, since setting it back to `false`
  // disables accept again.
  let chosen: string[] = currentMembers ?? [];
  let wantsAutomatic = false;

  const accepted = await promptForValue<boolean>({
    title: `Choose ${memberNoun}`,
    defaultValue: false,
    acceptButtonText: "Update plot",
    modalProps: { className: styles.expansionMembersModal, bsSize: "lg" },
    secondaryAction: {
      buttonText: "Restore default",
      bsStyle: "info",
      onClick: async () => {
        wantsAutomatic = true;
        return true;
      },
    },
    PromptComponent: ({ onChange }: PromptComponentProps<boolean>) => (
      <MembersTable
        candidateIds={ids}
        index_type={index_type}
        dataset_id={dataset_id}
        slice_type={slice_type}
        visibleFilter={visibleFilter}
        initialMembers={currentMembers}
        cap={cap}
        memberNoun={memberNoun}
        PlotlyLoader={PlotlyLoader}
        downloadFilename={`${context.name} ${memberNoun}`}
        onChangeSelection={(nextIds) => {
          chosen = nextIds;
          // Individual checkboxes stay permissive and an over-cap selection
          // leaves accept disabled, rather than the click being refused —
          // refusing it made ticking a box look broken, since nothing on screen
          // changed. Select-all is the one route capped outright
          // (maxRowSelection above): it is a single click that can overshoot by
          // hundreds, and there the cap is visible in what gets ticked.
          //
          // Still reachable from here: a saved plot that was written when the
          // ceiling was higher, and clicking past it one row at a time. Both
          // are explained by the footer's "shows at most N".
          onChange(nextIds.length > 0 && nextIds.length <= cap);
        }}
      />
    ),
  });

  if (wantsAutomatic) {
    return { members: null };
  }

  if (!accepted) {
    return undefined;
  }

  return { members: chosen };
}
