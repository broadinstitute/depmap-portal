import React, { useState } from "react";
import { TDASummaryTable } from "src/tda/models/types";
import ScatterPlot from "src/plot/components/ScatterPlot";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotControls from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import TDAColumnControls from "src/tda/components/TDAColumnControls";
import columns from "src/tda/json/columns.json";

interface Props {
  data: TDASummaryTable | null;
  pointVisibility: boolean[];
  selectedPoint: number | null;
  onClickPoint: (pointIndex: number) => void;
  onSearch: (
    selected: { value: number; label: string },
    plot: ExtendedPlotType
  ) => void;
  onDownload: (xKey: string, kKey: string) => void;
}

type ColumnKey = typeof columns[number]["value"];

function TargetDiscoveryPlot({
  data,
  pointVisibility,
  selectedPoint,
  onClickPoint,
  onSearch,
  onDownload,
}: Props) {
  const [xKey, setXKey] = useState<ColumnKey>("CRISPR_LRT");
  const [yKey, setYKey] = useState<ColumnKey>("CRISPR_Predictive_Accuracy");
  const [plot, setPlot] = useState<ExtendedPlotType | null>(null);

  const xLabel = columns.find((c) => c.value === xKey)?.label || "unknown";
  const yLabel = columns.find((c) => c.value === yKey)?.label || "unknown";

  const searchOptions = data
    ? data.symbol.map((geneName: string, index: number) => ({
        label: geneName,
        value: index,
      }))
    : null;

  return (
    <>
      <div>
        <TDAColumnControls
          xValue={xKey}
          yValue={yKey}
          onChangeX={setXKey}
          onChangeY={setYKey}
        />
      </div>
      <div>
        <PlotControls
          plot={plot}
          searchOptions={searchOptions}
          searchPlaceholder="Search for gene of interest"
          onSearch={(selected: { label: string; value: number }) => {
            if (plot) {
              onSearch(selected, plot);
            }
          }}
          onDownload={() => onDownload(xKey, yKey)}
          downloadImageOptions={{
            filename: "tda-filtered",
            width: 800,
            height: 600,
          }}
        />
      </div>
      <div>
        <ScatterPlot
          data={data}
          xKey={xKey}
          yKey={yKey}
          xLabel={xLabel}
          yLabel={yLabel}
          hoverTextKey="symbol"
          highlightPoint={selectedPoint}
          onClickPoint={onClickPoint}
          pointVisibility={pointVisibility}
          height="auto"
          onLoad={setPlot}
        />
        {!plot && <PlotSpinner />}
      </div>
    </>
  );
}

export default TargetDiscoveryPlot;
