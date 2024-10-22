/* eslint-disable @typescript-eslint/naming-convention */
import React, { useCallback, useMemo } from "react";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

import ScatterPlot from "./ScatterPlot";

interface Props {
  data: any;
  pointVisibility: boolean[];
  indexLabels: string[];
  colorVariable: number[];
  handleClickPoint: (pointIndex: number) => void;
  handleSetSelectedLabels: (labels: Set<string> | null) => void;
  handleSetPlotElement: (element: any) => void;
  selectedPlotLabels: Set<string> | null;
  colorScale: string[][] | undefined;
  showYEqualXLine: boolean;
}
function ContextAnalysisScatterPlot({
  data,
  pointVisibility,
  indexLabels,
  colorVariable,
  handleClickPoint,
  handleSetSelectedLabels,
  handleSetPlotElement,
  selectedPlotLabels,
  colorScale,
  showYEqualXLine,
}: Props) {
  const selectedPoints = useMemo(() => {
    const out: Set<number> = new Set();

    if (!data && !indexLabels) {
      return out;
    }

    for (let i = 0; i < indexLabels.length; i += 1) {
      if (selectedPlotLabels?.has(indexLabels[i])) {
        out.add(i);
      }
    }

    return out;
  }, [data, indexLabels, selectedPlotLabels]);

  const onClickResetSelection = useCallback(
    () => handleSetSelectedLabels(null),
    [handleSetSelectedLabels]
  );

  return (
    <div className={styles.scatterPlot}>
      <ScatterPlot
        data={data}
        colorVariable={colorVariable}
        height={387}
        xKey="x"
        yKey="y"
        continuousColorKey="contColorData"
        hoverTextKey="hoverText"
        xLabel={data?.xLabel}
        yLabel={data?.yLabel}
        pointVisibility={pointVisibility}
        onLoad={handleSetPlotElement}
        onClickPoint={handleClickPoint}
        onClickResetSelection={onClickResetSelection}
        selectedPoints={selectedPoints}
        showYEqualXLine={showYEqualXLine}
        customContinuousColorScale={colorScale}
      />
    </div>
  );
}

export default React.memo(ContextAnalysisScatterPlot);
