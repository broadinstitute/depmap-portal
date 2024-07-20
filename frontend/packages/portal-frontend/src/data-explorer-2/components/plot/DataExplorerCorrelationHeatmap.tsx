import React, { useMemo, useState } from "react";
import { Button } from "react-bootstrap";
import {
  getDimensionTypeLabel,
  pluralize,
  useDataExplorerSettings,
} from "@depmap/data-explorer-2";
import PlotSpinner from "src/plot/components/PlotSpinner";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import PrototypeCorrelationHeatmap from "src/data-explorer-2/components/plot/prototype/PrototypeCorrelationHeatmap";
import DataExplorerPlotControls from "src/data-explorer-2/components/plot/DataExplorerPlotControls";
import Section from "src/data-explorer-2/components/Section";
import PlotSelections from "src/data-explorer-2/components/plot/PlotSelections";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

interface Props {
  data: DataExplorerPlotResponse | null;
  plotConfig: DataExplorerPlotConfig;
  isLoading: boolean;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedLabels: Set<string>
  ) => void;
  onClickSaveSelectionAsContext: (
    context_type: string,
    selectedLabels: Set<string>
  ) => void;
  onClickShowDensityFallback: () => void;
}

const formatDimension = (zs: number[], i: number) =>
  zs
    .map((val, j) => (i > j ? undefined : val))
    .map((val, j) => {
      if (val !== null) {
        return val;
      }

      return i === j ? 1 : 0;
    })
    .reverse();

function TooManyEntitiesWarning({
  data,
  onClickShowDensityFallback,
}: {
  data: DataExplorerPlotResponse | null;
  onClickShowDensityFallback: () => void;
}) {
  if (!data) {
    return null;
  }

  const dimension = data.dimensions.x as
    | {
        entity_type: string;
        context_size?: number; // HACK: Undocumented property
      }
    | undefined;

  if (!dimension) {
    return null;
  }

  const entitiesLabel = pluralize(getDimensionTypeLabel(dimension.entity_type));

  return (
    <div style={{ maxWidth: 600, padding: 20 }}>
      <p style={{ fontSize: 20 }}>
        ⚠️ Sorry, the selected context consists of{" "}
        {dimension.context_size?.toLocaleString()} {entitiesLabel}. The
        correlation heatmap can show at most 100.
      </p>
      <p>
        <Button onClick={onClickShowDensityFallback}>
          OK, show me a Density plot instead
        </Button>
      </p>
    </div>
  );
}

// WORKAROUND: The heatmap breaks the data model. A dimension usually has a
// `values` property that is an array of numbers. The /get_correlation endpoint
// returns an array of arrays of numbers.
const assert2d = (array: unknown) => {
  if (!Array.isArray(array)) {
    throw new Error("not an array");
  }

  if (array.length > 0 && !Array.isArray(array[0])) {
    throw new Error("not a 2D array");
  }

  return array as number[][];
};

function DataExplorerCorrelationHeatmap({
  data,
  plotConfig,
  isLoading,
  onClickVisualizeSelected,
  onClickSaveSelectionAsContext,
  onClickShowDensityFallback,
}: Props) {
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<Set<string> | null>(
    null
  );
  const { plotStyles } = useDataExplorerSettings();
  const { palette } = plotStyles;

  const memoizedData = useMemo(
    () =>
      data && !isLoading
        ? {
            x: data.index_labels.slice().reverse(),
            y: data.index_labels,
            z: assert2d(data.dimensions.x.values).map(formatDimension),
            z2: data.dimensions.x2
              ? assert2d(data.dimensions.x2.values).map(formatDimension)
              : null,
            zLabel: `${data.dimensions.x.axis_label}<br>${data.dimensions.x.dataset_label}`,
            z2Label: data.dimensions.x2
              ? `${data.dimensions.x2.axis_label}<br>${data.dimensions.x2.dataset_label}`
              : "",
          }
        : null,
    [data, isLoading]
  );

  const handleSelectLabels = (labels: string[]) => {
    setSelectedLabels(new Set(labels));
  };

  const showWarning = data?.dimensions.x?.axis_label === "cannot plot";

  // If there are index_aliases, use these for graphing so that
  // we can prioritize cell line name over model id.
  const memoizedXLabels = useMemo(
    () =>
      data && !isLoading
        ? data.index_labels
            .map((label: string, i: number) => {
              if (
                data?.index_aliases &&
                data?.index_aliases.length > 0 &&
                data?.index_aliases[0].values.length > 0
              ) {
                return data.index_aliases[0].values[i];
              }
              return label;
            })
            .slice()
            .reverse()
        : null,
    [data, isLoading]
  );

  const memoizedYLabels = useMemo(
    () =>
      data && !isLoading
        ? data.index_labels.map((label: string, i: number) => {
            if (
              data?.index_aliases &&
              data?.index_aliases.length > 0 &&
              data?.index_aliases[0].values.length
            ) {
              return data.index_aliases[0].values[i];
            }
            return label;
          })
        : null,
    [data, isLoading]
  );

  return (
    <div className={styles.DataExplorerScatterPlot}>
      <div className={styles.left}>
        <div className={styles.plotControls}>
          <DataExplorerPlotControls
            data={data}
            isLoading={isLoading}
            plotConfig={plotConfig}
            plotElement={plotElement}
            onClickUnselectAll={() => setSelectedLabels(null)}
            hideSelectionTools
          />
        </div>
        <div className={styles.plot}>
          {(!data || isLoading) && <PlotSpinner height="100%" />}
          {showWarning && (
            <TooManyEntitiesWarning
              data={data}
              onClickShowDensityFallback={onClickShowDensityFallback}
            />
          )}
          {data && !isLoading && !showWarning && (
            <PrototypeCorrelationHeatmap
              data={memoizedData}
              xLabels={memoizedXLabels!}
              yLabels={memoizedYLabels!}
              xKey="x"
              yKey="y"
              zKey="z"
              z2Key={memoizedData!.z2 ? "z2" : undefined}
              zLabel={memoizedData!.zLabel}
              z2Label={memoizedData!.z2Label}
              height="auto"
              onLoad={setPlotElement}
              onSelectLabels={handleSelectLabels}
              selectedLabels={selectedLabels || undefined}
              palette={palette}
              distinguish1Label={plotConfig.filters?.distinguish1?.name}
              distinguish2Label={plotConfig.filters?.distinguish2?.name}
            />
          )}
        </div>
      </div>
      <div className={styles.right}>
        <Section title="Plot Selections">
          <PlotSelections
            data={data}
            plot_type={plotConfig?.plot_type || null}
            selectedLabels={selectedLabels}
            onClickVisualizeSelected={(e) => {
              if (selectedLabels) {
                onClickVisualizeSelected(e, selectedLabels);
              }
            }}
            onClickSaveSelectionAsContext={() => {
              onClickSaveSelectionAsContext(
                plotConfig.dimensions.x!.entity_type,
                selectedLabels as Set<string>
              );
            }}
          />
        </Section>
      </div>
    </div>
  );
}

export default DataExplorerCorrelationHeatmap;
