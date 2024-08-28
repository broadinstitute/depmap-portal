import React, { useEffect, useState } from "react";
import { Checkbox } from "react-bootstrap";
import {
  capitalize,
  fetchDatasetsByIndexType,
  fetchMetadataSlices,
  getDimensionTypeLabel,
  PlotConfigSelect,
  pluralize,
  renderConditionally,
  sortDimensionTypes,
} from "@depmap/data-explorer-2";
import {
  colorByValue,
  DataExplorerDatasetDescriptor,
  DataExplorerPlotConfig,
} from "@depmap/types";
import HelpTip from "src/data-explorer-2/components/HelpTip";
import styles from "src/data-explorer-2/styles/ConfigurationPanel.scss";

export { default as DatasetMetadataSelector } from "src/data-explorer-2/components/ConfigurationPanel/DatasetMetadataSelector";

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
        const data = await fetchDatasetsByIndexType();
        setDatasetsByIndexType(data);
      } catch (e) {
        window.console.error(e);
      }
    })();
  }, []);

  const types = sortDimensionTypes(
    Object.keys(datasetsByIndexType || {})
  ).filter((index_type) => {
    if (
      index_type === "other" &&
      value !== "other" &&
      plot_type === "scatter"
    ) {
      return false;
    }

    return true;
  });

  if (value && !types.includes(value)) {
    // Also add the currently selected index_type (just in case we're viewing
    // an old plot that was generated when different options were present).
    types.push(value);
  }

  const options = types.reduce(
    (memo: any, index_type: any) => ({
      ...memo,
      [index_type]: capitalize(pluralize(getDimensionTypeLabel(index_type))),
    }),
    {}
  );

  return (
    <div className={styles.PointsSelector}>
      <PlotConfigSelect
        label={
          // TODO: Write different help content for correlation_heatmap
          <span>
            Points
            {plot_type !== "correlation_heatmap" && (
              <HelpTip id="points-help" />
            )}
          </span>
        }
        inlineLabel
        placeholder="Select points…"
        options={options}
        show={show}
        enable={enable}
        value={value}
        isLoading={!datasetsByIndexType}
        onChange={onChange}
      />
    </div>
  );
}

export function ColorByTypeSelector({
  show,
  enable,
  value,
  slice_type,
  onChange,
}: {
  show: boolean;
  enable: boolean;
  value: string | null;
  slice_type: string;
  onChange: (nextValue: DataExplorerPlotConfig["color_by"]) => void;
}) {
  const sliceTypeLabel = capitalize(getDimensionTypeLabel(slice_type));
  const [hasSomeColorProperty, setHasSomeColorProperty] = useState(false);

  useEffect(() => {
    (async () => {
      const keyedSlices = await fetchMetadataSlices(slice_type);
      const slices = Object.values(keyedSlices);
      setHasSomeColorProperty(slices.some((slice) => !slice.isHighCardinality));
    })();
  }, [slice_type]);

  const options: Partial<Record<colorByValue, string>> = {
    raw_slice: sliceTypeLabel,
  };

  const helpContent: React.ReactNode[] = [
    <p key={0}>
      Choose <b>{sliceTypeLabel}</b> to color a single point.
    </p>,
  ];

  if (slice_type !== "other") {
    options.aggregated_slice = `${sliceTypeLabel} Context`;
    helpContent.push(
      <p key={1}>
        Choose <b>{sliceTypeLabel} context</b> to color by membership in a
        user-defined context.
      </p>
    );
  }

  if (hasSomeColorProperty || value === "property") {
    options.property = `${sliceTypeLabel} Property`;
    helpContent.push(
      <p key={2}>
        Choose <b>{sliceTypeLabel} property</b> to color by major properties of
        the {sliceTypeLabel}, such as selectivity for genes or lineage for
        models.
      </p>
    );
  }

  if (slice_type !== "other") {
    options.custom = "Custom";
    helpContent.push(
      <p key={3}>
        Choose <b>Custom</b> to treat color as a third axis, letting you choose
        any data type that could have been an axis.
      </p>
    );
  }

  return (
    <div className={styles.colorBySelector}>
      <PlotConfigSelect
        label={
          <span>
            Color by
            {slice_type && (
              <HelpTip id="color-by-help" customContent={helpContent} />
            )}
          </span>
        }
        placeholder="Choose type…"
        options={options}
        show={show}
        enable={enable}
        value={value}
        onChange={(nextValue) =>
          onChange(nextValue as DataExplorerPlotConfig["color_by"])
        }
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
    <PlotConfigSelect
      label="Sort by"
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
