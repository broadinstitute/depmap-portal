import React, { useMemo } from "react";
import { DensityPlot, LEGEND_ALL } from "@depmap/data-explorer-2";
import type { SliceQuery } from "@depmap/types";

interface Props {
  slice: SliceQuery | null;
  data: any;
  column: any;
  uniqueId: any;
  plotStyles: any;
}

function ContinuousDataPreview({
  slice,
  data,
  column,
  uniqueId,
  plotStyles,
}: Props) {
  const plotData = useMemo(() => {
    if (!slice || !column || data.length === 0) {
      return null;
    }

    const { idLabel, units, datasetName } = column.meta;

    return {
      xLabel: `${idLabel} ${units}<br>${datasetName}`,
      yLabel: null,
      x: data.map((row: any) => row[uniqueId]),
      y: null,
      color1: null,
      color2: null,
      catColorData: null,
      contColorData: null,
      hoverText: data.map(({ label }: any) => label),
    };
  }, [data, uniqueId, slice, column]);

  return (
    <div>
      <DensityPlot
        height={500}
        xKey="x"
        data={plotData}
        colorMap={new Map([[LEGEND_ALL, plotStyles.palette.all]])}
        legendDisplayNames={{ [LEGEND_ALL]: "All" }}
        hoverTextKey="hoverText"
        selectedPoints={null}
        useSemiOpaqueViolins
        {...plotStyles}
      />
    </div>
  );
}

export default ContinuousDataPreview;
