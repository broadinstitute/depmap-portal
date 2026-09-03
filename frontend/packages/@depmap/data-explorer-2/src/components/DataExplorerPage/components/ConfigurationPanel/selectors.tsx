import React, { useEffect, useRef, useState } from "react";
import { Checkbox } from "react-bootstrap";
import { breadboxAPI, cached } from "@depmap/api";
import {
  ColorByValue,
  DataExplorerDatasetDescriptor,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimensionV2,
} from "@depmap/types";
import { dataExplorerAPI } from "../../../../services/dataExplorerAPI";
import {
  getDimensionTypeLabel,
  pluralize,
  sortDimensionTypes,
} from "../../../../utils/misc";
import renderConditionally from "../../../../utils/render-conditionally";
import PlotConfigSelect from "../../../PlotConfigSelect";
import DimensionSelectV2 from "../../../DimensionSelectV2";
import HelpTip from "../HelpTip";
import styles from "../../styles/ConfigurationPanel.scss";

type DatasetsByIndexType = Record<string, DataExplorerDatasetDescriptor[]>;

export function PlotTypeSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (nextValue: string) => void;
}) {
  return (
    <PlotConfigSelect
      label={
        <span>
          Plot Type
          <HelpTip id="plot-type-help" />
        </span>
      }
      inlineLabel
      placeholder="Select type…"
      options={{
        density_1d: "Density 1D",
        waterfall: "Waterfall",
        scatter: "Scatter plot",
        correlation_heatmap: "Correlation heatmap",
      }}
      show
      enable
      value={value}
      onChange={(nextValue) => onChange(nextValue as string)}
    />
  );
}

export function PointsSelector({
  show,
  enable,
  value,
  plot_type,
  onChange,
}: any) {
  const [
    datasetsByIndexType,
    setDatasetsByIndexType,
  ] = useState<DatasetsByIndexType | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await dataExplorerAPI.fetchDatasetsByIndexType();
        setDatasetsByIndexType(data);
      } catch (e) {
        window.console.error(e);
      }
    })();
  }, []);

  const unsortedTypes = Object.keys(datasetsByIndexType || {});

  if (value && !unsortedTypes.includes(value)) {
    unsortedTypes.push(value);
  }

  const sortedTypes = sortDimensionTypes(unsortedTypes)
    // TODO: Remove this filter. It's only relevant to legacy mode.
    .filter((index_type) => {
      if (
        index_type === "other" &&
        value !== "other" &&
        plot_type === "scatter"
      ) {
        return false;
      }

      return true;
    });

  const isLoading = !datasetsByIndexType;

  const options = isLoading
    ? { [value]: "Loading..." }
    : sortedTypes.reduce(
        (memo, index_type) => ({
          ...memo,
          [index_type]: pluralize(getDimensionTypeLabel(index_type)),
        }),
        {}
      );

  return (
    <div className={styles.PointsSelector}>
      <PlotConfigSelect
        label={
          plot_type === "correlation_heatmap" ? (
            <span>
              Indexed by
              {/* TODO: write help text describing how to selet this */}
            </span>
          ) : (
            <span>
              Points
              <HelpTip id="points-help" />
            </span>
          )
        }
        inlineLabel
        placeholder="Select points…"
        options={options}
        show={show}
        enable={enable && !isLoading}
        value={value}
        isLoading={isLoading}
        onChange={onChange}
      />
    </div>
  );
}

export function ColorByTypeSelector({
  show,
  enable,
  value,
  index_type,
  expansionSliceType = null,
  onChange,
}: {
  show: boolean;
  enable: boolean;
  value: string | null;
  index_type: string;
  // The slice_type of the current expansion (plot.expand_by?.[0]?.slice_type)
  // — labels the "expansion" option with its real dimension type instead of
  // a hardcoded "Transcript". Falls back to "Transcript" when the label
  // hasn't resolved yet, or when this is unset but `value` is already
  // "expansion" (a plot can be seeded with color_by: "expansion" before its
  // expand_by is ever populated).
  expansionSliceType?: string | null;
  onChange: (nextValue: DataExplorerPlotConfig["color_by"]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [indexTypeLabel, setIndexTypeLabel] = useState(
    getDimensionTypeLabel(index_type)
  );
  const [expansionTypeLabel, setExpansionTypeLabel] = useState(
    getDimensionTypeLabel(expansionSliceType ?? undefined)
  );
  useEffect(() => {
    (async () => {
      cached(breadboxAPI)
        .getDimensionTypes()
        // HACK: `getDimensionTypeLabel` is synchronous when it should be async.
        // This is to keep some legacy code working. It falls back to using the type `name`
        // instead of `display_name` until `getDimensionTypes()` has been cached.
        .then(() => {
          setTimeout(() => {
            setIndexTypeLabel(getDimensionTypeLabel(index_type));
            setExpansionTypeLabel(
              getDimensionTypeLabel(expansionSliceType ?? undefined)
            );
          });
        });
    })();
  }, [index_type, expansionSliceType]);

  const options: Partial<Record<ColorByValue, string>> = {
    raw_slice: indexTypeLabel,
  };

  const helpContent: React.ReactNode[] = [
    <p key={0}>
      Choose <b>{indexTypeLabel}</b> to color a single point.
    </p>,
  ];

  if (index_type !== null) {
    options.aggregated_slice = `${indexTypeLabel} Context`;
    helpContent.push(
      <p key={1}>
        Choose <b>{indexTypeLabel} Context</b> to color by membership in a
        user-defined context.
      </p>
    );
  }

  options.property = `${indexTypeLabel} Annotation`;
  helpContent.push(
    <p key={2}>
      Choose <b>{indexTypeLabel} Annotation</b> to color by major properties of
      the {indexTypeLabel}, such as selectivity for genes or lineage for models.
    </p>
  );

  options.custom = "Dataset";
  helpContent.push(
    <p key={3}>
      Choose <b>Dataset</b> to treat color as a third axis, letting you choose
      any data type that could have been an axis.
    </p>
  );

  // Always a real, selectable, always-available option (ADR 0004/Addendum 2):
  // defers coloring entirely to facet_by's own resolution. It's also the
  // implicit default whenever color_by is absent, so this is never a special
  // case to build UI around — just another value in the list.
  options.facet = "Match Facet By";
  helpContent.push(
    <p key={4}>
      Choose <b>Match Facet By</b> to color points the same way they&apos;re
      faceted (the default whenever a facet is chosen).
    </p>
  );

  // Only a real, meaningful choice once an expansion actually exists — or
  // when `value` is already "expansion" (a plot can be seeded that way
  // before its expand_by is populated). Never shown otherwise (no DE2-main
  // UI sets expand_by today).
  if (expansionSliceType || value === "expansion") {
    options.expansion = expansionTypeLabel || "Transcript";
    helpContent.push(
      <p key={5}>
        Choose <b>{expansionTypeLabel || "Transcript"}</b> to color by the
        expanded per-{(expansionTypeLabel || "Transcript").toLowerCase()} rows.
      </p>
    );
  }

  return (
    <div ref={ref} className={styles.facetAndColorTypeSelect}>
      <PlotConfigSelect
        label={
          <span>
            Color by
            {index_type && (
              <HelpTip id="color-by-help" customContent={helpContent} />
            )}
          </span>
        }
        placeholder="Choose type…"
        options={options}
        show={show}
        enable={enable}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue as DataExplorerPlotConfig["color_by"]);

          setTimeout(() => {
            ref.current?.parentElement?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }, 0);
        }}
      />
    </div>
  );
}

// facet_by reuses ColorByValue's value set, minus the color-only sentinels
// ("facet"/"uniform" only make sense for deferring/opting-out of color).
type FacetByValue = ColorByValue;

export function FacetByTypeSelector({
  show,
  enable,
  value,
  index_type,
  expansionSliceType = null,
  onChange,
}: {
  show: boolean;
  enable: boolean;
  value: string | null;
  index_type: string;
  // See ColorByTypeSelector's identical prop for the full rationale.
  expansionSliceType?: string | null;
  onChange: (nextValue: DataExplorerPlotConfig["facet_by"] | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [indexTypeLabel, setIndexTypeLabel] = useState(
    getDimensionTypeLabel(index_type)
  );
  const [expansionTypeLabel, setExpansionTypeLabel] = useState(
    getDimensionTypeLabel(expansionSliceType ?? undefined)
  );

  useEffect(() => {
    (async () => {
      cached(breadboxAPI)
        .getDimensionTypes()
        .then(() => {
          setTimeout(() => {
            setIndexTypeLabel(getDimensionTypeLabel(index_type));
            setExpansionTypeLabel(
              getDimensionTypeLabel(expansionSliceType ?? undefined)
            );
          });
        });
    })();
  }, [index_type, expansionSliceType]);

  const options: Partial<Record<FacetByValue, string>> = {
    raw_slice: indexTypeLabel,
  };

  const helpContent: React.ReactNode[] = [
    <p key={0}>
      Choose <b>{indexTypeLabel}</b> to facet by a single point.
    </p>,
  ];

  options.aggregated_slice = `${indexTypeLabel} Context`;
  helpContent.push(
    <p key={1}>
      Choose <b>{indexTypeLabel} Context</b> to facet by membership in a
      user-defined context.
    </p>
  );

  options.property = `${indexTypeLabel} Annotation`;
  helpContent.push(
    <p key={2}>
      Choose <b>{indexTypeLabel} Annotation</b> to facet by major properties of
      the {indexTypeLabel}, such as selectivity for genes or lineage for models.
    </p>
  );

  options.custom = "Dataset";
  helpContent.push(
    <p key={3}>
      Choose <b>Dataset</b> to treat facet as a third axis, letting you choose
      any data type that could have been an axis.
    </p>
  );

  // Only a real, meaningful choice once an expansion actually exists — or
  // when `value` is already "expansion" (a plot can be seeded that way
  // before its expand_by is populated). Never shown otherwise (no DE2-main
  // UI sets expand_by today).
  if (expansionSliceType || value === "expansion") {
    options.expansion = expansionTypeLabel || "Transcript";
    helpContent.push(
      <p key={4}>
        Choose <b>{expansionTypeLabel || "Transcript"}</b> to facet by the
        expanded per-{(expansionTypeLabel || "Transcript").toLowerCase()} rows.
      </p>
    );
  }

  return (
    <div ref={ref} className={styles.facetAndColorTypeSelect}>
      <PlotConfigSelect
        isClearable
        label={
          <span>
            Facet by
            {index_type && (
              <HelpTip id="facet-by-help" customContent={helpContent} />
            )}
          </span>
        }
        placeholder="Choose type…"
        options={options}
        show={show}
        enable={enable}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue as DataExplorerPlotConfig["facet_by"] | null);

          setTimeout(() => {
            ref.current?.parentElement?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }, 0);
        }}
      />
    </div>
  );
}

export function SortBySelector({
  show,
  enable,
  value,
  onChange,
}: {
  show: boolean;
  enable: boolean;
  value: string;
  onChange: (nextValue: DataExplorerPlotConfig["sort_by"]) => void;
}) {
  return (
    <div className={styles.sortBySelector}>
      <PlotConfigSelect
        label="Sort facets by"
        placeholder="Select sort…"
        options={{
          alphabetical: "Alphabetical",
          mean_values_asc: "Mean values (ascending)",
          mean_values_desc: "Mean values (descending)",
          max_values: "Max values",
          min_values: "Min values",
          num_points: "Number of points",
        }}
        show={show}
        enable={enable}
        value={value}
        onChange={(nextValue) =>
          onChange(nextValue as DataExplorerPlotConfig["sort_by"])
        }
      />
    </div>
  );
}

export function ColorByDimensionSelect({
  plot_type,
  index_type,
  value,
  onChange,
  onClickCreateContext,
  onClickSaveAsContext,
  sortByValue = undefined,
  onChangeSortBy = undefined,
}: {
  plot_type: string;
  index_type: string | null;
  value: Partial<DataExplorerPlotConfigDimensionV2> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimensionV2>) => void;
  onClickCreateContext: () => void;
  onClickSaveAsContext: () => void;
  // Optional: omitting these (both, together) opts a caller out of the
  // embedded secondary sort-by selector entirely — no render, no
  // getDataset fetch. Callers that have their own, single primary sort
  // selector elsewhere (e.g. Transcript Explorer) should omit them rather
  // than passing a stub.
  sortByValue?: string;
  onChangeSortBy?: (nextValue: DataExplorerPlotConfig["sort_by"]) => void;
}) {
  const [showSortBy, setShowSortBy] = useState(false);

  useEffect(() => {
    if (
      onChangeSortBy &&
      ["density_1d", "waterfall"].includes(plot_type) &&
      value?.dataset_id
    ) {
      cached(breadboxAPI)
        .getDataset(value.dataset_id)
        .then((d) => {
          setShowSortBy(
            d.format === "matrix_dataset" && d.value_type !== "continuous"
          );
        });
    } else {
      setShowSortBy(false);
    }
  }, [plot_type, value, onChangeSortBy]);

  return (
    <>
      <DimensionSelectV2
        allowNullFeatureType
        allowCategoricalValueType
        className={styles.customColorDimension}
        index_type={index_type!}
        value={value}
        onChange={onChange}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
        mode="entity-or-context"
        includeAllInContextOptions={false}
        onHeightChange={(el) => {
          el.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }}
      />
      {showSortBy && onChangeSortBy && (
        <div className={styles.customColorSortBy}>
          <SortBySelector
            show
            enable
            value={sortByValue ?? ""}
            onChange={onChangeSortBy}
          />
        </div>
      )}
    </>
  );
}

export const ShowPointsCheckbox = renderConditionally(
  ({
    value,
    onChange,
  }: {
    value: boolean;
    onChange: (nextValue: boolean) => void;
  }) => {
    return (
      <Checkbox
        className={styles.checkbox}
        checked={value}
        onChange={(e) => onChange((e.target as any).checked)}
      >
        <span>Show points</span>
      </Checkbox>
    );
  }
);

export const ShowIdentityLineCheckbox = renderConditionally(
  ({
    value,
    onChange,
  }: {
    value: boolean;
    onChange: (nextValue: boolean) => void;
  }) => {
    return (
      <Checkbox
        className={styles.checkbox}
        checked={value}
        onChange={(e) => onChange((e.target as any).checked)}
      >
        <span>
          Show <i>y</i>
          <span style={{ marginLeft: 2 }}>=</span>
          <i>x</i> line
        </span>
      </Checkbox>
    );
  }
);

export function ShowRegressionLineCheckbox({ value, onChange }: any) {
  return (
    <Checkbox
      className={styles.checkbox}
      checked={value}
      onChange={(e) => onChange((e.target as any).checked)}
    >
      <span>Show regression line(s)</span>
    </Checkbox>
  );
}

// Sub-option of ShowRegressionLineCheckbox, so it's `renderConditionally` —
// unlike its parent, it's only offered when a faceted plot has a color
// partition of its own to split each panel's fit by (see
// canShowRegressionLinePerColor).
export const ShowRegressionLinePerColorCheckbox = renderConditionally(
  ({
    value,
    onChange,
  }: {
    value: boolean;
    onChange: (nextValue: boolean) => void;
  }) => {
    return (
      <Checkbox
        className={styles.checkbox}
        checked={value}
        onChange={(e) => onChange((e.target as any).checked)}
      >
        <span>One line per color in each facet</span>
      </Checkbox>
    );
  }
);

export const UseClusteringCheckbox = renderConditionally(
  ({ value, onChange }: any) => {
    return (
      <Checkbox
        checked={value}
        onChange={(e) => onChange((e.target as any).checked)}
      >
        <span>Use clustering</span>
      </Checkbox>
    );
  }
);
