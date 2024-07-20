import React, { useState } from "react";
import {
  CompoundSummaryTable,
  DatasetId,
} from "src/compoundDashboard/models/types";
import ScatterPlot from "src/plot/components/ScatterPlot";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotControls from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import CompoundDashboardColumnControls, {
  CompoundDashboardView,
} from "./CompoundDashboardColumnControls";
import columns from "../json/columns.json";

interface Props {
  datasetId: DatasetId;
  onChangeDatasetId: (id: DatasetId) => void;
  data: CompoundSummaryTable | null;
  pointVisibility: boolean[];
  selectedPoint: number | null;
  handleClickPoint: (pointIndex: number) => void;
  onSearch: (
    selected: { value: number; label: string },
    plot: ExtendedPlotType
  ) => void;
  onDownload: (xKey: string, kKey: string) => void;
  viewSelection?: CompoundDashboardView;
}

type ColumnKey = typeof columns[number]["value"];

function TargetDiscoveryPlot({
  datasetId,
  onChangeDatasetId,
  data,
  pointVisibility,
  selectedPoint,
  handleClickPoint,
  onSearch,
  onDownload,
  viewSelection = undefined,
}: Props) {
  const [xKey, setXKey] = useState<ColumnKey>("BimodalityCoefficient");
  const [yKey, setYKey] = useState<ColumnKey>("PearsonScore");
  const [plot, setPlot] = useState<ExtendedPlotType | null>(null);

  const xLabel = columns.find((c) => c.value === xKey)?.label || "unknown";
  const yLabel = columns.find((c) => c.value === yKey)?.label || "unknown";

  const searchOptions = data
    ? data.Name.map((compoundName: string, index: number) => ({
        label: compoundName || "",
        value: index,
      }))
    : null;

  const removeDuplicates = (arr: any[]) => {
    const trimmedArr = arr.map((item: string) => item.trim());
    return [...new Set(trimmedArr)];
  };
  const synonymSearchOptions = data
    ? data.Synonyms.map((synonyms: string, index: number) => {
        const options = removeDuplicates(synonyms?.split(";") || [""]);
        return options.map((syn: string) => ({
          label: syn || "",
          value: index,
        }));
      })
    : null;

  const combinedSearchOptions =
    searchOptions && synonymSearchOptions
      ? searchOptions.concat(...synonymSearchOptions)
      : null;

  return (
    <>
      <div>
        <CompoundDashboardColumnControls
          datasetId={datasetId}
          onChangeDatasetId={onChangeDatasetId}
          xValue={xKey}
          yValue={yKey}
          onChangeX={setXKey}
          onChangeY={setYKey}
          viewSelection={viewSelection}
        />
      </div>
      {(viewSelection === CompoundDashboardView.Plot ||
        viewSelection === CompoundDashboardView.TableAndPlot) && (
        <div>
          <PlotControls
            plot={plot}
            searchOptions={combinedSearchOptions}
            searchPlaceholder="Search for a compound by name or synonym"
            onSearch={(selected: { label: string; value: number }) => {
              if (plot) {
                onSearch(selected, plot);
              }
            }}
            onDownload={() => onDownload(xKey, yKey)}
            downloadImageOptions={{
              filename: "compounds-filtered",
              width: 800,
              height: 600,
            }}
          />
        </div>
      )}
      {(viewSelection === CompoundDashboardView.Plot ||
        viewSelection === CompoundDashboardView.TableAndPlot) && (
        <div>
          <ScatterPlot
            data={data}
            xKey={xKey}
            yKey={yKey}
            xLabel={xLabel}
            yLabel={yLabel}
            hoverTextKey="hoverText"
            annotationKey="Name"
            highlightPoint={selectedPoint}
            onClickPoint={handleClickPoint}
            pointVisibility={pointVisibility}
            height={
              viewSelection === CompoundDashboardView.TableAndPlot
                ? 310
                : "auto"
            }
            onLoad={setPlot}
          />
          {(!data || !plot) && <PlotSpinner />}
        </div>
      )}
    </>
  );
}

export default TargetDiscoveryPlot;
