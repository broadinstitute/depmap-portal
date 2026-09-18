import React from "react";
import { showInfoModal } from "@depmap/common-components";
import SliceTable, { CustomColumn } from "@depmap/slice-table";
import {
  DataExplorerContextV2,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  DimensionKey,
  isValidSliceQuery,
  SliceQuery,
} from "@depmap/types";
import { contextToSliceSelection } from "../../../DimensionSelectV2/DimensionSliceSelect/sliceSelectAdapters";
import { usePlotlyLoader } from "../../../../contexts/PlotlyLoaderContext";
import styles from "../../styles/DataExplorer2.scss";

// A "raw_slice" dimension predates the SliceQuery format, but its context
// is, in the common case, just a `{"==": [{"var": "given_id"}, id]}`
// expression naming one dataset feature (or, when its dimension_type
// matches the plot's own index_type, one sample) — the same shape
// contextToSliceSelection already knows how to read (it's the inverse of
// what DimensionSliceSelect writes when someone picks a dimension this
// way in the first place). Collapsing that down to `{dataset_id,
// identifier, identifier_type}` is exactly a SliceQuery.
//
// An "aggregated_slice" dimension has no such single feature/sample to
// point to — there is no SliceQuery format for "the mean of a context" —
// so this returns null for those (and for any raw_slice whose context
// isn't the simple single-equality form above), and the caller falls back
// to a CustomColumn showing the value the plot already computed.
//
// The context is cast to V2 rather than checked for it: V1 contexts are
// fully retired and only ever exist in legacy links, which get converted
// at bootstrap — by the time a plot config reaches here, there is no V1
// left to handle.
export function dimensionToSliceQuery(
  dimension: DataExplorerPlotConfigDimension | undefined,
  index_type: string
): SliceQuery | null {
  if (!dimension || dimension.axis_type !== "raw_slice") {
    return null;
  }

  const context = dimension.context as DataExplorerContextV2;
  const selection = contextToSliceSelection(context);

  if (!selection) {
    return null;
  }

  const sliceQuery: SliceQuery = {
    dataset_id: dimension.dataset_id,
    identifier: selection.id,
    identifier_type:
      context.dimension_type === index_type ? "sample_id" : "feature_id",
  };

  return isValidSliceQuery(sliceQuery) ? sliceQuery : null;
}

export function buildTableConfig(
  data: DataExplorerPlotResponse,
  plotConfig: DataExplorerPlotConfig
): {
  rowIds: Set<string>;
  initialSlices: SliceQuery[];
  customColumns: CustomColumn[];
} {
  const visible = data.filters?.visible?.values;
  const rowIds = new Set(
    data.index_ids.filter((_, i) => !visible || visible[i])
  );

  const idToIndex = new Map(data.index_ids.map((id, i) => [id, i]));

  const columnFor = (
    csvHeader: string,
    values: readonly (string | number | null)[]
  ): CustomColumn => ({
    header: () => csvHeader,
    csvHeader,
    accessorFn: (row) => {
      const i = idToIndex.get(row.id as string);
      return i === undefined ? undefined : values[i];
    },
    cell: (ctx) => (ctx.getValue() as React.ReactNode) ?? "",
  });

  // No id/label column of our own: SliceTable already shows both, natively,
  // for whatever index_type_name it's given (that's what its own
  // hideIdColumn/hideLabelColumn props are toggling) — including the old
  // CSV's depmap_model special case (real ID column + cell line name as the
  // label), so there's nothing left here that it doesn't already cover.
  const initialSlices: SliceQuery[] = [];
  const customColumns: CustomColumn[] = [];

  (Object.keys(data.dimensions) as (DimensionKey | "x2")[]).forEach((key) => {
    const dimension = data.dimensions[key];

    if (!dimension) {
      return;
    }

    // "x2" only exists for correlation_heatmap, which never reaches this
    // modal — plotConfig.dimensions has no such key to look up anyway.
    const sliceQuery =
      key === "x2"
        ? null
        : dimensionToSliceQuery(plotConfig.dimensions[key], data.index_type);

    if (sliceQuery) {
      initialSlices.push(sliceQuery);
      return;
    }

    customColumns.push(
      columnFor(
        `${dimension.axis_label} ${dimension.dataset_label}`,
        dimension.values
      )
    );
  });

  Object.values(data.metadata ?? {}).forEach((slice) => {
    if (!slice) {
      return;
    }

    // Already resolved to a real SliceQuery by the time it reaches a
    // DataExplorerPlotResponse — see utils.ts's slice-id-to-SliceQuery
    // conversion — so there's no aggregation question here the way there
    // is for dimensions above; metadata is never an aggregate.
    if (slice.sliceQuery) {
      initialSlices.push(slice.sliceQuery);
      return;
    }

    customColumns.push(columnFor(slice.label, slice.values));
  });

  return { rowIds, initialSlices, customColumns };
}

export default function showExportCsvModal(
  data: DataExplorerPlotResponse,
  plotConfig: DataExplorerPlotConfig,
  filename: string,
  PlotlyLoader: ReturnType<typeof usePlotlyLoader>
) {
  const { rowIds, initialSlices, customColumns } = buildTableConfig(
    data,
    plotConfig
  );

  showInfoModal({
    title: "Export data",
    closeButtonText: "Close",
    modalProps: { className: styles.exportCsvModal, bsSize: "lg" },
    content: (
      <div className={styles.exportCsvModalBody}>
        <SliceTable
          PlotlyLoader={PlotlyLoader}
          index_type_name={data.index_type}
          downloadFilename={filename}
          getInitialState={() => ({ initialSlices })}
          // See SliceTable's own comment on rowIds vs implicitFilter: rowIds
          // scopes the fetch (the common, fast path); implicitFilter is the
          // belt-and-suspenders fallback for the slices it can't subset
          // (matrix slices, reindex_through chains), which still come back
          // whole and need filtering client-side.
          rowIds={rowIds}
          implicitFilter={({ id }) => rowIds.has(id)}
          customColumns={customColumns}
          customColumnPlacement="beforeSliceColumns"
          // This modal has no separate "primary action" of its own (see
          // the conversation that led here) — this button completing the
          // download *is* the point of opening it, so it should look like
          // the thing to click, not one option alongside "Filters".
          downloadButtonBsStyle="primary"
        />
      </div>
    ),
  });
}
