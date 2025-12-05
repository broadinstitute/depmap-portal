import React, { useEffect, useRef, useState } from "react";
import { Checkbox } from "react-bootstrap";
import { breadboxAPI, cached } from "@depmap/api";
import {
  ColorByValue,
  DataExplorerDatasetDescriptor,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotType,
} from "@depmap/types";
import { isBreadboxOnlyMode } from "../../../../isBreadboxOnlyMode";
import { dataExplorerAPI } from "../../../../services/dataExplorerAPI";
import { deprecatedDataExplorerAPI } from "../../../../services/deprecatedDataExplorerAPI";
import {
  getDimensionTypeLabel,
  pluralize,
  sortDimensionTypes,
} from "../../../../utils/misc";
import renderConditionally from "../../../../utils/render-conditionally";
import PlotConfigSelect from "../../../PlotConfigSelect";
import DimensionSelectV1 from "../../../DimensionSelect";
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
  plot_type,
  slice_type,
  onChange,
}: {
  show: boolean;
  enable: boolean;
  value: string | null;
  plot_type: DataExplorerPlotType;
  slice_type: string;
  onChange: (nextValue: DataExplorerPlotConfig["color_by"]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sliceTypeLabel, setSliceTypeLabel] = useState(
    getDimensionTypeLabel(slice_type)
  );
  const [hasLegacyColorProperty, setHasLegacyColorProperty] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isBreadboxOnlyMode) {
        const keyedSlices = await deprecatedDataExplorerAPI.fetchMetadataSlices(
          slice_type
        );
        const slices = Object.values(keyedSlices);
        setHasLegacyColorProperty(
          slices.some((slice) => !slice.isHighCardinality)
        );
      } else {
        cached(breadboxAPI)
          .getDimensionTypes()
          // HACK: `getDimensionTypeLabel` is synchronous when it should be async.
          // This is to keep some legacy code working. It falls back to using the type `name`
          // instead of `display_name` until `getDimensionTypes()` has been cached.
          .then(() => {
            setSliceTypeLabel(getDimensionTypeLabel(slice_type));
          });
      }
    })();
  }, [slice_type]);

  const options: Partial<Record<ColorByValue, string>> = {
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
        Choose <b>{sliceTypeLabel} Context</b> to color by membership in a
        user-defined context.
      </p>
    );
  }

  if (isBreadboxOnlyMode || hasLegacyColorProperty || value === "property") {
    options.property = `${sliceTypeLabel} Annotation`;
    helpContent.push(
      <p key={2}>
        Choose <b>{sliceTypeLabel} Annotation</b> to color by major properties
        of the {sliceTypeLabel}, such as selectivity for genes or lineage for
        models.
      </p>
    );
  }

  if (!isBreadboxOnlyMode && slice_type !== "other") {
    options.custom = "Matrix Data";
    helpContent.push(
      <p key={3}>
        Choose <b>Matrix data</b> to treat color as a third axis, letting you
        choose any data type that could have been an axis.
      </p>
    );
  }

  if (isBreadboxOnlyMode) {
    options.custom = "Dataset";
    helpContent.push(
      <p key={3}>
        Choose <b>Dataset</b> to treat color as a third axis, letting you choose
        any data type that could have been an axis.
      </p>
    );
  }

  return (
    <div ref={ref} className={styles.colorBySelector}>
      <PlotConfigSelect
        label={
          <span>
            {["density_1d", "waterfall"].includes(plot_type)
              ? "Color & group by"
              : "Color by"}
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
        onChange={(nextValue) => {
          onChange(nextValue as DataExplorerPlotConfig["color_by"]);

          if (isBreadboxOnlyMode) {
            setTimeout(() => {
              ref.current?.parentElement?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              });
            }, 0);
          }
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
    <PlotConfigSelect
      label="Sort groups by"
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

const DimensionSelect = isBreadboxOnlyMode
  ? ((DimensionSelectV2 as unknown) as typeof DimensionSelectV1)
  : DimensionSelectV1;

export function ColorByDimensionSelect({
  plot_type,
  index_type,
  value,
  onChange,
  onClickCreateContext,
  onClickSaveAsContext,
  sortByValue,
  onChangeSortBy,
}: {
  plot_type: string;
  index_type: string | null;
  value: Partial<DataExplorerPlotConfigDimension> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimension>) => void;
  onClickCreateContext: () => void;
  onClickSaveAsContext: () => void;
  sortByValue: string;
  onChangeSortBy: (nextValue: DataExplorerPlotConfig["sort_by"]) => void;
}) {
  const [showSortBy, setShowSortBy] = useState(false);

  useEffect(() => {
    if (
      isBreadboxOnlyMode &&
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
  }, [plot_type, value]);

  const v2Props = isBreadboxOnlyMode
    ? {
        allowNullFeatureType: true,
        allowCategoricalValueType: true,
      }
    : {};

  return (
    <>
      <DimensionSelect
        {...v2Props}
        className={styles.customColorDimension}
        index_type={index_type || null}
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
      {showSortBy && (
        <div className={styles.customColorSortBy}>
          <SortBySelector
            show
            enable
            value={sortByValue}
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
