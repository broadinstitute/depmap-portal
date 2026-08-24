import { breadboxAPI, cached, evaluateContextPersisted } from "@depmap/api";
import { DataExplorerContextV2 } from "@depmap/types";
import { isSampleType } from "../../utils/misc";
import { fetchDatasetIdentifiers } from "./identifiers";

// ---------------------------------------------------------------------------
// Choosing which expansion members to show.
//
// An expansion context routinely resolves to more members than a plot can
// usefully render — a gene has dozens of transcripts, a compound has a full
// dose series — so some of them have to be dropped. Which ones is the whole
// question. Dropping all but the first N in context order picks by an accident
// of identifier ordering, which is why the plot used to need pagination: the
// members you wanted were as likely to be on page 3 as page 1.
//
// So instead: keep the members that actually vary across the entities being
// plotted. Interestingness here is relational, not intrinsic — a transcript
// earns its panel by discriminating among *these* models, not by being highly
// expressed in the abstract. That is also why the ranking is computed over the
// index the user is looking at (honoring `filters.visible`) rather than over
// the whole cohort.
//
// This is the default, not the last word. `expand_by.members` overrides it with
// the user's own choice, made in the member table (promptForExpansionMembers),
// which shows these same statistics and seeds its checkboxes from this ranking.
// So what follows is the answer to "which of these should I be looking at?"
// when nobody has said otherwise.
// ---------------------------------------------------------------------------

// An expansion pairs every index entity with every member, so the two have to
// sit on OPPOSITE axes of the expanding dataset. The whole fetch is built on
// that: whichever axis the members occupy, the index is assumed to occupy the
// other, and both fetchExpansionMemberStats below and fetchExpandedDimension in
// expandedPlot place their id lists by asking only `isSampleType(slice_type)`.
// A same-axis pair isn't merely unsupported, it's meaningless -- there is no
// cell for (gene, transcript) in a matrix whose axes are models and
// transcripts.
//
// Nothing upstream enforces this. The dimension selector cannot produce such a
// pair, because computeSliceTypeOptions derives each dataset's slice_type from
// the axis opposite its index_type -- but that is emergent rather than checked,
// and any config that skips the selector escapes it. A shared link is fed
// straight to useReducer as initial state with normalize() never running, and
// Transcript Explorer sets slice_type "transcript" unconditionally and offers
// no index-type control.
//
// Unchecked, this doesn't fail so much as lie: the index ids land in the slot
// meant for the other axis, match nothing, and the plot comes back empty with
// nothing to say why. Throwing gives the error boundary something to show.
export async function assertExpansionAxesDiffer(
  index_type: string,
  slice_type: string
) {
  const dimTypes = await cached(breadboxAPI).getDimensionTypes();
  const indexDimType = dimTypes.find((t) => t.name === index_type);
  const expansionDimType = dimTypes.find((t) => t.name === slice_type);

  // An unrecognized type is a different problem, and one the callers already
  // tolerate (they read `id_column` off these optionally). Don't convert it
  // into a confident claim about axes.
  if (!indexDimType || !expansionDimType) {
    return;
  }

  if (indexDimType.axis === expansionDimType.axis) {
    throw new Error(
      `Cannot expand a "${index_type}" plot by "${slice_type}": both are ` +
        `${indexDimType.axis} types. An expansion pairs each index entity ` +
        `with each member, so the two must sit on opposite axes of the ` +
        `dataset — there are no values to read for this combination.`
    );
  }
}

// ---------------------------------------------------------------------------
// How many members to show.
//
// An expansion draws N×M points: N index entities, each fanned out into M
// members. M is what we get to choose, and the reason there is a cap at all is
// that N is not ours to choose — so the cap belongs to N.
//
// This was briefly a flat number with a hand-written exception lowering
// `transcript` to 9. That keyed on the expansion's own slice_type, which is the
// wrong axis: the transcripts aren't the expensive part, whatever they're being
// fanned out over is. Expanding transcripts across 2,446 cell lines and across
// 19,215 genes are very different plots and were getting the same cap.
//
// Measured by using it, at the point each stopped feeling responsive:
//
//   index          dataset       N        usable M
//   depmap_model   expression     2,446          9
//   gene           expression    19,215          3
//
// Not linear — a 7.9x larger index only cuts the cap by 3x. Fitting M = C·N^-a to those
// two points gives a = 0.533, close enough to a half that the inverse square
// root is the honest reading rather than a curve fitted to two points. Each
// point taken alone implies C = 445 and C = 416; 430 is their geometric mean,
// and reproduces both (8.69 -> 9, 3.10 -> 3).
const CAP_SCALE = 430;

// The ceiling, and unchanged from when it was the whole policy: 16 is about as
// far as small multiples stay legible, and it is a tidy 4x4. A small index does
// not earn 40 panels just because it could afford them.
export const MAX_EXPANSION_MEMBERS = 16;

// The floor. One member is not an expansion — it is a single slice wearing an
// expansion's config — and a plot that renders as one column looks broken
// rather than merely dense. Two is the least that still means anything. Someone
// who wants fewer can pick fewer by hand; this is only the automatic default.
const MIN_EXPANSION_MEMBERS = 2;

// Pure half, kept separate so the curve can be tested without a network.
export function expansionCapForIndexSize(indexSize: number) {
  if (!Number.isFinite(indexSize) || indexSize <= 0) {
    return MAX_EXPANSION_MEMBERS;
  }

  return Math.max(
    MIN_EXPANSION_MEMBERS,
    Math.min(
      MAX_EXPANSION_MEMBERS,
      Math.round(CAP_SCALE / Math.sqrt(indexSize))
    )
  );
}

// N is the size of the INDEX axis of the expanding dataset — features when
// index_type is a feature type, samples otherwise. fetchDatasetIdentifiers
// already makes exactly that choice, off the dimension type's `axis`, so this
// reuses it rather than repeating the dispatch.
//
// Deliberately the dataset's size, NOT the visible-filtered size that
// resolveRankingIndex computes below. Hiding cell lines shouldn't silently
// change how many panels a plot is allowed to have, and the fetch this is
// protecting against is sized by the dataset either way.
//
// Costs no request in practice: the plot path already calls
// fetchDatasetIdentifiers with these same arguments (resolveRankingIndex here,
// fetchExpandedDimension in expandedPlot), and it is `cached`.
export async function maxExpansionMembersFor(
  index_type: string,
  dataset_id: string
) {
  const identifiers = await fetchDatasetIdentifiers(index_type, dataset_id);

  return expansionCapForIndexSize(identifiers.length);
}

// One-sided 95% lower confidence bound on a member's variance: how much spread
// it can be relied on to have, rather than how much this particular sample
// happened to show.
//
// This is what ranks members, and it replaced a hard floor on the observation
// count. The floor scaled with the index and capped at 30, which on a large
// cohort meant a dose measured in 29 cell lines was struck out before its
// variance was ever looked at — not because 29 observations are untrustworthy,
// but because they were fewer than an unrelated threshold. Compound doses span
// screens of very different sizes, so that fell on whole screens at a time, and
// it was a cliff: 29 out, 30 in, with nothing to distinguish them.
//
// A bound has no threshold to fall on the wrong side of. A small sample is
// discounted in proportion to how little it pins down, so a well-measured dose
// from a small screen competes on its merits and a two-point outlier still
// cannot win. It is also monotonic in the data, which is what lets the column
// showing it also explain the selection — sort by it and the chosen members are
// the top of the list, which is not true of raw variance.
//
// Chi-square quantile via Wilson–Hilferty, which is a line of arithmetic rather
// than an inverse incomplete gamma. It is within 2.5% of the exact quantile at
// one degree of freedom and better than a tenth of a percent by ten, which is
// far finer than the difference between two members' variances ever is.
// Returns null when there is nothing to bound.
const Z_95 = 1.6448536269514722;

export function varianceLowerBound(
  variance: number | null | undefined,
  count: number | null | undefined
): number | null {
  if (
    typeof variance !== "number" ||
    !Number.isFinite(variance) ||
    typeof count !== "number" ||
    count < 2
  ) {
    return null;
  }

  const df = count - 1;
  const h = 2 / (9 * df);
  // The upper 95% point of chi-square(df), divided by df — so the bound is the
  // sample variance scaled down by however much the estimate could be
  // overstating things.
  const scale = (1 - h + Z_95 * Math.sqrt(h)) ** 3;

  return variance / scale;
}

// Pure half, kept separate so the policy can be tested without a network.
// Returns the survivors in *candidate order*, not variance order — panel order
// is `sort_by`'s job downstream, and keeping the context ordering means that
// changing a visible-models filter changes which members appear without also
// reshuffling the ones that stayed.
export function selectBestMembers(
  candidateIds: readonly string[],
  variance: Record<string, number | null | undefined>,
  count: Record<string, number | null | undefined>,
  cap: number
): string[] {
  if (candidateIds.length <= cap) {
    return [...candidateIds];
  }

  const score = (id: string) => {
    const bound = varianceLowerBound(variance[id], count[id]);

    // Nothing to bound — all-null, or a single observation. Sorts last rather
    // than being excluded, so it can still fill a slot when there is nothing
    // better, which is the treatment every member now gets: the ranking
    // deprioritizes, it never disqualifies.
    return bound === null ? -Infinity : bound;
  };

  const winners = new Set(
    [...candidateIds]
      .sort((a, b) => {
        const va = score(a);
        const vb = score(b);
        // Compared rather than subtracted: -Infinity minus -Infinity is NaN,
        // which would make the comparator incoherent. Equal scores return 0 and
        // sort's stability then preserves candidate order among them.
        if (va === vb) {
          return 0;
        }
        return vb > va ? 1 : -1;
      })
      .slice(0, cap)
  );

  return candidateIds.filter((id) => winners.has(id));
}

// The entities to rank across: everything the expanding dataset covers on the
// index axis, narrowed to what the user has left visible.
async function resolveRankingIndex(
  index_type: string,
  dataset_id: string,
  visibleFilter: DataExplorerContextV2 | undefined
) {
  const identifiers = await fetchDatasetIdentifiers(index_type, dataset_id);
  const indexIds = identifiers.map(({ id }) => id);

  if (!visibleFilter) {
    return indexIds;
  }

  const { ids } = await evaluateContextPersisted(visibleFilter);
  const visible = new Set(ids);
  const narrowed = indexIds.filter((id) => visible.has(id));

  // A filter naming nothing this dataset covers leaves no cohort to rank over.
  // Fall back to the full index rather than ranking on an empty one.
  return narrowed.length > 0 ? narrowed : indexIds;
}

// Every statistic the member table shows, and the two the ranking uses. They
// are requested together because the expensive part is reading the block out of
// HDF5, not the arithmetic — so the table costs nothing beyond what ranking
// already pays, and `cached` collapses the two callers onto one request.
const MEMBER_STATS = ["variance", "stddev", "mean", "count"] as const;

export interface ExpansionMemberStats {
  id: string;
  variance: number | null;
  stddev: number | null;
  mean: number | null;
  count: number | null;
}

export interface ExpansionMemberStatsResult {
  stats: ExpansionMemberStats[];
  // How many entities the statistics were computed over. The table needs it to
  // explain the count column, and selectBestMembers needs it for the floor.
  indexSize: number;
}

export async function fetchExpansionMemberStats({
  candidateIds,
  index_type,
  dataset_id,
  slice_type,
  visibleFilter,
}: {
  candidateIds: string[];
  index_type: string;
  dataset_id: string;
  slice_type: string;
  visibleFilter: DataExplorerContextV2 | undefined;
}): Promise<ExpansionMemberStatsResult> {
  // Guarded independently of fetchExpandedPlot: the member table opens from the
  // configuration panel, which still renders when the plot itself has failed,
  // so this is reachable without the plot fetch having run.
  await assertExpansionAxesDiffer(index_type, slice_type);

  const sliceIsSampleType = await isSampleType(slice_type);
  const indexIds = await resolveRankingIndex(
    index_type,
    dataset_id,
    visibleFilter
  );

  const response = await cached(breadboxAPI, {
    persist: true,
  }).getMatrixDatasetData(dataset_id, {
    sample_identifier: "id",
    feature_identifier: "id",
    // Members sit on the slice axis, the cohort on the other one.
    samples: sliceIsSampleType ? candidateIds : indexIds,
    features: sliceIsSampleType ? indexIds : candidateIds,
    aggregate: {
      // NOTE: inverted relative to every other aggregation call in this
      // package. fetchAggregatedDimension and fetchBroadcastAggregatedSliceValues
      // collapse the *slice* axis to get one value per index entity; here we
      // want one value per *member*, so it is the index axis that collapses.
      // Do not "fix" this to match them.
      aggregate_by: sliceIsSampleType ? "features" : "samples",
      aggregation: [...MEMBER_STATS],
    },
  });

  const stats = candidateIds.map((id) => ({
    id,
    variance: response.variance?.[id] ?? null,
    stddev: response.stddev?.[id] ?? null,
    mean: response.mean?.[id] ?? null,
    count: response.count?.[id] ?? null,
  }));

  return {
    stats,
    indexSize: indexIds.length,
  };
}

export async function chooseExpansionMembers({
  candidateIds,
  cap,
  index_type,
  dataset_id,
  slice_type,
  visibleFilter,
  isContinuous,
  pinnedIds,
}: {
  candidateIds: string[];
  cap: number;
  index_type: string;
  dataset_id: string;
  slice_type: string;
  visibleFilter: DataExplorerContextV2 | undefined;
  isContinuous: boolean;
  // The user's own choice, made in the member table. Overrides the ranking
  // entirely — that is what makes it a choice rather than a suggestion.
  pinnedIds?: string[];
}): Promise<string[]> {
  if (pinnedIds && pinnedIds.length > 0) {
    const pinned = new Set(pinnedIds);
    const kept = candidateIds.filter((id) => pinned.has(id)).slice(0, cap);

    // Intersected with the live candidates rather than trusted outright, so a
    // config whose members no longer belong to its context can't ask for
    // entities the expansion doesn't contain. normalize() clears them when the
    // context changes; this covers the hand-authored link that bypassed it.
    // Nothing surviving means the pins are entirely stale, so rank instead of
    // rendering an empty plot.
    if (kept.length > 0) {
      return kept;
    }
  }

  // Nothing to choose between, and no reason to pay for a round trip.
  if (candidateIds.length <= cap) {
    return [...candidateIds];
  }

  // Breadbox only aggregates continuous matrices, so a categorical expansion
  // has no spread to rank by. Checked up front rather than caught, so that a
  // genuine aggregation failure still surfaces instead of being quietly
  // downgraded to the arbitrary ordering this function exists to replace.
  if (!isContinuous) {
    return candidateIds.slice(0, cap);
  }

  const { stats } = await fetchExpansionMemberStats({
    candidateIds,
    index_type,
    dataset_id,
    slice_type,
    visibleFilter,
  });

  return selectBestMembers(
    candidateIds,
    Object.fromEntries(stats.map((s) => [s.id, s.variance])),
    Object.fromEntries(stats.map((s) => [s.id, s.count])),
    cap
  );
}
