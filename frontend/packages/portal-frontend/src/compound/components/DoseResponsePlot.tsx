/* eslint-disable */
// adapted from @depmap/interactive/src/components/Plot.tsx

import * as React from "react";
import * as Plotly from "plotly.js";
import { PlotHTMLElement } from "@depmap/plotly-wrapper";

interface Bounds {
  width: number;
  height: number;
}

export interface Trace {
  x: Array<number>;
  y: Array<number>;
  customdata?: Array<string>;
  label?: Array<string>;
  replicate?: Array<string>;
  name: string;
  color?: number;
  type?: "curve" | null;
}

export class PlotResizer {
  resizeTimer: any;

  element: PlotHTMLElement | null;

  constructor(elementId: string) {
    this.resizeTimer = null;
    this.element = null;
  }

  setElement(element: PlotHTMLElement) {
    this.element = element;
  }

  getSize(): Bounds | null {
    if (!this.element) {
      return null;
    }
    const bounds = this.element.parentElement!.getBoundingClientRect();
    const newSize = { width: bounds.width - 20, height: bounds.height - 20 };
    return newSize;
  }

  resize() {
    const newSize = this.getSize();
    if (newSize == null) {
      return;
    }

    // if there's no change since last resize, bail
    const e = this.element;

    if (
      !e ||
      (newSize.width == e.layout.width && newSize.height == e.layout.height)
    ) {
      return;
    }

    Plotly.relayout(this.element!, newSize);
  }

  enqueueResize(delay: number) {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = setTimeout(() => this.resize(), delay);
  }

  registerOnResize() {
    $(window).resize(() => this.enqueueResize(250));
  }
}

interface PlotProps {
  plotId: string;
  xLabel: string;
  yLabel: string;
  traces: Array<Trace>;
  resizer: PlotResizer;
}

// default plotly colors
// todo:  ask andrew about colors
const colorPalette = [
  "#1f77b4", // muted blue
  "#ff7f0e", // safety orange
  "#2ca02c", // cooked asparagus green
  "#d62728", // brick red
  "#9467bd", // muted purple
  "#8c564b", // chestnut brown
  "#e377c2", // raspberry yogurt pink
  "#7f7f7f", // middle gray
  "#bcbd22", // curry yellow-green
  "#17becf", // blue-teal
];

export class DoseResponsePlot extends React.Component<PlotProps> {
  plotElement: PlotHTMLElement | null = null;

  constructor(props: any) {
    super(props);
  }

  // build trace elements common to both dose points and the curve
  buildTraceCommonalities(trace_data: Trace) {
    const marker: any = {
      size: 7,
      line: {
        smoothing: 1.3,
      },
    };

    const trace: any = {
      x: trace_data.x,
      y: trace_data.y,
      text: trace_data.label,
      marker,
      type: "scatter",
    };
    trace.name = trace_data.name;
    return trace;
  }

  buildScatterTrace(trace_data: Trace, color_index: number) {
    const trace = this.buildTraceCommonalities(trace_data);
    trace.marker.symbol =
      trace_data.label?.[0] == "true" ? "circle-open" : "circle";
    trace.customdata = trace_data.replicate;
    trace.mode = "markers";
    trace.hoverinfo = "x+y";
    trace.marker.color = colorPalette[color_index];
    return trace;
  }

  buildCurveTrace(trace_data: Trace, color_index: number) {
    const trace = this.buildTraceCommonalities(trace_data);
    trace.mode = "lines";
    trace.hoverinfo = "x+y";
    trace.marker.color = colorPalette[color_index];
    return trace;
  }

  buildPlot() {
    const data: any = [];
    this.props.traces.forEach((trace, index) => {
      if (trace.type == "curve") {
        const curve_trace = this.buildCurveTrace(trace, index);
        data.push(curve_trace);
      } else {
        const scatter_trace = this.buildScatterTrace(trace, index);
        data.push(scatter_trace);
      }
    });

    /**
     * Plotly legends can be selected and deselected to hide or show points in a trace
     * However, it is not clear from the UI that this can be done
     * Thus, add an invisible trace that shows this message under the other trace legends
     */
    if (data.length > 2 || data.length == 2) {
      data.push({
        x: [0],
        y: [0],
        opacity: "0",
        color: "#FFFFFF",
        name: "click these legends",
        visible: "legendonly",
      });
    }

    /**
     * Due to layout -> legend -> traceorder : reversed, things later in the array also appears at the top of the legends
     * They need to be later in the array because order determines which points are plotted/layered on top of each other
     */
    let bounds = this.props.resizer.getSize();
    if (!bounds) {
      bounds = { width: 100, height: 100 };
    }
    const layout: any = {
      // autosize: true, // autosizes width but not height
      width: bounds.width,
      height: bounds.height,
      hovermode: "closest",
      legend: {
        traceorder: "reversed",
      },
      margin: {
        l: 50,
        r: 50,
        b: 50,
        t: 10,
        // 	pad: 4
      },
      xaxis: {
        title: this.props.xLabel,
        type: "log",
      },
      yaxis: {
        title: this.props.yLabel,
        rangemode: "tozero",
      },
    };
    Plotly.newPlot(this.props.plotId, data, layout);
  }

  componentDidMount() {
    // console.log("Plot componentDidMount")
    this.buildPlot();
    this.props.resizer.setElement(this.plotElement!);
    this.props.resizer.registerOnResize();
    this.props.resizer.resize();
    // just in case the line above didn't work and we don't know why
    this.props.resizer.enqueueResize(500);
  }

  componentDidUpdate() {
    this.buildPlot();
  }

  render() {
    return (
      <div
        ref={(element: HTMLElement | null) =>
          (this.plotElement = element as PlotHTMLElement)
        }
        id={this.props.plotId}
      />
    );
  }
}
