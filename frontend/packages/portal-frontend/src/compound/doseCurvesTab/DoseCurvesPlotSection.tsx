/* eslint-disable @typescript-eslint/naming-convention */
import React, { useMemo } from "react";
import DoseCurvesPlot from "src/contextExplorer/components/contextAnalysis/DoseCurvesPlot";
import PlotControls, {
  PlotToolOptions,
} from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { CurveParams, CurvePlotPoints } from "../components/DoseResponseCurve";
import { CompoundDoseCurveData } from "./types";

interface DoseCurvesPlotSectionProps {
  curvesData: CompoundDoseCurveData | null;
  doseRepPoints: {
    [model_id: string]: CurvePlotPoints[];
  } | null;
  doseUnits: string;
  selectedCurves: Set<string>;
  handleClickCurve: (modelId: string) => void;
  plotElement: ExtendedPlotType | null;
  handleSetPlotElement: (element: any) => void;
}
function DoseCurvesPlotSection({
  curvesData,
  doseRepPoints,
  doseUnits,
  selectedCurves,
  handleClickCurve,
  plotElement,
  handleSetPlotElement,
}: DoseCurvesPlotSectionProps) {
  const searchOptions = useMemo(
    () =>
      curvesData
        ? curvesData.curve_params.map((curve: CurveParams, index: number) => ({
            label: curve.displayName!,
            stringId: curve.id!,
            value: index,
          }))
        : null,
    [curvesData]
  );

  return (
    <div
      style={{
        marginLeft: "20",
        marginRight: "20px",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        overflow: "visible",
        border: "1px solid #b8b8b8",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
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
                handleClickCurve(selection.stringId);
              }
            }}
            downloadImageOptions={{
              filename: "dose-curves",
              width: 800,
              height: 600,
            }}
            onDownload={() => {
              /* do nothing */
            }}
            altContainerStyle={{
              backgroundColor: "#7B8CB2",
            }}
          />
        )}
      </div>
      <div style={{ marginTop: "20px" }}>
        {!curvesData && <PlotSpinner />}
        {curvesData && (
          <DoseCurvesPlot
            minDose={curvesData.min_dose ?? 0.01} // TODO: fix this in the backend
            maxDose={curvesData.max_dose ?? 1} // TODO: fix this in the backend
            inGroupCurveParams={curvesData.curve_params}
            doseRepPoints={doseRepPoints}
            handleSetPlotElement={handleSetPlotElement}
            doseUnits={doseUnits}
            datasetUnits={curvesData.dataset_units}
            includeMedianQuantileRegions={false}
            handleClickCurve={handleClickCurve}
            selectedCurves={selectedCurves}
            useDefaultTitle={false}
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(DoseCurvesPlotSection);
