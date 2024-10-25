import React, { useEffect, useState } from "react";
import {
  CurveParams,
  CurvePlotPoints,
  groupBy,
  MedianCurve,
} from "src/compound/components/DoseResponseCurve";
import LineChart from "src/plot/components/LineChart";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

interface Props {
  medianLines: MedianCurve[];
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
  type?: "curve" | null;
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
  medianLines: MedianCurve[]
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
  const min = Math.min(...doses);
  const range = Math.max(...doses) - min;

  // make curve traces
  curves?.forEach((curve: CurveParams, index: number) => {
    const xs: number[] = [];
    const ys: number[] = [];

    const numPts = 3000;
    for (let i = 0; i < numPts; i++) {
      const x = min + (i / numPts) * range;
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
      y: Object.values(medianLines[0].smoothed_drc),
      name: "Median 1",
      type: "curve",
      marker: { color: "green" },
    });

    traces.push({
      x: xs,
      y: Object.values(medianLines[1].smoothed_drc),
      name: `Median 2`,
      type: "curve",
      marker: { color: "red" },
    });

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
      marker: { color: "#D3D3D3" },
    });
  });

  traces.reverse();

  return traces;
};

function DoseCurvesPlot({
  measurements,
  curves,
  medianLines,
  medianTitles,
}: Props) {
  const [curveTraces, setcurveTraces] = useState<CurveTrace[] | null>(null);

  useEffect(() => {
    if (measurements && curves) {
      const plotTraces = buildTraces(measurements, curves, medianLines);
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
