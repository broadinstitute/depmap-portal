/* eslint-disable @typescript-eslint/naming-convention */
import React, { useState } from "react";
import DoseCurvesPlot from "src/contextExplorer/components/contextAnalysis/DoseCurvesPlot";
import PlotControls from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { CompoundDoseCurveData } from "./types";

interface DoseCurvesPlotSectionProps {
  curvesData: CompoundDoseCurveData | null;
  doseUnits: string;
}
function DoseCurvesPlotSection({
  curvesData,
  doseUnits,
}: DoseCurvesPlotSectionProps) {
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  return (
    <div>
      <div>
        {plotElement && (
          <PlotControls
            plot={plotElement}
            searchOptions={[]}
            searchPlaceholder=""
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onSearch={(selection: { label: string; value: number }) => {
              /* do nothing */
            }}
            onDownload={() => {
              /* do nothing */
            }}
          />
        )}
      </div>

      <div>
        {!curvesData && <PlotSpinner />}
        {curvesData && (
          <DoseCurvesPlot
            minDose={curvesData.min_dose}
            maxDose={curvesData.max_dose}
            inGroupCurveParams={curvesData.curve_params}
            handleSetPlotElement={(element: ExtendedPlotType | null) => {
              setPlotElement(element);
            }}
            doseUnits={doseUnits}
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(DoseCurvesPlotSection);
