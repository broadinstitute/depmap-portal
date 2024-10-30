import _, { range } from "lodash";
import React, { useEffect, useState } from "react";
import {
  CurveParams,
  CurvePlotPoints,
} from "src/compound/components/DoseResponseCurve";
import LineChart from "src/plot/components/LineChart";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

interface Props {
  minDose: number;
  maxDose: number;
  inGroupCurveParams: CurveParams[];
  outGroupCurveParams: CurveParams[];
  // handleSetPlotElement: (element: any) => void;
}

interface CurveTrace {
  x: number[];
  y: number[];
  customdata?: string[];
  label?: string[];
  replicate?: string[];
  name: string;
  marker?: any;
  type?: "curve" | "scatter" | null;
  fill?: "tonextx" | "tozerox" | "none" | null;
  fillcolor?: string;
  opacity?: string;
  line?: any;
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

interface MedianAndQuantiles {
  median: number;
  quantile0: number;
  quantile1: number;
}
const calcMedianAndQuantiles = (
  sortedArr: number[],
  quantile0Index: number,
  quantile1Index: number
): MedianAndQuantiles => {
  const s = [...sortedArr];
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  const quantile0 = s[Math.round(quantile0Index)];
  const quantile1 = s[Math.round(quantile1Index)];

  return { median, quantile0, quantile1 };
};

// Make median curve traces
const lineColorInGroup = "rgba(1, 50, 32, 1)";
const shadingColorInGroup = "rgba(11, 146, 39, 0.3)";
const lineColorOutGroup = "rgba(211, 84, 0, 1)";
const shadingColorOutGroup = "rgba(251, 192, 147, 0.5)";

const buildTraces = (
  minDose: number,
  maxDose: number,
  inGroupCurveParams: CurveParams[],
  outGroupCurveParams: CurveParams[]
): CurveTrace[] => {
  const traces: CurveTrace[] = [];

  const minX = minDose;
  const maxX = maxDose;
  const rangeOfExponents = Math.log10(maxX) - Math.log10(minX);
  const minExponent = Math.log10(minX);
  const numPts = 300;

  const xs: number[] = [];

  // make curve traces
  inGroupCurveParams?.forEach((curve: CurveParams, index: number) => {
    const ys: number[] = [];

    for (let i = 0; i < numPts; i++) {
      const x = Math.pow(10, minExponent + (i / numPts) * rangeOfExponents);
      xs.push(x);
      const curveY = getCurveY(
        x,
        curve.ec50,
        curve.slope,
        curve.upperAsymptote,
        curve.lowerAsymptote
      );
      ys.push(curveY);
    }
    traces.push({
      x: xs,
      y: ys,
      name: `${curve.id}`,
      type: "curve",
      mode: "lines",
      marker: {
        color: "rgba(108, 122, 137, 0.5)",
        line: {
          smoothing: 1.3,
        },
      },
    });
  });

  const xsOUT: number[] = [];
  // Needed for the median and quantile calculations, but not drawn as individual curves
  const outgroupTracesNotDrawn: CurveTrace[] = [];
  outGroupCurveParams?.forEach((curve: CurveParams) => {
    const ys: number[] = [];

    for (let i = 0; i < 8; i++) {
      const x = Math.pow(10, minExponent + (i / 7) * rangeOfExponents);
      xsOUT.push(x);
      const curveY = getCurveY(
        x,
        curve.ec50,
        curve.slope,
        curve.upperAsymptote,
        curve.lowerAsymptote
      );
      ys.push(curveY);
    }
    outgroupTracesNotDrawn.push({
      x: xsOUT,
      y: ys,
      name: "",
      type: "curve",
      marker: { color: "rgba(108, 122, 137, 1)" },
    });
  });

  const medianYs: number[] = [];
  const quantile0Ys: number[] = [];
  const quantile1Ys: number[] = [];

  const outGroupMedianYs: number[] = [];
  const outGroupQuantile0Ys: number[] = [];
  const outGroupQuantile1Ys: number[] = [];

  xs.forEach((_: number, i: number) => {
    // get the In Group y's
    const yValsAtXDose = [...traces].map((trace: CurveTrace) => trace.y[i]);
    const sortedYValsAtXDose = [...yValsAtXDose].sort();
    const quantile0Location = sortedYValsAtXDose.length * 0.4;
    const quantile1Location = sortedYValsAtXDose.length * 0.6;
    const medianAndQuantiles = calcMedianAndQuantiles(
      sortedYValsAtXDose,
      quantile0Location,
      quantile1Location
    );
    medianYs.push(medianAndQuantiles.median);
    quantile0Ys.push(medianAndQuantiles.quantile0);
    quantile1Ys.push(medianAndQuantiles.quantile1);
  });

  xsOUT.forEach((_: number, i: number) => {
    // get the Out Group y's
    const yValsAtXDoseOUT = [...outgroupTracesNotDrawn].map(
      (trace: CurveTrace) => trace.y[i]
    );
    const sortedYValsAtXDoseOUT = [...yValsAtXDoseOUT].sort();
    const quantile0LocationOUT = sortedYValsAtXDoseOUT.length * 0.4;
    const quantile1LocationOUT = sortedYValsAtXDoseOUT.length * 0.6;
    const medianAndQuantilesOUT = calcMedianAndQuantiles(
      sortedYValsAtXDoseOUT,
      quantile0LocationOUT,
      quantile1LocationOUT
    );
    outGroupMedianYs.push(medianAndQuantilesOUT.median);
    outGroupQuantile0Ys.push(medianAndQuantilesOUT.quantile0);
    outGroupQuantile1Ys.push(medianAndQuantilesOUT.quantile1);
  });

  traces.push({
    x: xs,
    y: quantile0Ys,
    name: "quantile 0 in group",
    type: "curve",
    mode: "lines",
    fill: "tonextx",
    fillcolor: shadingColorInGroup,
    line: { color: lineColorInGroup, dash: "dash", smoothing: 1.3 },
  });

  traces.push({
    x: xs,
    y: quantile1Ys,
    name: "quantile 1 in group",
    type: "curve",
    mode: "lines",
    fill: "none",
    fillcolor: shadingColorInGroup,
    line: { color: lineColorInGroup, dash: "dash", smoothing: 1.3 },
  });

  traces.push({
    x: xs,
    y: medianYs,
    name: "median in group",
    mode: "lines",
    type: "curve",
    marker: { color: lineColorInGroup },
  });

  traces.push({
    x: xsOUT,
    y: outGroupQuantile0Ys,
    name: "quantile 0 OUT group",
    type: "curve",
    mode: "lines",
    fill: "tonextx",
    fillcolor: shadingColorOutGroup,
    line: { color: lineColorOutGroup, dash: "dash", smoothing: 1.3 },
  });

  traces.push({
    x: xsOUT,
    y: outGroupQuantile1Ys,
    name: "quantile 1 OUT group",
    type: "curve",
    mode: "lines",
    fill: "none",
    fillcolor: shadingColorOutGroup,
    line: { color: lineColorOutGroup, dash: "dash", smoothing: 1.3 },
  });

  traces.push({
    x: xsOUT,
    y: outGroupMedianYs,
    name: "median OUT group",
    type: "curve",
    mode: "lines",
    marker: { color: lineColorOutGroup },
  });

  traces.reverse();
  return traces;
};

function DoseCurvesPlot({
  minDose,
  maxDose,
  inGroupCurveParams,
  outGroupCurveParams,
}: Props) {
  const [curveTraces, setcurveTraces] = useState<CurveTrace[] | null>(null);

  useEffect(() => {
    if (inGroupCurveParams && outGroupCurveParams && minDose && maxDose) {
      const plotTraces = buildTraces(
        minDose,
        maxDose,
        inGroupCurveParams,
        outGroupCurveParams
      );
      setcurveTraces(plotTraces);
    }
  }, [inGroupCurveParams, outGroupCurveParams, minDose, maxDose]);

  return (
    <div>
      <LineChart
        title={"Dose Response Curve"}
        yAxisTitle={"Viability"}
        curves={curveTraces}
        showLegend={false}
        height={480}
        onLoad={() => {}}
      />
    </div>
  );
}

export default React.memo(DoseCurvesPlot);
