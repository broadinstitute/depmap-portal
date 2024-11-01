import React, { useEffect, useState } from "react";
import { CurveParams } from "src/compound/components/DoseResponseCurve";
import CurvesChart from "src/plot/components/CurvesChart";
// import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

// Make median curve traces
const lineColorInGroup = "rgba(1, 50, 32, 1)";
const shadingColorInGroup = "rgba(11, 146, 39, 0.3)";
const lineColorOutGroup = "rgba(211, 84, 0, 1)";
const shadingColorOutGroup = "rgba(251, 192, 147, 0.5)";

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

const samplePoints = (
  curves: CurveParams[],
  numPts: number,
  minExponent: number,
  rangeOfExponents: number
) => {
  const data: { xs: number[]; ys: Float32Array }[] = [];

  for (let i = 0; i < curves.length; i++) {
    const lowerA = curves[i].lowerAsymptote;
    const upperA = curves[i].upperAsymptote;
    const ec50 = curves[i].ec50;
    const slope = curves[i].slope;
    const xs: number[] = [];
    const ys = new Float32Array(numPts);

    for (let j = 0; j < numPts; j++) {
      const x = Math.pow(
        10,
        minExponent + (j / (numPts - 1)) * rangeOfExponents
      );
      xs.push(x);

      ys[j] = lowerA + (upperA - lowerA) / (1 + Math.pow(x / ec50, -slope));
    }

    data.push({ xs, ys });
  }

  const medianYs: number[] = [];
  const quantile0Ys: number[] = [];
  const quantile1Ys: number[] = [];
  for (let index = 0; index < data[0].xs.length; index++) {
    const xIndex = index;

    const yValsAtThisXIndex = new Float32Array(data.length);
    for (let j = 0; j < data.length; j++) {
      const dataCurve = data[j];
      yValsAtThisXIndex[j] = dataCurve.ys[xIndex];
    }
    const sortedArr = yValsAtThisXIndex.sort();
    const quantile0Index = sortedArr.length * 0.4;
    const quantile1Index = sortedArr.length * 0.6;
    const mid = Math.floor(sortedArr.length / 2);
    const median =
      sortedArr.length % 2
        ? sortedArr[mid]
        : (sortedArr[mid - 1] + sortedArr[mid]) / 2;
    const quantile0 = sortedArr[Math.round(quantile0Index)];
    const quantile1 = sortedArr[Math.round(quantile1Index)];

    medianYs.push(median);
    quantile0Ys.push(quantile0);
    quantile1Ys.push(quantile1);
  }

  return {
    data,
    medianData: { xs: data[0].xs, medianYs, quantile0Ys, quantile1Ys },
  };
};

const buildMedianAndQuantileTraces = (
  xs: number[],
  medianYs: number[],
  quantile0Ys: number[],
  quantile1Ys: number[],
  lineColor: string,
  fillColor: string
) => {
  const traces: CurveTrace[] = [];
  traces.push({
    x: xs,
    y: quantile0Ys,
    name: "",
    type: "curve",
    mode: "lines",
    fill: "tonextx",
    fillcolor: fillColor,
    line: { color: lineColor, dash: "dash", smoothing: 1.3 },
  });

  traces.push({
    x: xs,
    y: quantile1Ys,
    name: "",
    type: "curve",
    mode: "lines",
    fill: "none",
    fillcolor: fillColor,
    line: { color: lineColor, dash: "dash", smoothing: 1.3 },
  });

  traces.push({
    x: xs,
    y: medianYs,
    name: "",
    mode: "lines",
    type: "curve",
    marker: { color: lineColor },
  });

  return traces;
};

const getTraces = (
  curveParams: CurveParams[],
  numPts: number,
  minExponent: number,
  rangeOfExponents: number,
  lineColor: string,
  shadingColor: string
) => {
  const traces: CurveTrace[] = [];
  const curves = samplePoints(
    curveParams,
    numPts,
    minExponent,
    rangeOfExponents
  );
  const points = curves.data;
  const medianPoints = curves.medianData;

  for (let index = 0; index < points.length; index++) {
    const pt = points[index];

    traces.push({
      x: pt.xs,
      y: Array.from(pt.ys),
      name: "",
      type: "curve",
      mode: "lines",
      marker: { color: "rgba(108, 122, 137, 0.5)" },
    });
  }

  const medianAndQuantileTraces = buildMedianAndQuantileTraces(
    medianPoints.xs,
    medianPoints.medianYs,
    medianPoints.quantile0Ys,
    medianPoints.quantile1Ys,
    lineColor,
    shadingColor
  );
  traces.push(...medianAndQuantileTraces);

  return traces;
};

const buildTraces = (
  minDose: number,
  maxDose: number,
  inGroupCurveParams: CurveParams[],
  outGroupCurveParams: CurveParams[]
): CurveTrace[] => {
  const minX = minDose;
  const maxX = maxDose;
  const rangeOfExponents = Math.log10(maxX) - Math.log10(minX);
  const minExponent = Math.log10(minX);
  const inGroupNumPts = 150;
  const outGroupNumPts = 8;

  const traces = getTraces(
    inGroupCurveParams,
    inGroupNumPts,
    minExponent,
    rangeOfExponents,
    lineColorInGroup,
    shadingColorInGroup
  );

  const outGroupData = samplePoints(
    outGroupCurveParams,
    outGroupNumPts,
    minExponent,
    rangeOfExponents
  );

  const medianPoints = outGroupData.medianData;

  const medianAndQuantileTraces = buildMedianAndQuantileTraces(
    medianPoints.xs,
    medianPoints.medianYs,
    medianPoints.quantile0Ys,
    medianPoints.quantile1Ys,
    lineColorOutGroup,
    shadingColorOutGroup
  );
  traces.push(...medianAndQuantileTraces);

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
      <CurvesChart
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
