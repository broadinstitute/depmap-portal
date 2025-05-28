import React from "react";
import { DataExplorerContext, DataExplorerPlotConfig } from "@depmap/types";
import { usePlotData } from "../hooks";
import DataExplorerScatterPlot from "./plot/DataExplorerScatterPlot";
import DataExplorerDensity1DPlot from "./plot/DataExplorerDensity1DPlot";
import DataExplorerWaterfallPlot from "./plot/DataExplorerWaterfallPlot";
import DataExplorerCorrelationHeatmap from "./plot/DataExplorerCorrelationHeatmap";
import DummyPlot from "./plot/DummyPlot";
import styles from "../styles/DataExplorer2.scss";

interface Props {
  plotConfig?: DataExplorerPlotConfig | null;
  isInitialPageLoad: boolean;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedLabels: Set<string>
  ) => void;
  onClickSaveSelectionAsContext: (
    context_type: string,
    selectedLabels: Set<string>
  ) => void;
  onClickColorByContext: (context: DataExplorerContext) => void;
  onClickShowDensityFallback: () => void;
  feedbackUrl: string | null;
  contactEmail: string;
  tutorialLink: string;
}

function VisualizationPanel({
  plotConfig = null,
  isInitialPageLoad,
  onClickVisualizeSelected,
  onClickSaveSelectionAsContext,
  onClickColorByContext,
  onClickShowDensityFallback,
  feedbackUrl,
  contactEmail,
  tutorialLink,
}: Props) {
  const { data, linreg_by_group, fetchedPlotConfig, hadError } = usePlotData(
    plotConfig
  );
  const isLoading = plotConfig !== fetchedPlotConfig;

  if (hadError) {
    return (
      <div className={styles.VisualizationPanel}>
        <DummyPlot
          hadError
          isInitialPageLoad={isInitialPageLoad}
          feedbackUrl={feedbackUrl}
          contactEmail={contactEmail}
          tutorialLink={tutorialLink}
        />
      </div>
    );
  }

  return (
    <div className={styles.VisualizationPanel}>
      {plotConfig?.plot_type === "density_1d" && (
        <DataExplorerDensity1DPlot
          data={data}
          isLoading={isLoading}
          plotConfig={plotConfig}
          onClickVisualizeSelected={onClickVisualizeSelected}
          onClickSaveSelectionAsContext={onClickSaveSelectionAsContext}
          onClickColorByContext={onClickColorByContext}
        />
      )}
      {plotConfig?.plot_type === "waterfall" && (
        <DataExplorerWaterfallPlot
          data={data}
          isLoading={isLoading}
          plotConfig={plotConfig}
          onClickVisualizeSelected={onClickVisualizeSelected}
          onClickSaveSelectionAsContext={onClickSaveSelectionAsContext}
          onClickColorByContext={onClickColorByContext}
        />
      )}
      {plotConfig?.plot_type === "scatter" && (
        <DataExplorerScatterPlot
          data={data}
          linreg_by_group={linreg_by_group}
          isLoading={isLoading}
          plotConfig={plotConfig}
          onClickVisualizeSelected={onClickVisualizeSelected}
          onClickSaveSelectionAsContext={onClickSaveSelectionAsContext}
          onClickColorByContext={onClickColorByContext}
        />
      )}
      {plotConfig?.plot_type === "correlation_heatmap" && (
        <DataExplorerCorrelationHeatmap
          data={data}
          isLoading={isLoading}
          plotConfig={plotConfig}
          onClickVisualizeSelected={onClickVisualizeSelected}
          onClickSaveSelectionAsContext={onClickSaveSelectionAsContext}
          onClickShowDensityFallback={onClickShowDensityFallback}
        />
      )}
      {plotConfig?.plot_type === undefined && (
        <DummyPlot
          isInitialPageLoad={isInitialPageLoad}
          feedbackUrl={feedbackUrl}
          contactEmail={contactEmail}
          tutorialLink={tutorialLink}
        />
      )}
    </div>
  );
}

export default VisualizationPanel;
