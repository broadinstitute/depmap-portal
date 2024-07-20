import React from "react";
import d3 from "d3";

/* eslint-disable @typescript-eslint/lines-between-class-members */

// Utilities for rendering stacked box plots using d3.
// Does not include assumptions about how quartiles or outliers will be calculated.
export default class StackedBoxplotUtils {
  d3: any;
  svg: d3.Selection<any>;
  plotHeight: number;
  plots: d3.selection.Enter<any>;
  labels: Array<string>;
  xScale: d3.scale.Ordinal<number, number>;
  yScale: d3.scale.Ordinal<string, number>;
  xAxis: d3.svg.Axis;
  yAxis: d3.svg.Axis;
  xAxisMinimum: number;
  xAxisMaximum: number;

  // set constant dimensions and margins for the graph
  readonly margin = { top: 0, right: 0, bottom: 50, left: 0 };
  readonly svgWidth = 250; // Note: this needs to match the value set in CSS to prevent auto scaling
  readonly rowHeight = 30;
  readonly plotWidth = this.svgWidth - this.margin.left - this.margin.right;

  constructor(
    svgName: string,
    d3Container: React.MutableRefObject<any>,
    labels: Array<string>,
    dataMatrix: Array<Array<number | null>>
  ) {
    this.d3 = window.d3 || (window.Plotly ? window.Plotly.d3 : null);

    // Remove any existing d3 elements from the container before re-rendering
    this.d3.select(d3Container.current).selectAll("*").remove();

    // Set SVG height based on # of rows
    this.labels = labels;
    this.plotHeight = this.labels.length * this.rowHeight;
    const svgHeight = this.plotHeight + this.margin.top + this.margin.bottom;

    // initialize the svg with padding
    this.svg = this.d3
      .select(d3Container.current)
      .append("svg")
      .attr("class", svgName)
      .attr("viewBox", `0 0 ${this.svgWidth} ${svgHeight}`)
      .append("g")
      .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

    this.plots = this.svg.selectAll("g").data(labels).enter();

    // calculate axis ranges
    const flattenedDataList = [].concat(...(dataMatrix as any));
    this.xAxisMinimum = this.d3.min(flattenedDataList);
    this.xAxisMaximum = this.d3.max(flattenedDataList);

    // Add the X axis
    this.xScale = this.d3.scale
      .linear()
      .domain([this.xAxisMinimum, this.xAxisMaximum])
      .range([0, this.plotWidth]);
    this.xAxis = this.d3.svg
      .axis()
      .orient("bottom")
      .ticks(4)
      .scale(this.xScale);

    // Add the Y axis
    this.yScale = this.d3.scale
      .ordinal()
      .rangeRoundBands([0, this.plotHeight], 0.3, 0)
      .domain(this.labels);
    this.yAxis = this.d3.svg
      .axis()
      .orient("left")
      .tickSize(0)
      .scale(this.yScale);

    // Show the x axis and translate to line up with the bottom left of the svg
    this.svg
      .append("g")
      .attr("transform", `translate(0, ${this.plotHeight})`)
      .call(this.xAxis)
      .select(".domain")
      .style({ stroke: "black", fill: "none", "stroke-width": "1px" });
  }

  labelXAxis(xAxisLabel: string) {
    // Label the x axis
    this.svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("x", this.plotWidth / 2 + this.margin.left)
      .attr("y", this.plotHeight + this.margin.top + 40)
      .text(xAxisLabel);
  }

  renderHorizontalLines(
    startVals: Array<number>,
    endVals: Array<number>,
    color: string
  ) {
    // Draw horizontal lines for each label on the graph. Boxplots will be overlayed onto these lines
    const startValXCoordinates = this.getXCoordinates(startVals);
    const endValXCoordinates = this.getXCoordinates(endVals);
    this.plots
      .append("line")
      .attr("x1", (label, i) => startValXCoordinates[i])
      .attr("x2", (label, i) => endValXCoordinates[i])
      .attr("y1", (label) => {
        return this.yScale(label) + this.yScale.rangeBand() / 2;
      })
      .attr("y2", (label) => {
        return this.yScale(label) + this.yScale.rangeBand() / 2;
      })
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-linejoin", "square")
      .style("stroke-width", 1);
  }

  // Draw a small vertical rectangle on each horizontal axis
  // (an important recurring element of the boxplot).
  renderVerticalTick(
    valuesToMark: Array<number>,
    colorHex: string,
    width: number
  ) {
    const tickXCoordinates = this.getXCoordinates(valuesToMark);
    this.plots
      .append("rect")
      .attr("x", (label, i) => tickXCoordinates[i] - width / 2)
      .attr("y", (label) => this.yScale(label))
      .attr("width", width)
      .attr("height", this.yScale.rangeBand())
      .attr("fill", colorHex);
  }

  renderPoints(valuesToMark: Array<number>, colorHex: string) {
    const pointXCoordinates = this.getXCoordinates(valuesToMark);
    this.plots
      .append("circle")
      .attr("cx", (label, i) => pointXCoordinates[i])
      .attr("cy", (label) => this.yScale(label) + this.yScale.rangeBand() / 2)
      .attr("r", 4)
      .attr("fill", colorHex)
      .append("svg:title")
      .text((label, i) => valuesToMark[i]);
  }

  renderBoxes(
    q1Values: Array<number>,
    q3Values: Array<number>,
    colorHex: string
  ) {
    const q1XCoordinates = this.getXCoordinates(q1Values);
    const q3XCoordinates = this.getXCoordinates(q3Values);
    const zippedArray = q1XCoordinates.map((q1Val, i) => {
      return [q1Val, q3XCoordinates[i]];
    });
    this.plots
      .append("rect")
      .attr("x", (label, i) => zippedArray[i][0])
      .attr("y", (label) => this.yScale(label))
      .attr("width", (label, i) => zippedArray[i][1] - zippedArray[i][0])
      .attr("height", this.yScale.rangeBand())
      .attr("fill", colorHex);
  }

  markOutliers(labels: Array<string>, outliers: Array<Array<number>>) {
    // Render the outliers for each boxplot with black points
    const tickHeight = 5;
    labels.forEach((label, i) => {
      const outlierCoordinates = this.getXCoordinates(outliers[i]);
      this.svg
        .selectAll(".stacked-boxplot-outlier-point")
        .data(outlierCoordinates)
        .enter()
        .append("rect")
        .attr("class", ".stacked-boxplot-outlier-point")
        .attr("x", (data) => data)
        .attr(
          "y",
          this.yScale(label) + this.yScale.rangeBand() / 2 - tickHeight / 2
        )
        .attr("width", 1)
        .attr("height", tickHeight)
        .attr("fill", "#111")
        .style("opacity", "0.5");
    });
  }

  private getXCoordinates(numberArray: Array<number>): Array<number> {
    // Return the x coordinate for the given values
    // If any of the values are beyond the range of the x axis, cap them at the max or min values
    const valuesWithinRange = numberArray.map((val) => {
      if (val > this.xAxisMaximum) {
        return this.xAxisMaximum;
      }
      if (val < this.xAxisMinimum) {
        return this.xAxisMinimum;
      }
      return val;
    });
    return valuesWithinRange.map((val) => this.xScale(val));
  }
}
