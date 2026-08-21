import React, { useEffect, useState } from "react";
import { DataExplorerContextV2, DataExplorerPlotConfig } from "@depmap/types";
import { usePlotData } from "../hooks";
import DataExplorerScatterPlot from "./plot/DataExplorerScatterPlot";
import DataExplorerDensity1DPlot from "./plot/DataExplorerDensity1DPlot";
import DataExplorerWaterfallPlot from "./plot/DataExplorerWaterfallPlot";
import DataExplorerCorrelationHeatmap from "./plot/DataExplorerCorrelationHeatmap";
import DummyPlot from "./plot/DummyPlot";
import { countPlottablePoints } from "./plot/prototype/plotUtils";
import styles from "../styles/DataExplorer2.scss";

interface Props {
  plotConfig?: DataExplorerPlotConfig | null;
  isInitialPageLoad: boolean;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedLabels: Set<string>
  ) => void;
  onClickSaveSelectionAsContext: (
    dimension_type: string,
    selectedLabels: Set<string>
  ) => void;
  onClickColorByContext: (context: DataExplorerContextV2) => void;
  // The plot side's one route back into the config: the category picker lives
  // beside the legend, where the categories are listed and the response that
  // describes them is in hand.
  onChangeCategories: (
    target: "color" | "facet",
    categories: string[] | null
  ) => void;
  // Expansion members are edited from whichever panel is listing them, which is
  // the same reasoning as onChangeCategories above.
  onChangeExpansionMembers: (members: string[] | null) => void;
  onClickShowDensityFallback: () => void;
  feedbackUrl: string | null;
  contactEmail: string;
  tutorialLink: string;
  canShowIdentityLine: boolean;
}

function VisualizationPanel({
  plotConfig = null,
  isInitialPageLoad,
  onClickVisualizeSelected,
  onClickSaveSelectionAsContext,
  onClickColorByContext,
  onChangeCategories,
  onChangeExpansionMembers,
  onClickShowDensityFallback,
  feedbackUrl,
  contactEmail,
  tutorialLink,
  canShowIdentityLine,
}: Props) {
  const {
    data,
    linreg_by_group,
    fetchedPlotConfig,
    hadError,
    errorMessage,
  } = usePlotData(plotConfig);

  const [hasExternalLoadEvent, setHasExternalLoadEvent] = useState(false);

  useEffect(() => {
    const event = "dx2_start_load_event";
    const callback = () => setHasExternalLoadEvent(true);
    window.addEventListener(event, callback);
    return () => window.removeEventListener(event, callback);
  }, []);

  useEffect(() => {
    const event = "dx2_end_load_event";
    const callback = () => setHasExternalLoadEvent(false);
    window.addEventListener(event, callback);
    return () => window.removeEventListener(event, callback);
  }, []);

  const isLoading = plotConfig !== fetchedPlotConfig || hasExternalLoadEvent;

  if (hadError) {
    return (
      <div className={styles.VisualizationPanel}>
        <DummyPlot
          hadError
          errorMessage={errorMessage}
          isInitialPageLoad={isInitialPageLoad}
          feedbackUrl={feedbackUrl}
          contactEmail={contactEmail}
          tutorialLink={tutorialLink}
        />
      </div>
    );
  }

  // A successful fetch that produced no drawable point. Handled here rather
  // than in any one plot type, and rather than in the expansion's own controls,
  // because the cause has nothing to do with either: a dataset covers some
  // entities and not others, which an aggregated plot runs into exactly as
  // readily as an expanded one. Checked only once loading has settled, so a
  // half-arrived response doesn't flash this.
  //
  // `null` from countPlottablePoints means "no basis to judge" (a correlation
  // heatmap, or a config with no x yet) and deliberately does not qualify.
  if (!isLoading && countPlottablePoints(data) === 0) {
    return (
      <div className={styles.VisualizationPanel}>
        <DummyPlot
          hasNoData
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
          onChangeCategories={onChangeCategories}
          onChangeExpansionMembers={onChangeExpansionMembers}
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
          onChangeCategories={onChangeCategories}
          onChangeExpansionMembers={onChangeExpansionMembers}
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
          onChangeCategories={onChangeCategories}
          onChangeExpansionMembers={onChangeExpansionMembers}
          canShowIdentityLine={canShowIdentityLine}
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
