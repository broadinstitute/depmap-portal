import React, { useMemo } from "react";
import { CurveParams } from "src/compound/components/DoseResponseCurve";
import CurvesChart from "src/plot/components/CurvesChart";

// Make median curve traces
const lineColorInGroup = "rgba(1, 50, 32, 1)";
const shadingColorInGroup = "rgba(11, 146, 39, 0.3)";
const lineColorOutGroup = "rgba(211, 84, 0, 1)";
const shadingColorOutGroup = "rgba(251, 192, 147, 0.5)";

interface Props {
  minDose: number;
  maxDose: number;
  inGroupCurveParams: CurveParams[];
  outGroupCurveParams?: CurveParams[];
  handleSetPlotElement?: (element: any) => void;
  doseUnits?: string;
  includeMedianQuantileRegions?: boolean;
}

interface CurveTrace {
  x: number[];
  y: number[];
  text?: string;
  hoverinfo?: string;
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
  rangeOfExponents: number,
  includeMedianQuantileRegions: boolean
) => {
  const data: { xs: number[]; ys: Float32Array; name: string }[] = [];

  for (let i = 0; i < curves.length; i++) {
    const lowerA = curves[i].lowerAsymptote;
    const upperA = curves[i].upperAsymptote;
    const ec50 = curves[i].ec50;
    const slope = curves[i].slope;
    const xs: number[] = [];
    const ys = new Float32Array(numPts);
    const name = curves[i].displayName!;

    for (let j = 0; j < numPts; j++) {
      const x = 10 ** (minExponent + (j / (numPts - 1)) * rangeOfExponents);
      xs.push(x);

      ys[j] = lowerA + (upperA - lowerA) / (1 + (x / ec50) ** -slope);
    }

    data.push({ xs, ys, name });
  }

  const medianYs: number[] = [];
  const quantile0Ys: number[] = [];
  const quantile1Ys: number[] = [];
  if (includeMedianQuantileRegions) {
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
  shadingColor: string,
  includeMedianQuantileRegions: boolean
) => {
  const traces: CurveTrace[] = [];
  const curves = samplePoints(
    curveParams,
    numPts,
    minExponent,
    rangeOfExponents,
    includeMedianQuantileRegions
  );
  const points = curves.data;
  const medianPoints = curves.medianData;

  for (let index = 0; index < points.length; index++) {
    const pt = points[index];

    traces.push({
      x: pt.xs,
      y: Array.from(pt.ys),
      name: "",
      text: `${curves.data[index].name}`,
      hoverinfo: "x+y+text",
      type: "curve",
      mode: "lines",
      marker: { color: "rgba(108, 122, 137, 0.5)" },
    });
  }

  if (includeMedianQuantileRegions) {
    const medianAndQuantileTraces = buildMedianAndQuantileTraces(
      medianPoints.xs,
      medianPoints.medianYs,
      medianPoints.quantile0Ys,
      medianPoints.quantile1Ys,
      lineColor,
      shadingColor
    );
    traces.push(...medianAndQuantileTraces);
  }

  return traces;
};

const buildTraces = (
  minDose: number,
  maxDose: number,
  inGroupCurveParams: CurveParams[],
  outGroupCurveParams: CurveParams[],
  includeMedianQuantileRegions: boolean
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
    shadingColorInGroup,
    includeMedianQuantileRegions
  );

  if (outGroupCurveParams.length > 0) {
    const outGroupData = samplePoints(
      outGroupCurveParams,
      outGroupNumPts,
      minExponent,
      rangeOfExponents,
      includeMedianQuantileRegions
    );

    if (includeMedianQuantileRegions) {
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
    }
  }

  traces.reverse();

  return traces;
};

function DoseCurvesPlot({
  minDose,
  maxDose,
  inGroupCurveParams,
  outGroupCurveParams = [],
  doseUnits = "Concentration (uM)",
  handleSetPlotElement = () => {},
  includeMedianQuantileRegions = true,
}: Props) {
  const plotTraces = useMemo(() => {
    if (inGroupCurveParams && minDose && maxDose) {
      return buildTraces(
        minDose,
        maxDose,
        inGroupCurveParams,
        outGroupCurveParams,
        includeMedianQuantileRegions
      );
    }
    return null;
  }, [
    inGroupCurveParams,
    outGroupCurveParams,
    minDose,
    maxDose,
    includeMedianQuantileRegions,
  ]);

  return (
    <div>
      <div
        style={{
          color: "#333333",
          fontFamily: "Lato",
          fontWeight: "bold",
          fontSize: "18px",
          paddingLeft: "30px",
          paddingTop: "15px",
        }}
      >
        Dose Response Curves
      </div>
      <CurvesChart
        title={""}
        yAxisTitle={"Viability"}
        xAxisTitle={doseUnits}
        dottedLine={0.3}
        minX={minDose}
        maxX={maxDose}
        curveTraces={plotTraces}
        showLegend={false}
        height={300}
        onLoad={handleSetPlotElement}
      />
    </div>
  );
}

export default React.memo(DoseCurvesPlot);
