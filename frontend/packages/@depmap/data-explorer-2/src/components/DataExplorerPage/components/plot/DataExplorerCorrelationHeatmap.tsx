import React, { useState } from "react";
import { Button } from "react-bootstrap";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import { getDimensionTypeLabel, pluralize } from "../../../../utils/misc";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import type ExtendedPlotType from "../../ExtendedPlotType";
import Section from "../Section";
import useCorrelationHeatmapData from "./prototype/useCorrelationHeatmapData";
import PrototypeCorrelationHeatmap from "./prototype/PrototypeCorrelationHeatmap";
import DataExplorerPlotControls from "./DataExplorerPlotControls";
import PlotSelections from "./PlotSelections";
import SpinnerOverlay from "./SpinnerOverlay";
import styles from "../../styles/DataExplorer2.scss";

interface Props {
  data: DataExplorerPlotResponse | null;
  plotConfig: DataExplorerPlotConfig;
  isLoading: boolean;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedLabels: Set<string>
  ) => void;
  onClickSaveSelectionAsContext: (
    dimension_type: string,
    selectedLabels: Set<string>
  ) => void;
  onClickShowDensityFallback: () => void;
}

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
        slice_type: string;
        context_size?: number; // HACK: Undocumented property
      }
    | undefined;

  if (!dimension) {
    return null;
  }

  const entitiesLabel = pluralize(getDimensionTypeLabel(dimension.slice_type));

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
  const { palette, xAxisFontSize } = plotStyles;

  const {
    heatmapData,
    xLabels,
    yLabels,
    showWarning,
  } = useCorrelationHeatmapData(data, isLoading);

  const handleSelectLabels = (labels: string[]) => {
    setSelectedLabels(new Set(labels));
  };

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
          {(!data || isLoading) && <SpinnerOverlay />}
          {showWarning && (
            <TooManyEntitiesWarning
              data={data}
              onClickShowDensityFallback={onClickShowDensityFallback}
            />
          )}
          {data && !isLoading && !showWarning && (
            <PrototypeCorrelationHeatmap
              data={heatmapData}
              xLabels={xLabels!}
              yLabels={yLabels!}
              xKey="x"
              yKey="y"
              zKey="z"
              z2Key={heatmapData!.z2 ? "z2" : undefined}
              zLabel={heatmapData!.zLabel}
              z2Label={heatmapData!.z2Label}
              height="auto"
              onLoad={setPlotElement}
              onSelectLabels={handleSelectLabels}
              selectedLabels={selectedLabels || undefined}
              palette={palette}
              xAxisFontSize={xAxisFontSize}
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
                plotConfig.dimensions.x!.slice_type,
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
