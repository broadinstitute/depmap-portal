/* eslint-disable @typescript-eslint/naming-convention */
import React, { useCallback, useMemo } from "react";
import { useState } from "react";
import DoseCurvesPlot from "src/contextExplorer/components/contextAnalysis/DoseCurvesPlot";
import PlotControls from "src/plot/components/PlotControls";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

interface Props {}
function DoseCurvesPlotSection({}: Props) {
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  return (
    <div>
      <div>
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
      </div>

      <div>
        <DoseCurvesPlot
          minDose={minDose}
          maxDose={maxDose}
          inGroupCurveParams={curveParams}
          handleSetPlotElement={(element: ExtendedPlotType | null) => {
            setTTestPlotElement(element);
          }}
        />
      </div>
    </div>
  );
}

export default React.memo(DoseCurvesPlotSection);
