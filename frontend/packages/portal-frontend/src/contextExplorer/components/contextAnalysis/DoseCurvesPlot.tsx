import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CurveParams,
  CurvePlotPoints,
  groupBy,
} from "src/compound/components/DoseResponseCurve";
import {
  CurveTrace,
  Rep1Color,
  Rep2Color,
  Rep3Color,
} from "src/compound/doseCurvesTab/types";
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
  doseRepPoints?: {
    [model_id: string]: CurvePlotPoints[];
  } | null;
  outGroupCurveParams?: CurveParams[];
  handleSetPlotElement?: (element: any) => void;
  handleClickCurve?: (id: string) => void;
  selectedCurves?: Set<string>;
  selectedModelIds?: Set<string>;
  doseUnits?: string;
  includeMedianQuantileRegions?: boolean;
  useDefaultTitle?: boolean;
}

const samplePoints = (
  curves: CurveParams[],
  numPts: number,
  minExponent: number,
  rangeOfExponents: number,
  includeMedianQuantileRegions: boolean
) => {
  const data: {
    xs: number[];
    ys: Float32Array;
    name: string;
    id: string;
    ec50: number;
    slope: number;
    lowerA: number;
    upperA: number;
  }[] = [];

  for (let i = 0; i < curves.length; i++) {
    const lowerA = curves[i].lowerAsymptote;
    const upperA = curves[i].upperAsymptote;
    const ec50 = curves[i].ec50;
    const slope = curves[i].slope;
    const xs: number[] = [];
    const ys = new Float32Array(numPts);
    const name = curves[i].displayName!;
    const id = curves[i].id!;

    for (let j = 0; j < numPts; j++) {
      const x = 10 ** (minExponent + (j / (numPts - 1)) * rangeOfExponents);
      xs.push(x);

      ys[j] = lowerA + (upperA - lowerA) / (1 + (x / ec50) ** -slope);
    }

    data.push({ xs, ys, name, id, ec50, slope, lowerA, upperA });
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
      id: pt.id,
      text: pt.xs.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (_) => `<b>Cell Line Name:</b> ${
          curves.data[index].name
        }<br><b>DepMap ID:</b> ${curves.data[index].id}
    <br><b>Lower Asymptote:</b> ${curves.data[index].lowerA.toFixed(
      4
    )}<br><b>Upper Asymptote:</b> ${curves.data[index].upperA.toFixed(
          4
        )}<br><b>ec50:</b> ${curves.data[index].ec50.toFixed(
          4
        )}<br><b>slope:</b> ${curves.data[index].slope.toFixed(4)}`
      ),
      hovertemplate:
        "<b>Dose:</b> %{x:.4f}<br>" +
        "<b>Viability</b>: %{y:.4f}<br>" +
        "%{text}",
      type: "curve",
      mode: "lines",
      line: { color: "rgba(108, 122, 137, 0.1)", width: 2 },
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

const buildPointsTraces = (
  groupedPointsByReplicate: Map<string, CurvePlotPoints[]>,
  id?: string
) => {
  let minX: number;
  let maxX: number;

  const newTraces: CurveTrace[] = [];

  // for each group of points, plot them on the plot with their own color
  Array.from(groupedPointsByReplicate.keys()).forEach((replicate) => {
    const subgroup = groupedPointsByReplicate.get(replicate.toString()) || [];

    // within each group of points with the same replicate #, split them into masked and non-masked groups
    const isMaskedValues = [
      ...new Set(subgroup.map((item: CurvePlotPoints) => item.isMasked)),
    ];

    const groupedPointsByIsMasked = groupBy(subgroup, "isMasked");

    isMaskedValues.forEach((isMaskedValue) => {
      const subsubGroup = groupedPointsByIsMasked.get(isMaskedValue.toString());

      if (!subsubGroup) {
        return;
      }

      const xs = subsubGroup.map((item: CurvePlotPoints) => item.dose);
      const ys = subsubGroup.map((item: CurvePlotPoints) => item.viability);

      let name: string = id
        ? `${id} Replicate ${replicate}`
        : `Replicate ${replicate}`;
      if (isMaskedValue) {
        name += " (masked)";
      }

      const getReplicateColor = (replicate: string) => {
        switch (replicate) {
          case "1":
            return Rep1Color;
          case "2":
            return Rep2Color;
          case "3":
            return Rep3Color;
          default:
            return "#333333";
        }
      };

      newTraces.push({
        x: xs,
        y: ys,
        mode: "markers",
        marker: { color: getReplicateColor(replicate) },
        type: "scattergl",
        customdata: ["no"],
        label: [`${isMaskedValue}`],
        replicate: [`${replicate}`],
        name,
      });
    });

    const allXs = subgroup.map((item: CurvePlotPoints) => item.dose);

    const minSubgroupX = Math.min(...allXs);
    const maxSubgroupX = Math.max(...allXs);

    minX =
      minX == null ? minSubgroupX : minX < minSubgroupX ? minX : minSubgroupX;
    maxX =
      maxX == null ? maxSubgroupX : maxX > maxSubgroupX ? maxX : maxSubgroupX;
  });

  return { range: [minX!, maxX!], traces: newTraces };
};

const buildPointsTracesWithIds = (setAsArray: CurvePlotPoints[]) => {
  const groupedPointsById = groupBy(setAsArray, "id");
  let minX: number;
  let maxX: number;
  const newTraces: CurveTrace[] = [];

  groupedPointsById.forEach((v, k) => {
    const groupedPointsByReplicate = groupBy(v, "replicate");

    const pointTraceInfo = buildPointsTraces(groupedPointsByReplicate, k);

    newTraces.push(...pointTraceInfo.traces);

    const [newMinX, newMaxX] = pointTraceInfo.range;
    minX = minX == null ? newMinX : Math.min(newMinX, minX);
    maxX = maxX == null ? newMaxX : Math.max(newMaxX, maxX);
  });

  return { range: [minX!, maxX!], traces: newTraces };
};

const buildReplicatePointTraces = (
  curves: CurveParams[],
  replicatePoints: CurvePlotPoints[]
) => {
  const setAsArray = Array.from(replicatePoints || []);

  const allKeys = new Set(
    setAsArray.filter((points) => !!points.id).map((points) => points.id)
  );
  curves
    ?.filter((curve) => !!curve.id)
    .forEach((curve) => allKeys.add(curve.id));

  const pointTraceInfo =
    setAsArray.length > 0 && allKeys.size > 1
      ? buildPointsTracesWithIds(setAsArray)
      : buildPointsTraces(groupBy(setAsArray, "replicate"));

  return pointTraceInfo;
};

const buildReplicateTraces = (
  inGroupCurveParams: CurveParams[],
  replicatePoints: CurvePlotPoints[]
) => {
  const pointTraceInfo = buildReplicatePointTraces(
    inGroupCurveParams,
    replicatePoints
  );

  const pointTraces = pointTraceInfo.traces;

  pointTraces.sort((a, b) => {
    // sort by replicate name, i.e. replicate number
    if (a.name > b.name) {
      return 1;
    }
    if (a.name < b.name) {
      return -1;
    }
    return 0;
  });

  return pointTraces;
};

const buildTraces = (
  minDose: number,
  maxDose: number,
  inGroupCurveParams: CurveParams[],
  outGroupCurveParams: CurveParams[],
  includeMedianQuantileRegions: boolean,
  doseRepPoints?: {
    [model_id: string]: CurvePlotPoints[];
  } | null
): CurveTrace[] => {
  const minX = minDose;
  const maxX = maxDose;
  const rangeOfExponents = Math.log10(maxX) - Math.log10(minX);
  const minExponent = Math.log10(minX);
  const inGroupNumPts = 50;
  const outGroupNumPts = 8;

  let traces: CurveTrace[] = [];
  if (doseRepPoints) {
    const modelIds = Object.keys(doseRepPoints);

    modelIds.forEach((modelId) => {
      const modelCurveParams = inGroupCurveParams.filter(
        (curveParam: CurveParams) => modelIds.includes(curveParam.id!)
      );
      const ptTraces = buildReplicateTraces(
        modelCurveParams,
        doseRepPoints[modelId]
      );
      traces.push(...ptTraces);
    });
  }

  const curveTraces = getTraces(
    inGroupCurveParams,
    inGroupNumPts,
    minExponent,
    rangeOfExponents,
    lineColorInGroup,
    shadingColorInGroup,
    includeMedianQuantileRegions
  );
  traces.push(...curveTraces);

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
  doseRepPoints = null,
  doseUnits = "Concentration (uM)",
  handleSetPlotElement = () => {},
  handleClickCurve = undefined,
  selectedCurves = undefined,
  includeMedianQuantileRegions = true,
  useDefaultTitle = true,
}: Props) {
  const plotTraces = useMemo(() => {
    if (
      inGroupCurveParams &&
      !Number.isNaN(minDose) &&
      !Number.isNaN(maxDose)
    ) {
      return buildTraces(
        minDose,
        maxDose,
        inGroupCurveParams,
        outGroupCurveParams,
        includeMedianQuantileRegions,
        doseRepPoints
      );
    }
    return null;
  }, [
    inGroupCurveParams,
    outGroupCurveParams,
    minDose,
    maxDose,
    includeMedianQuantileRegions,
    doseRepPoints,
  ]);

  return (
    <div>
      {useDefaultTitle && (
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
      )}
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
        onClickCurve={handleClickCurve}
        selectedCurves={selectedCurves}
      />
    </div>
  );
}

export default React.memo(DoseCurvesPlot);
