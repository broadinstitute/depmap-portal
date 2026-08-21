import {
  breadboxAPI,
  cached,
  evaluateContextPersisted,
  getDimensionTypeIdentifiersPersisted,
} from "@depmap/api";
import {
  DataExplorerContextV2,
  DataExplorerContextVariable,
  DataExplorerExpandedPlotConfig,
  DataExplorerExpandedPlotResponse,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  DataExplorerPlotResponseDimension,
  FilterKey,
  isValidSliceQuery,
  SliceQuery,
} from "@depmap/types";
import {
  buildDimTypeMap,
  buildTablesByDim,
  resolveDisplayLabel,
} from "@depmap/selects";
import {
  isCompleteDimension,
  isExpansionDimension,
  isSampleType,
} from "../../utils/misc";
import {
  assertExpansionAxesDiffer,
  chooseExpansionMembers,
  fetchExpansionMemberStats,
  maxExpansionMembersFor,
} from "./expansionMembers";
import { fetchDatasetIdentifiers } from "./identifiers";
import { getDimensionDataWithoutLabels } from "./helpers";
import {
  buildExtendedMetadata,
  fetchAxisLabel,
  fetchDatasetLabel,
  fetchPlotDimensions,
  fetchValueType,
} from "./breadboxMethods";

// ---------------------------------------------------------------------------
// fetchExpandedPlot
//
// The materializer for the expansion feature. Sibling of fetchPlotDimensions
// for plots where each data point represents a pair
// (index_type × expand_by.slice_type) instead of a single index entity.
// Primary use case: gene/transcript, where each (depmap_model, transcript)
// cell gets its own point.
//
// Response is the existing DataExplorerPlotResponse shape with arrays widened
// from length N to length N×M (index-major: model_1×{t_1..t_M},
// model_2×{t_1..t_M}, …), plus a new top-level `expansions` field carrying
// the per-cell expansion ids and labels as parallel arrays.
//
// All internal keying is by id. Pair keys are derived from
// `(index_id, expansion_id)`. Labels are projected from ids at the very end
// using the same reverse-map pattern fetchPlotDimensions uses.
//
// Scope boundaries (deliberate, tracked):
//   - At most one expansion today; 2+ is rejected. The slot type is already an
//     array (DataExplorerExpandBy[]), and datasets like drug-dose-replicate
//     would naturally want N×M×P; whether a comprehensible UX exists for that
//     is an open question, so multi-expansion is deferred pending
//     investigation rather than ruled in or out.
//   - Broadcast (non-expanded) dimensions must use axis_type
//     "aggregated_slice". A raw_slice broadcast path is not yet implemented.
//   - Metadata handling duplicates fetchPlotDimensions' loop rather than
//     factoring out a shared helper. Extracting one is a tracked cleanup.
// ---------------------------------------------------------------------------

// How many expansion members a plot shows is no longer stated here, or anywhere
// as a single number: it scales with the index the expansion multiplies (see
// maxExpansionMembersFor in ./expansionMembers). A plot used to carry its own
// `limit` too, but once the members shown are the ones worth showing — and once
// how many fit is a property of the data rather than a preference — asking the
// user to pick a count stops earning its place in the config. Which members is
// decided by chooseExpansionMembers.

// ---------------------------------------------------------------------------
// fetchExpandedPlot
// ---------------------------------------------------------------------------

export async function fetchExpandedPlot(
  config: DataExplorerExpandedPlotConfig
): Promise<DataExplorerExpandedPlotResponse> {
  const { index_type, dimensions, expand_by, filters, metadata } = config;

  // Zero-expansion case: degenerate to the non-expanded fetcher and tag on
  // an empty `expansions` array. Lets callers avoid special-casing the
  // "I might or might not expand" decision at the call site.
  if (expand_by.length === 0) {
    const base = await fetchPlotDimensions(
      index_type,
      dimensions,
      filters,
      metadata
    );
    return { ...base, expansions: [] };
  }

  if (expand_by.length > 1) {
    throw new Error(
      `fetchExpandedPlot currently supports at most one expansion; ` +
        `got ${expand_by.length}. Multi-expansion is deferred.`
    );
  }

  const [exp] = expand_by;

  // Pre-fetch (cached postJson) data we'll need below, in parallel.
  cached(breadboxAPI).getDimensionTypes();
  cached(breadboxAPI).getDatasets();
  fetchDatasetLabel(dimensions.x?.dataset_id);
  fetchDatasetLabel(dimensions.y?.dataset_id);
  fetchDatasetLabel(dimensions.color?.dataset_id);
  fetchDatasetLabel(dimensions.facet?.dataset_id);

  const dimTypes = await cached(breadboxAPI).getDimensionTypes();
  const indexDimType = dimTypes.find((t) => t.name === index_type);
  const expansionDimType = dimTypes.find((t) => t.name === exp.slice_type);
  const index_id_column = indexDimType?.id_column;
  const index_display_name = indexDimType?.display_name;
  const expansion_id_column = expansionDimType?.id_column;
  const expansion_display_name = expansionDimType?.display_name;

  // Checked here, before the context is resolved and before anything is
  // fetched, because everything downstream assumes it. (Cheap: the dimension
  // types it reads are the ones already awaited just above.)
  await assertExpansionAxesDiffer(index_type, exp.slice_type);

  // The wire type requires `exp.context`, but toggling Expand before picking a
  // context is a legitimate flow, and it mints an expansion whose context is
  // undefined (dropped entirely on serialization). ADR 0007 makes the expanding
  // axis authoritative — its own slice_type and context ARE the expansion — so
  // recover from the axis rather than crashing deep inside evaluateContext.
  const expansionContext = (exp.context ??
    (["x", "y"] as const)
      .map((k) => dimensions[k])
      .find((d) => isExpansionDimension(d) && d?.context)?.context) as
    | DataExplorerContextV2
    | undefined;

  if (!expansionContext) {
    throw new Error(
      `fetchExpandedPlot: the expansion over "${exp.slice_type}" has no ` +
        `context — neither expand_by nor an expanding axis carries one.`
    );
  }

  // Resolve the expansion list once. For gene/transcript this is e.g.
  // "transcripts of CD44" → ids + labels of length M.
  const {
    ids: allExpIds,
    labels: allExpLabels,
  } = await evaluateContextPersisted(expansionContext);

  if (allExpIds.length === 0) {
    throw new Error(
      `Expansion context "${expansionContext.name}" produced no ` +
        `${exp.slice_type} identifiers.`
    );
  }

  const extendedMetadata = buildExtendedMetadata(
    index_type,
    index_id_column,
    metadata,
    filters
  );

  const dimensionKeys = Object.keys(dimensions).filter((k) =>
    isCompleteDimension(dimensions[k])
  );

  const filterKeys = Object.keys(filters || {}) as FilterKey[];
  const metadataKeys = Object.keys(extendedMetadata);

  // A dimension expands when it carries the "expansion" sentinel on
  // `aggregation` — the single documented identity for an expansion axis (see
  // isExpansionDimension, and the DataExplorerAggregation comments in
  // @depmap/types). It is the user's own choice, made on the Aggregate/Expand
  // toggle, and it survives URL round-tripping, so it is authoritative no
  // matter where a config came from. Either AXIS may carry it: a second axis
  // can join an expansion the first defined, reading the same members from its
  // own dataset (ADR 0007). `color` and `facet` may not — see the check below.
  //
  // This deliberately does NOT match on `(axis_type, slice_type)` shape.
  // Doing so also captured any OTHER aggregated dimension that happened to
  // share the expansion's slice_type — in Transcript Explorer, an aggregated
  // transcript slice on the opposite axis, which is an entirely ordinary
  // thing to configure. Such a dimension was routed here, materialized
  // per-pair, and its `aggregation` silently discarded, so that axis's
  // aggregation dropdown had no effect on the plot. The shape check also
  // disagreed with normalize() in plotConfigReducer, which has always used
  // the sentinel to decide whether `expand_by` is still live.
  const isExpanding = (k: string) =>
    (k === "x" || k === "y") && isExpansionDimension(dimensions[k]);

  const expandedKeys = dimensionKeys.filter(isExpanding);
  const broadcastKeys = dimensionKeys.filter((k) => !isExpanding(k));

  // Only an axis may expand. An expansion says what a POINT is, and the point
  // set is defined by the axes; `color` and `facet` are readings of it. They
  // also already have first-class ways to express the common need —
  // `color_by: "expansion"` and `facet_by: "expansion"` partition by the
  // member — so the sentinel here would mean something quite different
  // ("color by this point's member's value in some dataset"), which nothing
  // in the UI can produce.
  //
  // Rejected explicitly rather than left to fall through to the broadcast
  // path: that throws too, but with a message about mis-routing that sends
  // the reader looking for a bug that isn't there.
  const misplacedKeys = dimensionKeys.filter(
    (k) => !isExpanding(k) && isExpansionDimension(dimensions[k])
  );

  if (misplacedKeys.length > 0) {
    throw new Error(
      `Only the x and y axes can expand, but ${misplacedKeys
        .map((k) => `"${k}"`)
        .join(" and ")} carries the "expansion" sentinel on \`aggregation\`. ` +
        `To partition points by their expansion member, use ` +
        `\`color_by: "expansion"\` or \`facet_by: "expansion"\` instead.`
    );
  }

  // An `expand_by` with no sentinel-bearing axis has nothing to read the
  // expansion from: every dimension would be broadcast and each index
  // entity's single value replicated M times, producing an N×M plot of
  // duplicated points that looks plausible and is wrong. normalize() strips
  // `expand_by` in exactly this case, so reaching here means the config
  // bypassed the reducer (a hand-authored link, or a caller assembling a
  // config directly). Fail loudly instead.
  if (expandedKeys.length === 0) {
    throw new Error(
      `fetchExpandedPlot got an \`expand_by\` for "${exp.slice_type}" but no ` +
        `dimension carries the "expansion" sentinel on \`aggregation\`, so ` +
        `there is no axis to materialize the expansion from.`
    );
  }

  // Decide which members to show, before anything downstream, so we only query
  // Breadbox for the ones we keep. The context routinely resolves to more
  // members than a plot can render; chooseExpansionMembers picks by how much
  // each varies across the entities being plotted rather than by its position
  // in the context, which is what lets the plot drop pagination entirely.
  //
  // When both axes expand over the same members (short-read vs long-read), one
  // dataset has to arbitrate, and x does. That is a simplification — a member
  // flat in y's dataset can win a panel on x's variance alone. Combining the
  // two rankings would be fairer; the member table is where that would show up,
  // as a second set of columns rather than a different default. Until then the
  // table at least lets someone override the result by hand.
  const rankingKey = expandedKeys.includes("x") ? "x" : expandedKeys[0];
  const rankingDim = dimensions[rankingKey];

  const visibleFilter = filters?.visible as DataExplorerContextV2 | undefined;
  const rankingIsContinuous =
    (await fetchValueType(rankingDim)) === "continuous";

  const expIds = await chooseExpansionMembers({
    candidateIds: allExpIds,
    // The ranking dimension's dataset, so the cap and the ranking are both
    // reading the same index.
    cap: await maxExpansionMembersFor(index_type, rankingDim.dataset_id),
    index_type,
    dataset_id: rankingDim.dataset_id,
    slice_type: exp.slice_type,
    visibleFilter,
    isContinuous: rankingIsContinuous,
    pinnedIds: exp.members,
  });

  const totalExpansionMembers = allExpIds.length;
  const expansionTruncated = expIds.length < totalExpansionMembers;

  // How many members could be drawn at all, which is usually fewer than the
  // context named and is the number worth reporting: it says whether there is
  // anything left to pick. Skipped when it can't be learned cheaply or at all —
  // see `available_count` in @depmap/types. The all-are-shown case needs no
  // request, because the drawn members ARE every member and the values fetched
  // below already answer it.
  //
  // Every expanding axis has to measure a member, not just the ranking one.
  // Two axes on different datasets (short-read vs long-read) draw a point only
  // where both have a value, so a member absent from either can never appear —
  // shownMemberCount below already applies that rule, and counting availability
  // from one dataset left the two disagreeing. The gap showed as a control
  // offering members that could not be shown however they were picked, since
  // "shown < available" stayed true no matter what the user chose.
  const availableMemberCount = await (async () => {
    if (!expansionTruncated) {
      return undefined;
    }

    if (!rankingIsContinuous) {
      return undefined;
    }

    try {
      // Deduped, so the ordinary case — one expanding axis, or two sharing a
      // dataset — issues a single request. `cached` makes even that free
      // whenever the ranking already ran; it is a real request only for a
      // hand-picked selection, which never ranked.
      const datasetIds = [
        ...new Set(expandedKeys.map((key) => dimensions[key].dataset_id)),
      ];

      const perDataset = await Promise.all(
        datasetIds.map(async (dataset_id) => {
          const { stats } = await fetchExpansionMemberStats({
            candidateIds: allExpIds,
            index_type,
            dataset_id,
            slice_type: exp.slice_type,
            visibleFilter,
          });

          // No counts at all means the aggregation didn't apply to this dataset
          // (only the ranking dimension was checked for a continuous value
          // type). That is not the same as a dataset measuring none of them:
          // intersecting with its empty set would report nothing available
          // while points are plainly on screen, and hide the control in the one
          // case where it is most needed. Unknowable is the honest answer.
          if (stats.every((s) => s.count === null)) {
            return null;
          }

          return new Set(
            stats.filter((s) => (s.count ?? 0) > 0).map((s) => s.id)
          );
        })
      );

      if (perDataset.some((withData) => withData === null)) {
        return undefined;
      }

      return allExpIds.filter((id) =>
        (perDataset as Set<string>[]).every((withData) => withData.has(id))
      ).length;
    } catch (e) {
      // A count nobody can compute is not worth failing a plot over.
      window.console.warn("Could not determine available expansion members", e);
      return undefined;
    }
  })();

  const labelByMemberId = new Map<string, string>();
  for (let j = 0; j < allExpIds.length; j += 1) {
    labelByMemberId.set(allExpIds[j], allExpLabels[j]);
  }

  const expLabels = expIds.map((id) => labelByMemberId.get(id) as string);

  // Map from expansion id to its display label, for use during materialization.
  const expIdToLabel: Record<string, string> = {};
  for (let j = 0; j < expIds.length; j += 1) {
    expIdToLabel[expIds[j]] = expLabels[j];
  }

  // Shared state. Same pattern as fetchPlotDimensions: every fetcher
  // populates these; the canonical index is derived from them at the end.
  // Both are keyed/valued by ids throughout — the labels are looked up at
  // materialization via labelToIdMapping's inverse.
  const uniqueLabels = new Set<string>();
  const labelToIdMapping: Record<string, string> = {};

  // ------------------------------------------------------------------
  // Expanded dimension fetcher.
  // Pulls a matrix slice over the resolved expansion ids WITHOUT
  // aggregating, and returns values keyed by [indexId][expansionId].
  // ------------------------------------------------------------------
  async function fetchExpandedDimension(key: string) {
    const dim = dimensions[key];
    const { dataset_id, slice_type } = dim;

    const sliceIsSampleType = await isSampleType(slice_type);
    const indexIdentifiers = await fetchDatasetIdentifiers(
      index_type,
      dataset_id
    );

    const response = await cached(breadboxAPI, {
      persist: true,
    }).getMatrixDatasetData(dataset_id, {
      sample_identifier: "id",
      feature_identifier: "id",
      samples: sliceIsSampleType ? expIds : null,
      features: sliceIsSampleType ? null : expIds,
    });

    // Matrix responses are always Record<feature_id, Record<sample_id, value>>:
    //   - expansion-on-feature-axis: response[expId][indexId]
    //   - expansion-on-sample-axis:  response[indexId][expId]
    const lookup = (indexId: string, expId: string): number | null => {
      if (sliceIsSampleType) {
        return response[indexId]?.[expId] ?? null;
      }
      return response[expId]?.[indexId] ?? null;
    };

    const indexed_values: Record<string, Record<string, number | null>> = {};

    indexIdentifiers.forEach(({ id, label }) => {
      uniqueLabels.add(label);
      labelToIdMapping[label] = id;

      const inner: Record<string, number | null> = {};
      for (let j = 0; j < expIds.length; j += 1) {
        inner[expIds[j]] = lookup(id, expIds[j]);
      }
      indexed_values[id] = inner;
    });

    return {
      property: "dimensions" as const,
      kind: "expanded" as const,
      key,
      indexed_values,
    };
  }

  // ------------------------------------------------------------------
  // Broadcast (non-expanded) dimension fetcher.
  //
  // For broadcast dimensions every (index, expansion) point shares the
  // same value at a given index, so the fetcher only needs to produce
  // one value per index id. The materialization loop later replicates
  // each value M times to fill the N×M shape.
  //
  // Today two `axis_type` values reach this path:
  //   - "raw_slice":        a single named column from the dataset
  //                         (e.g. one gene's expression). Mirrors
  //                         fetchRawDimension in breadboxMethods.ts.
  //   - "aggregated_slice": a context resolved against a slice and
  //                         reduced to one value per index entity.
  //                         Mirrors fetchAggregatedDimension.
  //
  // The structure parallels fetchPlotDimensions's raw_slice /
  // aggregated_slice dispatch, but the helpers here are scoped to the
  // expanded path so they can pick up its shared state (uniqueLabels,
  // labelToIdMapping) without that being a contract on the upstream
  // helpers.
  // ------------------------------------------------------------------
  async function fetchBroadcastDimension(key: string) {
    const dim = dimensions[key];

    // Each helper returns the per-id values; the wrapper handles the
    // shared label-side-effect and the response envelope so that the
    // two paths can never silently diverge on the post-fetch shape.
    const { indexIdentifiers, indexed_values } =
      dim.axis_type === "raw_slice"
        ? await fetchBroadcastRawSliceValues(dim)
        : await fetchBroadcastAggregatedSliceValues(dim);

    // Side effect: register this dimension's labels into the shared
    // logical-index map. Done here (after the fetch) so both helpers
    // contribute consistently without each having to remember to do
    // it. Same writes the expanded-dimension fetcher performs.
    indexIdentifiers.forEach(({ id, label }) => {
      uniqueLabels.add(label);
      labelToIdMapping[label] = id;
    });

    return {
      property: "dimensions" as const,
      kind: "broadcast" as const,
      key,
      indexed_values,
    };
  }

  // Raw-slice broadcast helper. Pulls a single named column from the
  // dataset via `getDimensionDataWithoutLabels`, then keys the result
  // by index id. Caching: prefer this primitive over a filtered
  // tabular fetch because Breadbox's slice fetches cache cleanly today
  // while the tabular fetcher doesn't yet register cacheable slices.
  async function fetchBroadcastRawSliceValues(
    dim: DataExplorerPlotConfigDimension
  ): Promise<{
    indexIdentifiers: { id: string; label: string }[];
    indexed_values: Record<string, number | string | string[] | null>;
  }> {
    const { context, dataset_id, slice_type } = dim;

    const indexIdentifiers = await fetchDatasetIdentifiers(
      index_type,
      dataset_id
    );

    // Mirror fetchRawDimension's expression decoding. The dim's
    // context for raw_slice is always a single equality:
    //   { "==": [{ var: "..." }, identifier] }
    // identifier_type tells Breadbox which axis the identifier names.
    // For raw_slice the slice is on the "other" axis from the index —
    // so when slice_type is sample-typed, the identifier picks out a
    // sample column; otherwise it picks out a feature column.
    type VarEqualityExpression = {
      "==": [{ var: string }, string];
    };
    const [variable, identifier] = (context.expr as VarEqualityExpression)[
      "=="
    ];

    const sliceTypeIsSampleType = await isSampleType(slice_type);
    // De-nested from a nested ternary (no-nested-ternary). entity_label on a
    // non-depmap_model slice reads as a *label*; everything else as an *id*.
    const isEntityLabel =
      variable.var === "entity_label" && slice_type !== "depmap_model";
    const labelIdentifierType = sliceTypeIsSampleType
      ? "sample_label"
      : "feature_label";
    const idIdentifierType = sliceTypeIsSampleType ? "sample_id" : "feature_id";
    const identifier_type = isEntityLabel
      ? labelIdentifierType
      : idIdentifierType;

    const { ids, values } = await getDimensionDataWithoutLabels({
      dataset_id,
      identifier,
      identifier_type,
    });

    const indexed_values: Record<
      string,
      number | string | string[] | null
    > = {};
    for (let i = 0; i < ids.length; i += 1) {
      indexed_values[ids[i]] = values[i];
    }

    return { indexIdentifiers, indexed_values };
  }

  // Aggregated-slice broadcast helper. Resolves the context to a set
  // of slice-axis ids, then asks Breadbox to aggregate the matrix
  // along the slice axis into one value per index entity.
  async function fetchBroadcastAggregatedSliceValues(
    dim: DataExplorerPlotConfigDimension
  ): Promise<{
    indexIdentifiers: { id: string; label: string }[];
    indexed_values: Record<string, number | null>;
  }> {
    const { dataset_id, slice_type, context } = dim;

    const { aggregation } = dim;
    if (aggregation === "expansion") {
      throw new Error(
        `A dimension carrying the "expansion" sentinel on \`aggregation\` reached ` +
          `fetchBroadcastAggregatedSliceValues. "expansion" is not a real ` +
          `aggregation — expansion axes are materialized per-pair elsewhere in ` +
          `fetchExpandedPlot and must not be broadcast through the Breadbox ` +
          `aggregate path.`
      );
    }
    if (aggregation === "first" || aggregation === "correlation") {
      throw new Error(
        `aggregation "${aggregation}" is not supported by Breadbox.`
      );
    }

    const aggregate_by = (await isSampleType(slice_type))
      ? "samples"
      : "features";

    let ctxIds: string[] = [];
    try {
      const result = await evaluateContextPersisted(
        (context as unknown) as DataExplorerContextV2
      );
      ctxIds = result.ids;
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("dx2_context_eval_failed", { detail: context })
      );
      throw e;
    }

    const indexIdentifiers = await fetchDatasetIdentifiers(
      index_type,
      dataset_id
    );

    const response = await cached(breadboxAPI, {
      persist: true,
    }).getMatrixDatasetData(dataset_id, {
      sample_identifier: "id",
      feature_identifier: "id",
      samples: aggregate_by === "samples" ? ctxIds : null,
      features: aggregate_by === "features" ? ctxIds : null,
      aggregate: { aggregate_by, aggregation },
    });

    const indexed_values: Record<string, number | null> = {};
    indexIdentifiers.forEach(({ id }) => {
      indexed_values[id] = response[aggregation]?.[id] ?? null;
    });

    return { indexIdentifiers, indexed_values };
  }

  // ------------------------------------------------------------------
  // Filter fetcher (broadcast).
  // ------------------------------------------------------------------
  async function fetchFilterValues(filterKey: FilterKey) {
    const filter = (filters![filterKey] as unknown) as DataExplorerContextV2;

    try {
      const result = await evaluateContextPersisted(filter);

      const indexed_values: Record<string, true> = {};
      for (let i = 0; i < result.ids.length; i += 1) {
        indexed_values[result.ids[i]] = true;
      }

      return {
        property: "filters" as const,
        key: filterKey,
        name: filter.name,
        indexed_values,
      };
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("dx2_context_eval_failed", { detail: filter })
      );
      throw e;
    }
  }

  // ------------------------------------------------------------------
  // Metadata fetcher (broadcast). Mirrors the metadata branch of
  // fetchPlotDimensions: fetch via getDimensionDataWithoutLabels, derive
  // value_type, run the isBinaryish coercion, then return N-keyed values.
  // The color_property continuous→color promotion is applied during
  // materialization (after we know N).
  // ------------------------------------------------------------------
  async function fetchMetadataValues(metadataKey: string) {
    const sliceQuery = extendedMetadata[metadataKey] as SliceQuery;
    const data = await getDimensionDataWithoutLabels(sliceQuery);
    let value_type = await fetchValueType(sliceQuery);

    const indexed_values: Record<string, string | number | null> = {};
    const distinct = new Set<unknown>();

    for (let i = 0; i < data.values.length; i += 1) {
      const id = data.ids[i];
      const v = data.values[i];
      indexed_values[id] = v as string | number | null;

      if (v) {
        if (Array.isArray(v)) {
          v.forEach((vv) => distinct.add(vv));
        } else {
          distinct.add(v);
        }
      }
    }

    // No cardinality check here — see the note on the twin of this block in
    // breadboxMethods. How many distinct values an annotation has is a question
    // about legibility, which the renderer answers, not about whether the data
    // can be fetched.
    const isBinaryish =
      distinct.size <= 3 &&
      [...distinct].every((n) => n === 0 || n === 1 || n === 2);
    if (isBinaryish) {
      value_type = "categorical";
    }

    return {
      property: "metadata" as const,
      key: metadataKey,
      sliceQuery,
      value_type,
      indexed_values,
    };
  }

  // ------------------------------------------------------------------
  // Fire all fetches concurrently.
  // ------------------------------------------------------------------
  const [
    expandedResults,
    broadcastResults,
    filterResults,
    metadataResults,
  ] = await Promise.all([
    Promise.all(expandedKeys.map(fetchExpandedDimension)),
    Promise.all(broadcastKeys.map(fetchBroadcastDimension)),
    Promise.all(filterKeys.map(fetchFilterValues)),
    Promise.all(metadataKeys.map(fetchMetadataValues)),
  ]);

  // Members that actually put a point on the plot. Not `expIds.length`: the
  // dataset may simply not track a member the context named, and such a member
  // still gets its slot here — it just draws an empty panel, or a legend row
  // that toggles nothing.
  //
  // A point needs a value on EVERY expanding axis, not just one, so a member
  // measured in short-read but not long-read contributes nothing to a plot of
  // the two against each other and is counted accordingly.
  const shownMemberCount = (() => {
    const valueMaps = expandedResults.map((r) => r.indexed_values);

    if (valueMaps.length === 0) {
      return 0;
    }

    // Scoped to the visible entities, because availableMemberCount above is —
    // resolveRankingIndex narrows by this same filter — and the two get
    // compared to decide whether any member is left to add. A member with
    // values only in entities the user has filtered out draws nothing, so
    // counting it would overstate what is on screen and, by inflating this past
    // a correctly-narrowed availability, hide the control in exactly the case
    // where there IS something to add.
    const visibleIndexIds = filterResults.find((r) => r.key === "visible")
      ?.indexed_values;

    const indexIds = Object.keys(valueMaps[0]).filter(
      (indexId) => !visibleIndexIds || visibleIndexIds[indexId]
    );

    return expIds.filter((expId) =>
      indexIds.some((indexId) =>
        valueMaps.every(
          (m) =>
            m[indexId]?.[expId] !== null && m[indexId]?.[expId] !== undefined
        )
      )
    ).length;
  })();

  // ------------------------------------------------------------------
  // Build the canonical index (index-major cross product).
  //
  // Identity is `index_ids` (the post-refactor contract); labels are
  // derived in lockstep via labelToIdMapping's inverse. Inside this
  // loop, index_ids[i*M+j] is the same for all j (model repeats), and
  // expansion ids[i*M+j] is the same for all i (transcripts cycle).
  // ------------------------------------------------------------------
  const logicalLabels = [...uniqueLabels];
  const logicalIds = logicalLabels.map((label) => labelToIdMapping[label]);

  const N = logicalIds.length;
  const M = expIds.length;
  const NM = N * M;

  const index_ids: string[] = new Array(NM);
  const index_labels: string[] = new Array(NM);
  const expansionIdsFlat: string[] = new Array(NM);
  const expansionLabelsFlat: string[] = new Array(NM);

  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < M; j += 1) {
      const flat = i * M + j;
      index_ids[flat] = logicalIds[i];
      index_labels[flat] = logicalLabels[i];
      expansionIdsFlat[flat] = expIds[j];
      expansionLabelsFlat[flat] = expLabels[j];
    }
  }

  // ------------------------------------------------------------------
  // Materialize.
  // ------------------------------------------------------------------
  const out: DataExplorerExpandedPlotResponse = {
    index_type,
    index_id_column,
    index_display_name,
    index_ids,
    index_labels,
    dimensions: {} as DataExplorerExpandedPlotResponse["dimensions"],
    filters: {} as DataExplorerExpandedPlotResponse["filters"],
    metadata: {} as DataExplorerExpandedPlotResponse["metadata"],
    expansions: [
      {
        slice_type: exp.slice_type,
        id_column: expansion_id_column,
        display_name: expansion_display_name,
        ids: expansionIdsFlat,
        labels: expansionLabelsFlat,
        total_in_context: totalExpansionMembers,
        // With nothing truncated, every member the context named is drawn, so
        // "how many does the dataset track" is answered by what came back.
        available_count: expansionTruncated
          ? availableMemberCount
          : shownMemberCount,
        shown_count: shownMemberCount,
        truncated: expansionTruncated,
      },
    ],
  };

  const datasets = await cached(breadboxAPI).getDatasets();
  const dimTypeMap = buildDimTypeMap(dimTypes);
  const tablesByDim = buildTablesByDim(datasets);

  // Build per-metadata-key id→label maps for id-based slice queries.
  // Same pattern as fetchPlotDimensions; lets resolveDisplayLabel show
  // the leaf entity's human label instead of a bare id.
  const metadataIdToLabel: Record<
    string,
    Record<string, string> | undefined
  > = {};
  await Promise.all(
    Object.entries(extendedMetadata).map(async ([key, entry]) => {
      if (!isValidSliceQuery(entry as SliceQuery)) return;
      const sq = entry as SliceQuery;
      if (
        sq.identifier_type !== "feature_id" &&
        sq.identifier_type !== "sample_id"
      ) {
        return;
      }
      const dataset = datasets.find(
        (d) => d.id === sq.dataset_id || d.given_id === sq.dataset_id
      );
      if (!dataset || dataset.format !== "matrix_dataset") return;
      const dimTypeName =
        sq.identifier_type === "feature_id"
          ? dataset.feature_type_name
          : dataset.sample_type_name;
      if (!dimTypeName) return;
      const identifiers = await getDimensionTypeIdentifiersPersisted(
        dimTypeName
      );
      metadataIdToLabel[key] = Object.fromEntries(
        identifiers.map(({ id, label }) => [id, label])
      );
    })
  );

  // --- Expanded dimensions: pair-keyed lookup ---
  await Promise.all(
    expandedResults.map(async (r) => {
      const dim = dimensions[r.key];
      const ds = datasets.find(
        (d) => d.id === dim.dataset_id || d.given_id === dim.dataset_id
      );
      const [units, value_type, dataset_label] = await Promise.all([
        (async () => {
          const u = ds && "units" in ds ? ds.units : "";
          return u === "unitless" ? "" : u;
        })(),
        fetchValueType(dim),
        fetchDatasetLabel(dim.dataset_id),
      ]);

      // The value axis describes the MEASUREMENT, not the selection.
      // Each point is a specific (index, expansion) value — e.g. one
      // (model, transcript) expression — not an aggregate over the
      // expansion, so the axis names the kind of value, never the
      // expansion's context. The expansion's identity lives on the
      // expansion axis (hover today; per-panel labels under small
      // multiples), which is also why this scales cleanly to M > 1:
      // the value axis stays a single measurement name no matter how
      // many expansion dimensions there are, rather than trying to
      // enumerate selections it can't coherently fit.
      //
      // Prefer the dataset's `data_type` as a concise measurement name
      // ("Expression"); fall back to the dataset display name when
      // data_type is absent so the label is never empty. Units in
      // parens, matching the convention used elsewhere in this file.
      const measurement = ds?.data_type || dataset_label || "";
      const axis_label = measurement + (units ? ` (${units})` : "");

      const values: (number | null)[] = new Array(NM);
      for (let i = 0; i < N; i += 1) {
        const inner = r.indexed_values[logicalIds[i]] || {};
        for (let j = 0; j < M; j += 1) {
          values[i * M + j] = inner[expIds[j]] ?? null;
        }
      }

      out.dimensions[r.key as keyof DataExplorerPlotResponse["dimensions"]] = {
        slice_type: dim.slice_type,
        dataset_id: dim.dataset_id,
        axis_label,
        dataset_label,
        // fetchValueType widens to `string | null` (it also serves non-matrix
        // col_type lookups); narrow back to the response union here, as the
        // metadata branch below already does.
        value_type: value_type as DataExplorerPlotResponseDimension["value_type"],
        values: values as number[],
        units: ds && "units" in ds ? ds.units : "unitless",
      };
    })
  );

  // --- Broadcast dimensions: id-keyed lookup, replicated M times ---
  await Promise.all(
    broadcastResults.map(async (r) => {
      const dim = dimensions[r.key];
      const bds = datasets.find(
        (d) => d.id === dim.dataset_id || d.given_id === dim.dataset_id
      );
      const [axis_label, value_type, dataset_label] = await Promise.all([
        fetchAxisLabel(dim),
        fetchValueType(dim),
        fetchDatasetLabel(dim.dataset_id),
      ]);

      // Broadcast values can now be non-numeric — raw_slice can carry
      // strings or string arrays (e.g. for categorical columns). For
      // numeric value_types this is still effectively `(number | null)[]`;
      // the wider type accommodates the categorical/text cases without
      // forcing every consumer of the response to handle them yet. The
      // downstream renderer's expectations are unchanged for now —
      // when something hands a string-valued raw_slice to a scatter's
      // x or y, that's a config-level mistake we'll catch with a
      // separate, more informative error than letting it silently
      // fall through.
      type BroadcastValue = number | string | string[] | null;
      const values: BroadcastValue[] = new Array(NM);
      for (let i = 0; i < N; i += 1) {
        const v: BroadcastValue = r.indexed_values[logicalIds[i]] ?? null;
        for (let j = 0; j < M; j += 1) {
          values[i * M + j] = v;
        }
      }

      // color/facet dim isBinaryish coercion (matches fetchPlotDimensions).
      let vt = value_type;
      if (r.key === "color" || r.key === "facet") {
        const distinct = new Set(values.filter((v) => v != null));
        const isBinaryish =
          distinct.size <= 3 &&
          [...distinct].every((n) => n === 0 || n === 1 || n === 2);
        if (isBinaryish) vt = "categorical";
      }

      out.dimensions[r.key as keyof DataExplorerPlotResponse["dimensions"]] = {
        slice_type: dim.slice_type,
        dataset_id: dim.dataset_id,
        axis_label,
        dataset_label,
        value_type: vt as DataExplorerPlotResponseDimension["value_type"],
        // Cast through. The response type today narrows values to
        // number[]; widening that union is a separate, larger change
        // that would touch every downstream consumer.
        values: values as number[],
        units: bds && "units" in bds ? bds.units : "unitless",
      };
    })
  );

  // --- Filters: boolean per logical id, replicated M times ---
  for (const r of filterResults) {
    const values = new Array<boolean>(NM);
    for (let i = 0; i < N; i += 1) {
      const v = r.indexed_values[logicalIds[i]] ?? false;
      for (let j = 0; j < M; j += 1) {
        values[i * M + j] = v;
      }
    }
    out.filters[r.key] = { name: r.name, values };
  }

  // --- Metadata: scalar per logical id, replicated M times ---
  for (const r of metadataResults) {
    const dataset = datasets.find(
      (d) =>
        d.id === r.sliceQuery.dataset_id ||
        d.given_id === r.sliceQuery.dataset_id
    );
    const units = dataset && "units" in dataset ? dataset.units : undefined;
    // Flattened from a nested ternary (no-nested-ternary). Both original arms
    // returned `dataset.name`, so the label is the dataset name whenever it's a
    // non-tabular dataset OR a tabular one that isn't the index's own metadata
    // table; otherwise undefined.
    const dataset_label =
      dataset &&
      (dataset.format !== "tabular_dataset" ||
        dataset.given_id !== `${index_type}_metadata`)
        ? dataset.name
        : undefined;

    const values: (string | number | null)[] = new Array(NM);
    for (let i = 0; i < N; i += 1) {
      const v = r.indexed_values[logicalIds[i]] ?? null;
      for (let j = 0; j < M; j += 1) {
        values[i * M + j] = v;
      }
    }

    const label = resolveDisplayLabel(
      (r.sliceQuery as unknown) as DataExplorerContextVariable,
      index_type,
      tablesByDim,
      dimTypeMap,
      metadataIdToLabel[r.key]
    );

    // "I never imagined there would be continuous metadata" promotion,
    // mirrored from fetchPlotDimensions. In an expanded plot this means
    // color/facet is model-keyed (broadcasts across all M transcripts per
    // model), which is the right behavior.
    if (
      (r.key === "color_property" || r.key === "facet_property") &&
      r.value_type === "continuous"
    ) {
      const dimKey = r.key === "color_property" ? "color" : "facet";

      out.dimensions[dimKey] = ({
        axis_label: label,
        dataset_id: r.sliceQuery.dataset_id,
        dataset_label,
        slice_type: null,
        values,
        value_type: r.value_type,
        units: "unitless",
      } as unknown) as DataExplorerPlotResponseDimension;
      continue;
    }

    out.metadata[r.key] = {
      label,
      sliceQuery: r.sliceQuery,
      // The metadata value_type union excludes "list_strings"; cast through.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value_type: r.value_type as any,
      units,
      dataset_label,
      values,
    };
  }

  return out;
}

// Expanded waterfall fetcher. Parallels fetchWaterfall's relationship to
// fetchPlotDimensions: the underlying expanded fetcher is plot-type-agnostic
// (it just materializes N×M points across an index and an expansion), and
// this wrapper applies the waterfall-specific shape transformation that
// `formatDataForWaterfall` and PrototypeScatterPlot both depend on.
//
// The transformation:
//   - the plot config's `x` dimension (the per-point value being plotted)
//     is remapped onto `dimensions.y`. The renderer reads `data.y` for
//     bar height; without this remap, `dimensions.y` is undefined,
//     `formattedData.y` becomes null, and PrototypeScatterPlot's `y[i]`
//     dereferences crash.
//   - `dimensions.x` is replaced with a filler rank array of length N×M.
//     `formatDataForWaterfall` builds the real x positions afterward via
//     its clustering loop; this placeholder exists so that the response's
//     shape — every parallel array sized to N×M — stays consistent and
//     downstream `nullifyUnplottableValues` calls produce a parallel-length
//     output. The values themselves never reach the renderer; the loop
//     overwrites them.
//
// Notably absent: the sort-by-rank step that fetchWaterfall does. That
// step is plot-config-time ordering of the data; in the expanded case
// the materialization loop has already determined order (row-major over
// (logical_i, j)), and the visual clustering happens later in
// formatDataForWaterfall. Sorting here would scramble the index↔expansion
// pairing.
//
// This wrapper is a deliberate adapter — it exists because the renderer
// assumes a 2D scatter response, and `formatDataForWaterfall` trusts that
// assumption. Both are downstream of the same architectural limitation; the
// wrapper can be retired once the renderer no longer requires that shape.
export async function fetchExpandedWaterfall(
  plotConfig: DataExplorerExpandedPlotConfig
): Promise<DataExplorerExpandedPlotResponse> {
  const expanded = await fetchExpandedPlot(plotConfig);
  const NM = expanded.index_ids.length;

  const valueDim = expanded.dimensions.x;
  if (!valueDim) {
    // Defensive — every plot config we currently expect here has an x.
    // If something unexpected slips through, surface it rather than
    // produce a silently-wrong response.
    throw new Error(
      "fetchExpandedWaterfall: expected expanded response to carry an `x` dimension"
    );
  }

  return {
    ...expanded,
    dimensions: {
      ...expanded.dimensions,
      // Filler rank array, overwritten by formatDataForWaterfall's
      // clustering loop. Carries valueDim's metadata for consistency
      // (slice_type, dataset_id) so any code that introspects it
      // doesn't see undefined fields.
      x: {
        ...valueDim,
        axis_label: "Rank",
        dataset_label: "",
        value_type: "continuous",
        values: Array.from({ length: NM }, (_, i) => i),
        // A rank axis has no units (override valueDim's).
        units: "unitless",
      },
      // The value-bearing dimension, lifted from x.
      y: valueDim,
    },
  };
}
