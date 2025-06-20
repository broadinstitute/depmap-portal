/* eslint-disable @typescript-eslint/naming-convention */
import React, { useMemo } from "react";
import PlotControls, {
  PlotToolOptions,
} from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "../CompoundDoseViability.scss";
import PrototypeBrushableHeatmap from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap";
import { HeatmapFormattedData } from "../types";

interface HeatmapPlotSectionProps {
  isLoading: boolean;
  compoundName: string;
  plotElement: ExtendedPlotType | null;
  heatmapFormattedData: HeatmapFormattedData;
  doseMin: number | null;
  doseMax: number | null;
  selectedModelIds: Set<string>;
  handleSetSelectedPlotModels: (models: Set<string>) => void;
  handleSetPlotElement: (element: ExtendedPlotType | null) => void;
}
function HeatmapPlotSection({
  isLoading,
  compoundName,
  heatmapFormattedData,
  doseMin,
  doseMax,
  selectedModelIds,
  handleSetSelectedPlotModels,
  handleSetPlotElement,
  plotElement,
}: HeatmapPlotSectionProps) {
  const selectedColumns = useMemo(() => {
    const out = new Set<number>();

    heatmapFormattedData?.modelIds.forEach((id, index) => {
      if (selectedModelIds.has(id)) {
        out.add(index);
      }
    });

    return out;
  }, [selectedModelIds, heatmapFormattedData]);

  // TODO need the display name model id map here to use heatmapFormattedData.modelIds to
  // make search options
  const searchOptions = useMemo(
    () =>
      heatmapFormattedData
        ? heatmapFormattedData.modelIds.map(
            (modelId: string, index: number) => ({
              label: "TODO add display name here!!!!!",
              stringId: modelId,
              value: index,
            })
          )
        : null,
    [heatmapFormattedData]
  );

  return (
    <div className={styles.PlotSection}>
      <div className={styles.sectionHeader}>
        {plotElement && (
          <PlotControls
            plot={plotElement}
            enabledTools={[
              PlotToolOptions.Zoom,
              PlotToolOptions.Pan,
              PlotToolOptions.Search,
              PlotToolOptions.Download,
            ]}
            searchOptions={searchOptions}
            searchPlaceholder="Search for a cell line"
            onSearch={(selection: {
              label: string;
              value: number;
              stringId?: string;
            }) => {
              if (selection.stringId) {
                handleSetSelectedPlotModels(new Set([selection.stringId]));
              }
            }}
            downloadImageOptions={{
              filename: `dose-curves-${compoundName}`,
              width: 800,
              height: 600,
            }}
            onDownload={() => {
              /* do nothing */
            }}
            altContainerStyle={{
              backgroundColor: "#7B8CB2",
            }}
            hideCSVDownload
          />
        )}
      </div>
      <div className={styles.plotArea}>
        {(!plotElement || isLoading) && (
          <div className={styles.plotSpinnerContainer}>
            <PlotSpinner height="100%" />
          </div>
        )}
        {heatmapFormattedData && doseMin && doseMax && !isLoading && (
          <div className={styles.heatmapContainer}>
            <PrototypeBrushableHeatmap
              data={heatmapFormattedData}
              onLoad={handleSetPlotElement}
              xAxisTitle="Cell Lines"
              yAxisTitle={`${compoundName} Dose (μM)`}
              legendTitle="Viability"
              hovertemplate={[
                "Cell line: %{x}",
                "Dose: %{y} µM",
                "Viability: %{z}",
                "<extra></extra>",
              ].join("<br>")}
              selectedColumns={selectedColumns}
              onClearSelection={() => handleSetSelectedPlotModels(new Set())}
              onSelectColumnRange={(
                start: number,
                end: number,
                shiftKey: boolean
              ) => {
                let next: Set<string>;
                if (shiftKey) {
                  next = new Set(selectedModelIds);
                } else {
                  next = new Set();
                }
                for (let i = start; i <= end; i += 1) {
                  next.add(heatmapFormattedData.modelIds[i]);
                }
                handleSetSelectedPlotModels(next);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(HeatmapPlotSection);
