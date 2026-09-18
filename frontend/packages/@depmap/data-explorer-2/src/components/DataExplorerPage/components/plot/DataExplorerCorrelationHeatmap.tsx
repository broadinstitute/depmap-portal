import React, { useState } from "react";
import { Button } from "react-bootstrap";
import type { Layout } from "plotly.js";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import { getDimensionTypeLabel, pluralize } from "../../../../utils/misc";
import {
  Settings,
  useDataExplorerSettings,
} from "../../../../contexts/DataExplorerSettingsContext";
import type ExtendedPlotType from "../../ExtendedPlotType";
import Section from "../Section";
import useCorrelationHeatmapData from "./prototype/useCorrelationHeatmapData";
import PrototypeCorrelationHeatmap from "./prototype/PrototypeCorrelationHeatmap";
import DataExplorerPlotControls from "./DataExplorerPlotControls";
import PlotSelections from "./PlotSelections";
import SpinnerOverlay from "./SpinnerOverlay";
import styles from "../../styles/DataExplorer2.scss";

// Lets the export modal render a second, non-interactive copy of this plot
// at different styles and/or a seeded view state, and must not be able to
// wire it up to mutate the real selection. No initialAnnotationTails here —
// unlike scatter/density, this plot has no per-point annotations.
interface RenderPlotOptions {
  plotStyles: Settings["plotStyles"];
  onLoad: (plot: ExtendedPlotType) => void;
  interactive: boolean;
  initialAxes?: Partial<Layout>;
  // Export-only — see ExportImageModal's tickFontSize. Outside plotStyles
  // because it isn't a saved setting.
  tickFontSize?: number;
}

interface Props {
  data: DataExplorerPlotResponse | null;
  plotConfig: DataExplorerPlotConfig;
  isLoading: boolean;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedIds: Set<string>
  ) => void;
  onClickSaveSelectionAsContext: (
    dimension_type: string,
    selectedIds: Set<string>
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
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const { plotStyles } = useDataExplorerSettings();

  const {
    heatmapData,
    xLabels,
    yLabels,
    showWarning,
  } = useCorrelationHeatmapData(data, isLoading);

  const handleSelectLabels = (labels: string[]) => {
    setSelectedIds(new Set(labels));
  };

  // Extracted so the export modal can call this a second time, offscreen, at
  // different styles and/or a seeded view state, without repeating this
  // whole call site and risking it drifting out of step.
  const renderPlot = ({
    plotStyles: styles_,
    onLoad,
    interactive,
    initialAxes,
    tickFontSize,
  }: RenderPlotOptions) => {
    if (!data || isLoading || showWarning) {
      return null;
    }

    // A preview must not be able to mutate the real selection, so it simply
    // isn't wired to the handler that would.
    const interactions = interactive
      ? { onSelectLabels: handleSelectLabels }
      : {};

    return (
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
        onLoad={onLoad}
        selectedLabels={selectedIds || undefined}
        palette={styles_.palette}
        xAxisFontSize={styles_.xAxisFontSize}
        tickFontSize={tickFontSize}
        initialAxes={initialAxes}
        distinguish1Label={plotConfig.filters?.distinguish1?.name}
        distinguish2Label={plotConfig.filters?.distinguish2?.name}
        {...interactions}
      />
    );
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
            onClickUnselectAll={() => setSelectedIds(null)}
            hideSelectionTools
            previewPlot={{
              render: (options: Omit<RenderPlotOptions, "interactive">) =>
                renderPlot({ ...options, interactive: false }),
              // Unused — no points on a heatmap, so hasPointStyles below
              // already hides every control this would otherwise drive.
              pointSizeField: "pointSize",
              // No `legend` key at all: there's no color-by legend here,
              // just the colorscale, which the export modal leaves fixed on
              // the right rather than treating as a legend to place or edit.
              hasDataLines: false,
              hasYAxisLabel: false,
              hasPointStyles: false,
              hasTickFontSize: true,
              // Whether there's a second panel to relabel depends on the
              // current data, not just the plot type.
              hasSecondaryXAxisLabel: Boolean(heatmapData?.z2),
            }}
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
          {renderPlot({
            plotStyles,
            onLoad: setPlotElement,
            interactive: true,
          })}
        </div>
      </div>
      <div className={styles.right}>
        <Section title="Plot Selections">
          <PlotSelections
            data={data}
            plot_type={plotConfig?.plot_type || null}
            selectedIds={selectedIds}
            onClickVisualizeSelected={(e) => {
              if (selectedIds) {
                onClickVisualizeSelected(e, selectedIds);
              }
            }}
            onClickSaveSelectionAsContext={() => {
              onClickSaveSelectionAsContext(
                plotConfig.dimensions.x!.slice_type,
                selectedIds as Set<string>
              );
            }}
          />
        </Section>
      </div>
    </div>
  );
}

export default DataExplorerCorrelationHeatmap;
