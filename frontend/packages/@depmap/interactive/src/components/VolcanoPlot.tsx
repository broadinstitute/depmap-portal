/* eslint-disable */
// converts y axis data to log10
import * as React from "react";
import { PlotlyWrapper, PlotlyCallbacks } from "@depmap/plotly-wrapper";
import {
  getHighlightArrayOrDefault,
  getHighlightLineColor,
  importanceNumToColor,
  getHighlightOpacity,
  getHighlightLineWidth,
  getHighlightSymbol,
} from "@depmap/utils";

type PlotlyType = typeof import("plotly.js");

export interface VolcanoTrace {
  x: Array<number>;
  y: Array<number>;
  label: Array<string>;
  linregress_y: Array<number>;
  name: string;
  color?: number;
  size?: number;
}

export interface Bounds {
  width: number;
  height: number;
}

interface VolcanoPlotProps {
  Plotly: PlotlyType;
  xLabel: string;
  yLabel: string;
  traces: Array<VolcanoTrace>;
  showAxesOnSameScale: boolean;
  cellLinesToHighlight: ReadonlySet<string>;
  onPointClick: (point: Plotly.PlotDatum) => void;
  downloadData: any[];
  additionalToolbarWidgets?: Array<JSX.Element>;
  additionalPlotlyCallbacks?: PlotlyCallbacks;
}

interface VolcanoPlotState {
  cellLinesToHighlight: Set<string>;
}

export class VolcanoPlot extends React.Component<
  VolcanoPlotProps,
  VolcanoPlotState
> {
  plotElement?: HTMLElement;

  constructor(props: any) {
    super(props);
  }

  buildScatterTrace(trace_data: VolcanoTrace) {
    const { cellLinesToHighlight } = this.props;

    const marker: Partial<Plotly.ScatterMarker> = {
      size: trace_data.size ? trace_data.size : 7,
      opacity: getHighlightArrayOrDefault(
        trace_data.label,
        new Set(cellLinesToHighlight),
        getHighlightOpacity,
        1
      ) as number,
      line: {
        width: getHighlightArrayOrDefault(
          trace_data.label,
          new Set(cellLinesToHighlight),
          getHighlightLineWidth,
          0
        ) as number,
        color: getHighlightLineColor(),
      },
      symbol: getHighlightArrayOrDefault(
        trace_data.label,
        new Set(cellLinesToHighlight),
        getHighlightSymbol,
        "circle"
      ),
    };
    marker.color = importanceNumToColor(trace_data.color || 0);
    // Else, default to plotly colors so we don't have to enumerate a color for every primary site

    const trace: Partial<Plotly.PlotData> = {
      x: trace_data.x,
      text: trace_data.label.map((label: string) => `<b>${label}</b>`),
      marker,
      hoverinfo: "x+y+text",
      mode: "markers",
      type: "scatter",
    };

    // We make customdata an object with any properties, which is different
    // defined Plotly types but works for more flexibly passing richer data
    (trace as any).customdata = trace_data.label.map((label: string) => {
      return { selectToLabelAnnotationKey: label };
    }); // original label, for point click to match against

    if (trace_data.name == "") {
      trace.showlegend = false;
    } else {
      trace.showlegend = true;
      trace.name = trace_data.name;
    }

    trace.y = trace_data.y.map((x: number) => {
      return -Math.log10(x); // log transforms the y axis
    });
    return trace;
  }

  formatPlotlyParams() {
    /**
     * https://plot.ly/javascript/line-charts/#colored-and-styled-scatter-plot
     * https://plot.ly/python/text-and-annotations/
     * https://plot.ly/python/linear-fits/
     *
     * Confidence intervals
     * https://plot.ly/javascript/reference/#scatter-fill
     * Just need the endpoints of the trace
     * So for confidence intervals, just need the start and end points of the line
     *
     * Traces later in the array are layered on top of things before
     */

    const data: any = [];
    for (const trace of this.props.traces) {
      const scatter_trace = this.buildScatterTrace(trace);
      data.push(scatter_trace);
    }

    const annotations: Array<Partial<Plotly.Annotations>> = [];
    for (const trace of data) {
      for (let i = 0; i < trace.x.length; i++) {
        if (Number.isFinite(trace.x[i]) && Number.isFinite(trace.y[i])) {
          annotations.push({
            selectToLabelAnnotationKey:
              trace.customdata[i].selectToLabelAnnotationKey,
            text: trace.customdata[i].selectToLabelAnnotationKey,
            x: trace.x[i],
            y: trace.y[i],
            xref: "x",
            yref: "y",
            arrowhead: 0,
            standoff: 4, // unclear exact difference between standoff vs startstandoff
            visible: false, // setting this to true causes performance issues from attempting to render them all, even if the PlotlyWrapper component will later set everything to false
          } as Partial<Plotly.Annotations>);
        }
      }
    }

    /**
     * Due to layout -> legend -> traceorder : reversed, things later in the array also appears at the top of the legends
     * They need to be later in the array because order determines which points are plotted/layered on top of each other
     */
    const layout: Partial<Plotly.Layout> = {
      autosize: true, // autosizes width but not height
      // width: bounds.width,
      height: 280,
      hovermode: "closest",
      legend: {
        xanchor: "left",
        yanchor: "bottom",
        x: -0.2,
        y: 1.1,
        bgcolor: "#E2E2E2",
      },
      margin: {
        l: 10,
        r: 20,
        t: 30,
        b: 40,
      },
      xaxis: {
        title: this.props.xLabel,
      },
      yaxis: {
        title: `-log10(${this.props.yLabel})`,
      },
      annotations,
    };

    if (this.props.showAxesOnSameScale) {
      (layout.yaxis as any).scaleanchor = "x";
    }
    return {
      data,
      layout,
      config: { responsive: true },
    };
  }

  render() {
    return (
      <PlotlyWrapper
        Plotly={this.props.Plotly}
        ref={(element: HTMLElement) => (this.plotElement = element)}
        plotlyParams={this.formatPlotlyParams()}
        onPointClick={this.props.onPointClick}
        downloadIconWidgetProps={{
          downloadFilename: "volcano",
          downloadDataArray: this.props.downloadData,
        }}
        selectToLabelWidgetProps={{
          useSelectToLabelWidget: true,
          dropup: true,
        }}
        idPrefixForUniqueness="volcano-plot"
        additionalPlotlyCallbacks={this.props.additionalPlotlyCallbacks}
        additionalToolbarWidgets={this.props.additionalToolbarWidgets}
      />
    );
  }
}
