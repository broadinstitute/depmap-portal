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
import styles from "./CompoundDoseCurves.scss";

interface DoseCurvesPlotSectionProps {
  isLoading: boolean;
  compoundName: string;
  curvesData: CompoundDoseCurveData | null;
  doseMin: number | null;
  doseMax: number | null;
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
  isLoading,
  compoundName,
  curvesData,
  doseMin,
  doseMax,
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
                handleClickCurve(selection.stringId);
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
        {curvesData && doseMin && doseMax && !isLoading && (
          <DoseCurvesPlot
            minDose={doseMin}
            maxDose={doseMax}
            inGroupCurveParams={curvesData.curve_params}
            doseRepPoints={doseRepPoints}
            handleSetPlotElement={handleSetPlotElement}
            doseUnits={doseUnits}
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
