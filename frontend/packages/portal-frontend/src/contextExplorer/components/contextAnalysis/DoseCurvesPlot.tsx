import _ from "lodash";
import React, { useEffect, useState } from "react";
import {
  CurveParams,
  CurvePlotPoints,
  groupBy,
  MedianCurveData,
} from "src/compound/components/DoseResponseCurve";
import LineChart from "src/plot/components/LineChart";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

interface Props {
  medianCurves: CurveParams[];
  medianTitles: string[];
  measurements: CurvePlotPoints[];
  curves: CurveParams;
  // handleSetPlotElement: (element: any) => void;
}

interface CurveTrace {
  x: number[];
  y: number[];
  customdata?: string[];
  label?: string[];
  replicate?: string[];
  name: string;
  marker?: { color: string };
  type?: "curve" | "scatter" | null;
  fill?: "tonextx" | "tozerox" | "none" | null;
  fillcolor?: string;
  opacity?: string;
  line?: { color: string; dash?: string };
  mode?: string;
}

function getCurveY(
  x: number,
  ec50: number,
  slope: number,
  upperA: number,
  lowerA: number
) {
  return lowerA + (upperA - lowerA) / (1 + Math.pow(x / ec50, -slope));
}

const buildTraces = (
  measurements: any,
  curves: any,
  medianCurves: CurveParams[]
): CurveTrace[] => {
  const setAsArray: CurvePlotPoints[] = Array.from(measurements.points || []);
  const traces: CurveTrace[] = [];

  const allKeys = new Set(
    setAsArray.filter((points) => !!points.id).map((points) => points.id)
  );

  curves
    ?.filter((curve: CurveParams) => !!curve.id)
    .forEach((curve: CurveParams) => allKeys.add(curve.id));

  traces.sort((a, b) => {
    // sort by replicate name, i.e. replicate number
    if (a.name > b.name) {
      return 1;
    }
    if (a.name < b.name) {
      return -1;
    }
    return 0;
  });

  const doses = measurements.map((m: any) => m.dose);
  const minX = Math.min(...doses);
  const maxX = Math.max(...doses);
  const rangeOfExponents = Math.log10(maxX) - Math.log10(minX);
  const minExponent = Math.log10(minX);
  const numPts = 2000;

  // Make median curve traces
  const lineColorInGroup = "rgba(1, 50, 32, 1)";
  const shadingColorInGroup = "rgba(11, 146, 39, 0.3)";
  const lineColorOutGroup = "rgba(211, 84, 0, 1)";
  const shadingColorOutGroup = "rgba(251, 192, 147, 0.5)";
  const colors = [lineColorInGroup, lineColorOutGroup];
  medianCurves?.forEach((curve: CurveParams, index: number) => {
    const xs: number[] = [];
    const ys: number[] = [];

    for (let i = 0; i < numPts; i++) {
      const x = Math.pow(10, minExponent + (i / numPts) * rangeOfExponents);
      xs.push(x);
      ys.push(
        getCurveY(
          x,
          curve.ec50,
          curve.slope,
          curve.upperAsymptote,
          curve.lowerAsymptote
        )
      );
    }

    traces.push({
      x: xs,
      y: ys,
      name: `Median ${index}`,
      type: "curve",
      marker: { color: colors[index] },
    });

    traces.push({
      x: xs,
      y: ys.map((orig) => orig * 0.4),
      name: `quantile ${index}`,
      type: "curve",
      // marker: { color: "red" },
      line: { color: colors[index], dash: "dash" },
    });

    traces.push({
      x: xs,
      y: ys.map((orig) => orig * 0.4),
      name: `quantile ${index}`,
      type: "curve",
      // marker: { color: "red" },
      line: { color: colors[index], dash: "dash" },
    });
  });

  // make curve traces
  curves?.forEach((curve: CurveParams, index: number) => {
    const xs: number[] = [];
    const ys: number[] = [];

    for (let i = 0; i < numPts; i++) {
      const x = Math.pow(10, minExponent + (i / numPts) * rangeOfExponents);
      xs.push(x);
      ys.push(
        getCurveY(
          x,
          curve.ec50,
          curve.slope,
          curve.upperAsymptote,
          curve.lowerAsymptote
        )
      );
    }

    traces.push({
      x: xs,
      y: ys,
      name:
        curves && curves.length > 1
          ? allKeys.size > 1
            ? `${curve.id} Curve (${index + 1})`
            : `Curve ${index + 1}`
          : "Curve",
      type: "curve",
      marker: { color: "rgba(108, 122, 137, 0.2)" },
    });
  });

  traces.reverse();

  return traces;
};

function DoseCurvesPlot({
  measurements,
  curves,
  medianCurves,
  medianTitles,
}: Props) {
  const [curveTraces, setcurveTraces] = useState<CurveTrace[] | null>(null);

  useEffect(() => {
    if (measurements && curves) {
      const plotTraces = buildTraces(measurements, curves, medianCurves);
      setcurveTraces(plotTraces);
    }
  }, [measurements, curves]);

  return (
    <div>
      <LineChart
        title={"Dose Response Curve"}
        yAxisTitle={"Viability"}
        curves={curveTraces}
        showLegend={false}
        height={350}
        onLoad={() => {}}
      />
    </div>
  );
}

export default React.memo(DoseCurvesPlot);
