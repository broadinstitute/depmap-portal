/* eslint-disable */
import * as React from "react";
import { Tooltip, OverlayTrigger } from "react-bootstrap";

export interface HistogramProps {
  data: number[];
  numBins?: number;
  color?: string;
}

export class Histogram extends React.Component<HistogramProps, any> {
  constructor(props: HistogramProps) {
    super(props);
  }

  binValues = (values: number[], numBins: number) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    let range = max - min;
    if (range == 0) {
      range = 1;
    }

    const binCounts = [];
    for (let i = 0; i < numBins; i++) {
      binCounts.push(0);
    }

    for (let i = 0; i < values.length; i++) {
      let binIndex = Math.floor(((values[i] - min) * numBins) / range);
      if (binIndex >= binCounts.length) {
        binIndex = binCounts.length - 1;
      }
      binCounts[binIndex] += 1;
    }

    return { min, max, bins: binCounts };
  };

  renderBins = (min: number, max: number, bins: number[]) => {
    const bars = [];
    const range = max - min;
    const maxCount = Math.max(...bins);
    const total: number = bins.reduce((a, b) => a + b, 0);
    for (let i = 0; i < bins.length; i++) {
      const height = (90 * bins[i]) / maxCount;
      const rangeMin = min + (range / bins.length) * i;
      const rangeMax = min + (range / bins.length) * (i + 1);
      const tooltip = (
        <Tooltip
          id={`tooltip${i.toString()}`}
          style={{ backgroundColor: "#dedede" }}
        >
          {rangeMin.toPrecision(2)} to {rangeMax.toPrecision(2)}
          <br />
          {bins[i]} out of {total}
        </Tooltip>
      );
      bars.push(
        <OverlayTrigger placement="top" overlay={tooltip} key={`${i}-bin`}>
          <div
            key={`bar-${i.toString()}`}
            style={{
              height: `${height}%`,
              backgroundColor: this.props.color ?? "#bababa",
              display: "flex",
              flexGrow: 1,
            }}
          >
            {" "}
          </div>
        </OverlayTrigger>
      );
    }
    return bars;
  };

  render() {
    const dataWithoutNulls = this.props.data.slice(0).filter((el) => {
      return el != null;
    });
    const numBins = this.props.numBins
      ? this.props.numBins
      : Math.ceil(Math.log2(dataWithoutNulls.length) + 1);
    const binned = this.binValues(dataWithoutNulls, numBins);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            height: "100%",
            width: "100%",
            alignItems: "flex-end",
          }}
        >
          {this.renderBins(binned.min, binned.max, binned.bins)}
        </div>
        <div
          style={{
            fontSize: "8px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{binned.min.toPrecision(3)}</span>
          <span>{binned.max.toPrecision(3)}</span>
        </div>
      </div>
    );
  }
}
