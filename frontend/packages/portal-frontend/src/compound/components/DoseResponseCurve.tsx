/* eslint-disable */
import * as React from "react";

import {
  PlotResizer,
  Trace,
  DoseResponsePlot,
} from "src/compound/components/DoseResponsePlot";

export interface DoseResponseCurveProps {
  plotId: string;
  measurements?: Set<CurvePlotPoints>;
  curves?: Array<CurveParams>;
  yUnits?: string;
  xUnits?: string;
}

export interface CurveParams {
  ec50: number;
  slope: number;
  lowerAsymptote: number;
  upperAsymptote: number;
  id?: string;
}

export interface CurvePlotPoints {
  dose: number;
  viability: number;
  isMasked: boolean;
  replicate: number;
  id?: string;
}

export const defaultParams: Array<CurveParams> = [
  {
    ec50: 0,
    slope: 0,
    lowerAsymptote: 0,
    upperAsymptote: 0,
  },
];
export const defaultPoints: Set<CurvePlotPoints> = new Set([]);

function getCurveY(
  x: number,
  ec50: number,
  slope: number,
  upperA: number,
  lowerA: number
) {
  return lowerA + (upperA - lowerA) / (1 + Math.pow(x / ec50, -slope));
}

// from : https://stackoverflow.com/questions/14696326/break-array-of-objects-into-separate-arrays-based-on-a-property
function groupBy(
  array: Array<CurvePlotPoints>,
  prop: "dose" | "viability" | "isMasked" | "replicate" | "id"
): Map<string, Array<CurvePlotPoints>> {
  const grouped = new Map<string, Array<CurvePlotPoints>>();

  array.forEach((points) => {
    const p = prop in points ? points[prop]!.toString() : null;

    if (p) {
      if (!grouped.has(p)) {
        grouped.set(p, []);
      }

      grouped.get(p)?.push(points);
    }
  });

  return grouped;
}

export class DoseResponseCurve extends React.PureComponent<DoseResponseCurveProps> {
  resizer: PlotResizer;

  static defaultProps = {
    measurements: defaultPoints,
    curves: defaultParams,
    yUnits: "DEFAULT NOT FOUND",
    xUnits: undefined,
  };

  constructor(props: DoseResponseCurveProps) {
    super(props);
    this.resizer = new PlotResizer(this.props.plotId);
  }

  buildTraces(): Array<Trace> {
    const setAsArray = Array.from(this.props.measurements || []);
    const traces: Array<Trace> = [];

    const allKeys = new Set(
      setAsArray.filter((points) => !!points.id).map((points) => points.id)
    );
    this.props.curves
      ?.filter((curve) => !!curve.id)
      .forEach((curve) => allKeys.add(curve.id));

    let minX: number;
    let maxX: number;
    if (setAsArray.length > 0 && allKeys.size > 1) {
      [minX, maxX] = this.buildPointsTracesWithIds(setAsArray, traces);
    } else {
      [minX, maxX] = this.buildPointsTraces(
        groupBy(setAsArray, "replicate"),
        traces
      );
    }

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

    // make curve traces
    this.props.curves?.forEach((curve, index) => {
      const xs: Array<number> = [];
      const ys: Array<number> = [];

      const rangeOfExponents = Math.log10(maxX) - Math.log10(minX);
      const minExponent = Math.log10(minX);
      const numPts = 3000;
      for (let i = 0; i < numPts; i++) {
        // the plot has the x axis in a logarithmic scale, and we want the x-coordinates of points on our graph to look evenly spaced visually
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
          this.props.curves && this.props.curves.length > 1
            ? allKeys.size > 1
              ? `${curve.id} Curve (${index + 1})`
              : `Curve ${index + 1}`
            : "Curve",
        type: "curve",
      });
    });

    traces.reverse();

    return traces;
  }

  buildPointsTracesWithIds(
    setAsArray: Array<CurvePlotPoints>,
    traces: Array<Trace>
  ) {
    const groupedPointsById = groupBy(setAsArray, "id");
    let minX: number;
    let maxX: number;
    groupedPointsById.forEach((v, k) => {
      const groupedPointsByReplicate = groupBy(v, "replicate");
      const [newMinX, newMaxX] = this.buildPointsTraces(
        groupedPointsByReplicate,
        traces,
        k
      );
      minX = minX == null ? newMinX : Math.min(newMinX, minX);
      maxX = maxX == null ? newMaxX : Math.max(newMaxX, maxX);
    });

    return [minX!, maxX!];
  }

  buildPointsTraces(
    groupedPointsByReplicate: Map<string, Array<CurvePlotPoints>>,
    traces: Array<Trace>,
    id?: string
  ) {
    let minX: number;
    let maxX: number;

    // for each group of points, plot them on the plot with their own color
    Array.from(groupedPointsByReplicate.keys()).forEach((replicate) => {
      const subgroup = groupedPointsByReplicate.get(replicate.toString()) || [];

      // within each group of points with the same replicate #, split them into masked and non-masked groups
      const isMaskedValues = [
        ...new Set(subgroup.map((item: CurvePlotPoints) => item.isMasked)),
      ];

      const groupedPointsByIsMasked = groupBy(subgroup, "isMasked");

      isMaskedValues.forEach((isMaskedValue) => {
        const subsubGroup = groupedPointsByIsMasked.get(
          isMaskedValue.toString()
        );

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

        traces.push({
          x: xs,
          y: ys,
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

    return [minX!, maxX!];
  }

  render() {
    const allKeys = new Set(
      (this.props.curves || [])
        .filter((curve) => !!curve.id)
        .map((curve) => curve.id)
    );

    const curveParamDisplay = (this.props.curves || []).map((curve, index) => {
      return (
        <div key={index}>
          {this.props.curves!.length > 1 && (
            <h4>
              {allKeys.size > 1
                ? `${curve.id} Curve (${index + 1})`
                : `Curve ${index + 1}`}
            </h4>
          )}
          ec50: {curve.ec50.toFixed(4)}
          <br />
          slope: {curve.slope.toFixed(4)} <br />
          lower_asym: {curve.lowerAsymptote.toFixed(4)}
          <br />
          upper_asym: {curve.upperAsymptote.toFixed(4)}
          <br />
        </div>
      );
    });

    const plotProps = {
      plotId: this.props.plotId,
      xLabel: this.props.xUnits
        ? `Concentration (${this.props.xUnits})`
        : "Concentration",
      yLabel: this.props.yUnits || "",
      traces: this.buildTraces(),
      resizer: this.resizer,
    };

    return (
      <div>
        <div
          style={{
            width: "20%",
            display: "inline-block",
            verticalAlign: "top",
          }}
        >
          <h4>Curve Fitting Parameters</h4>
          {curveParamDisplay}
          {this.props.curves && this.props.curves.length > 1 && (
            <p style={{ paddingTop: "5px" }}>
              Curve numbers do not correspond to replicate numbers. The AUC
              value is obtained by taking the mean AUC of all curves.
            </p>
          )}
        </div>
        <div
          style={{
            height: 400,
            width: "80%",
            display: "inline-block",
            verticalAlign: "top",
          }}
        >
          <DoseResponsePlot {...plotProps} />
        </div>
        <br />
      </div>
    );
  }
}
