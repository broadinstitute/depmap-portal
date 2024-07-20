/* eslint-disable */
import * as React from "react";
import { errorHandler } from "@depmap/globals";
import { Trace } from "../models/interactive";
import { PlotHTMLElement } from "@depmap/plotly-wrapper";
import { isNullOrUndefined } from "util";
import {
  assert,
  getDefaultColor,
  getHighlightArrayOrDefault,
  getHighlightLineColor,
  getHighlightOpacity,
  getHighlightLineWidth,
  getHighlightSymbol,
  getCategoryToColor,
} from "@depmap/utils";
import isEqual from "lodash.isequal";
import flatMap from "lodash.flatmap";
import seedrandom from "seedrandom";

type PlotlyType = typeof import("plotly.js");

interface ResizeListener {
  parentElement: HTMLElement;
  resizeCallback: (bounds: Bounds) => void;
}

export interface Bounds {
  width: number;
  height: number;
}

interface PlotProps {
  Plotly: PlotlyType;
  xLabel: string;
  yLabel: string;
  traces: Array<Trace>;
  showRegressionLine: boolean;
  showAxesOnSameScale: boolean;
  resizer: PlotResizer;
  cellLinesToHighlight: Set<string>;
  labelHighlightedCellLines: boolean;
  onSelect?: (data: Plotly.PlotDatum[]) => void;
}

interface PlotState {
  cellLinesToHighlight: Set<string>;
}

type PlotMode = "scatter" | "violin";

export class Plot extends React.Component<PlotProps, PlotState> {
  plotElement: HTMLElement | null = null;

  buildCount: number;

  resizeTimer?: ReturnType<typeof setTimeout>;

  constructor(props: PlotProps) {
    super(props);
    this.buildCount = 0;
  }

  componentDidMount() {
    this.buildPlot();
    this.props.resizer.addPlotlyElement(
      "main-plot",
      this.plotElement as HTMLElement,
      this.props.Plotly
    );
    this.props.resizer.registerOnResize();
    this.props.resizer.resize();
    // just in case the line above didn't work and we don't know why
    this.props.resizer.enqueueResize(500);
  }

  componentWillUnmount() {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
  }

  shouldComponentUpdate(nextProps: PlotProps) {
    return (
      this.props.xLabel != nextProps.xLabel ||
      this.props.yLabel != nextProps.yLabel ||
      this.props.traces != nextProps.traces ||
      this.props.showRegressionLine != nextProps.showRegressionLine ||
      this.props.showAxesOnSameScale != nextProps.showAxesOnSameScale ||
      this.props.labelHighlightedCellLines !=
        nextProps.labelHighlightedCellLines ||
      !isEqual(this.props.cellLinesToHighlight, nextProps.cellLinesToHighlight)
    );
  }

  componentDidUpdate() {
    // conditioned on changes defined in shouldComponentUpdate
    this.buildPlot();
  }

  buildTraceCommonalities(trace_data: Trace) {
    /**
     * Basically for the common things between the scatter and linear regression
     */
    let markerColor: string;
    if (!trace_data.color) {
      // is null
      markerColor = getDefaultColor();
    } else if (typeof trace_data.color === "string") {
      // if a hex color is specified
      assert(trace_data.color.startsWith("#"));
      markerColor = trace_data.color;
    } else {
      // cycle plotly colors so we don't have to enumerate a color for every lineage
      // we explicitly assign the cycling plotly colors, to make sure that the violin background and the violin points have the same color
      markerColor = getCategoryToColor(this.props.Plotly, trace_data.color);
    }

    const trace: any = {
      x: trace_data.x,
      text: (trace_data.cell_line_information || []).map(
        this.formatHoverInfoText
      ),
      marker: {
        color: markerColor,
      },
    };

    // unclear when name would be absent? typing implies it is always present
    if (!isNullOrUndefined(trace_data.name)) {
      trace.name = trace_data.name;
    }
    return trace;
  }

  formatHoverInfoText(cell_line: {
    cell_line_display_name: string | number;
    primary_disease: string | number;
  }) {
    return [
      `<b>${cell_line.cell_line_display_name}</b>`,
      `Disease: ${cell_line.primary_disease}`,
    ].join("<br>");
  }

  getPlotMode = (traces: Array<Trace>) => {
    const isScatterTrace = traces.length == 0 || "y" in traces[0];
    if (isScatterTrace) {
      assert(traces.every((trace: Trace) => "y" in trace));
    } else {
      assert(traces.every((trace: Trace) => !("y" in trace)));
    }
    return isScatterTrace ? "scatter" : ("violin" as PlotMode);
  };

  isSinglePoint = (point: { fullData: Plotly.PlotData }) => {
    /*
        Returns whether the point is the type that is a single dot
          True for
            - a point on a scatter trace
          False for
            - invisible point of a line in a scatter trace (i.e. linear regression line)
            - a non-scatter trace (e.g. violin)
        
        Would be nice to improve the type annotation of the point param to use plotly types,
          and specifically link to the type of the 'data' variable that is passed by plotly into the callback
        Plotly has a PlotMouseEvent type, however does not include the property fullData
        
        The point param should be
          given that `data` is the object passed to plotly onclick events
          let point = data.points[0];
      */
    return point.fullData.type == "scatter" && point.fullData.mode != "lines";
  };

  buildScatterTrace(trace_data: Trace, showYInHover = true) {
    const trace = this.buildTraceCommonalities(trace_data);

    // add things to marker that are needed for scatter plot
    const { cellLinesToHighlight } = this.props;
    const traceDataToMatch = trace_data.depmap_id;
    trace.marker = {
      ...trace.marker,
      // only scatter has different opacity for different points, different symbol etc
      opacity: getHighlightArrayOrDefault(
        traceDataToMatch,
        cellLinesToHighlight,
        getHighlightOpacity,
        1
      ),
      size: 7,
      line: {
        width: getHighlightArrayOrDefault(
          traceDataToMatch,
          cellLinesToHighlight,
          getHighlightLineWidth,
          0
        ),
        color: getHighlightLineColor(),
      },
      symbol: getHighlightArrayOrDefault(
        traceDataToMatch,
        cellLinesToHighlight,
        getHighlightSymbol,
        "circle"
      ),
    };

    trace.y = trace_data.y;
    trace.customdata = trace_data.cell_line_information;
    trace.mode = "markers";
    trace.type = "scatter";
    trace.hoverinfo = showYInHover ? "text+name+x+y" : "text+name+x";
    return trace;
  }

  buildRegressionTrace(trace_data: Trace) {
    const trace = this.buildTraceCommonalities(trace_data);
    trace.y = trace_data.linregress_y;
    trace.mode = "lines";
    trace.hoverinfo = "none";
    return trace;
  }

  buildViolinTrace(trace_data: Trace, yPos: number) {
    const trace = this.buildTraceCommonalities(trace_data);
    trace.y0 = yPos; // we ignore trace_data.y, and use only the index to position. trace_data.y is used for the position of individual overlaid scatter points, and jitters around yPos
    trace.customdata = trace_data.cell_line_information;
    trace.type = "violin";
    trace.hoverinfo = "skip"; // use skip, because none will still fire hover events

    // we don't use the violin plot built in points option
    // instead, we implement the overlaid points by plotting a scatter trace at the same position
    // this gives us more control and enables things like different marker symbols and annotations
    trace.points = false;

    trace.line = { width: 0 };
    return trace;
  }

  getViolinY(traceIndex: number, x: Array<number>) {
    /*
      generate a y dimension, with a random jitter        
      
      Deterministic
        Just for UI consistency, to make things easier for users to locate their cell line
        Or if they plot the same thing twice (e.g. select color, then clear it) and question why the plot looks different

      Magnitude of offset from the center
        Since y positions are array indices, they are in increments of 1, which also gives us the unit distance between each violin plot on the y axis
        It should thus be reasonable to jitter -0.25 and +0.25 around the y axis, and have a decent layout with multiple traces. In reality, divide by 3 looks better
    */
    const deterministicRandom = seedrandom("fixedSeed");
    const y = x.map(() => traceIndex + (deterministicRandom() - 0.5) / 3);
    return y;
  }

  formatAnnotations(plotMode: PlotMode, trace_data: Trace) {
    /*
      adds an annotation to each scatter point, may or may not be initially visible
      toggling visibility is later added to the plotly_click event
      :trace_data: we build based on the objects that come in as this.props.trace, not the trace formatted for plotly
     */

    // based on this example https://plotly.com/javascript/text-and-annotations/#multiple-annotations
    // full reference https://plotly.com/javascript/reference/#layout-annotations
    const annotations: Array<any> = [];
    for (let i = 0; i < trace_data.x.length; i++) {
      const annotation: any = {
        depmapId: trace_data.depmap_id[i], // for identification when relayout
        x: trace_data.x[i],
        xref: "x",
        yref: "y",
        text: trace_data.cell_line_information
          ? trace_data.cell_line_information[i].cell_line_display_name
          : "",
        arrowhead: 0,
        standoff: 4,
      };

      // for violin, we previously added the jittered y
      if (trace_data.y) {
        annotation.y = trace_data.y[i];
      }
      if (
        this.props.labelHighlightedCellLines && // should label
        (this.props.cellLinesToHighlight.size == 0 || // no group is specified
          this.props.cellLinesToHighlight.has(trace_data.depmap_id[i])) // a group is specified, and this cell line matches
      ) {
        annotation.visible = true;
      } else {
        annotation.visible = false;
      }

      annotations.push(annotation);
    }
    return annotations;
  }

  buildPlot() {
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
    this.buildCount += 1;
    const data: any = [];
    let yTickOverrides:
      | {
          tickmode: "array";
          tickvals: number[];
          ticktext: string[];
        }
      | undefined; // to override the default plotly y axis ticks

    const plotMode = this.getPlotMode(this.props.traces);

    // all future downstream thigns /must/ use this variable, instead of directly using this.props.traces. this ensures consistency of the generated violin y jitter
    // downstream things would be a good candidate to pull out, to ensure that they are stateless
    let { traces } = this.props;
    if (plotMode == "violin") {
      // add a jitter for overlaid scatter points. ignored by buildViolinTrace, used for buildScatterTrace and the annotations
      // here, we create a new trace object
      // mutating the trace object on props will cause issues when other aspects of the plot are redrawn and re-pull from this.props.traces. e.g. when selecting a different group
      traces = traces.map((trace: Trace, index: number) => {
        const y = this.getViolinY(index, trace.x);
        return { y, ...trace };
      });
    }

    if (plotMode == "scatter") {
      for (const trace of traces) {
        const points_trace = this.buildScatterTrace(trace);
        data.push(points_trace);

        if (this.props.showRegressionLine) {
          const regression_trace = this.buildRegressionTrace(trace);
          data.push(regression_trace);
        }
      }
    } else {
      // 1D violin plot mode
      // we need to override y axis ticks, so that it plots the trace name as categories instead of a numerical y
      yTickOverrides = { tickmode: "array", tickvals: [], ticktext: [] };

      // yPos is the array index, which is used to assign the y axis position of each trace, to align the violin distribution and scatter point traces
      for (const [yPos, trace] of traces.entries()) {
        const violin_trace = this.buildViolinTrace(trace, yPos);
        // specify legendgroup so that the violin and overlaid scatter are controlled together
        violin_trace.legendgroup = trace.name;
        data.push(violin_trace);

        const points_trace = this.buildScatterTrace(trace, false);
        // specify legendgroup so that the violin and overlaid scatter are controlled together
        // and hide the usual scatter legend
        points_trace.legendgroup = trace.name;
        points_trace.showlegend = false;
        data.push(points_trace);

        // add to y axis override configuration
        yTickOverrides.tickvals.push(yPos);
        yTickOverrides.ticktext.push(trace.name);
      }
    }

    // Hide/Show the legend on the right, and increase L margin, to prevent the y-axis labels from being cut off in violin plot mode
    const plotMargin: any =
      plotMode === "scatter"
        ? {
            l: 70,
            r: 50,
            b: 50,
            t: 10,
          }
        : {
            l: 150,
            r: 10,
            b: 50,
            t: 10,
          };

    const showLegend = plotMode === "scatter";

    /**
     * Plotly legends can be selected and deselected to hide or show points in a trace
     * However, it is not clear from the UI that this can be done
     * Thus, add an invisible trace that shows this message under the other trace legends
     */
    if (
      plotMode == "scatter" &&
      (data.length > 2 || (data.length == 2 && !this.props.showRegressionLine))
    ) {
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
    let bounds = this.props.resizer.getSize("main-plot");
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
      showlegend: showLegend,
      margin: plotMargin,
      xaxis: {
        title: this.props.xLabel,
      },
      yaxis: {
        automargin: true,
        title: this.props.yLabel,
        ...yTickOverrides,
      },
      // Array.flatMap is es 2019, which requires typescript upgrade + compatibability concerns
      annotations: flatMap(
        traces.map((trace: Trace) => this.formatAnnotations(plotMode, trace))
      ),
    };
    if (this.props.showAxesOnSameScale) {
      layout.yaxis.scaleanchor = "x";
    }

    // allow people to drag the annotation label around
    const configuration = { edits: { annotationTail: true } };

    this.props.Plotly.newPlot("plot", data, layout, configuration);

    // This event listener needs to be re-attached every time the plot is built, not just on the first componentDidMount
    const plotDiv = document.getElementById("plot") as PlotHTMLElement;
    const nsewdrag = plotDiv.querySelector(".nsewdrag") as PlotHTMLElement;

    plotDiv.on("plotly_selected", (data: Plotly.PlotSelectionEvent) => {
      // data will be undefined if using the select tool to click (without dragging)
      if (data && this.props.onSelect) {
        this.props.onSelect(data.points);
      }
    });

    plotDiv.on("plotly_click", (data: any) => {
      // this is a manual implementation of toggling annotations, based on
      // https://plotly.com/javascript/text-and-annotations/#styling-and-formatting-annotations
      // and with reference to https://plotly.com/javascript/plotlyjs-function-reference/#plotlyrelayout

      // there is a built-in option to toggle annotations, https://plotly.com/javascript/reference/#layout-annotations-items-annotation-clicktoshow
      // however, the cursor for this is bugged https://github.com/plotly/plotly.js/issues/4788
      // for our manual implementation, we apply our own cursor-pointer on hover
      if (data.points.length === 1) {
        const point = data.points[0];
        if (this.isSinglePoint(point)) {
          if (point.customdata == undefined) {
            errorHandler.report(
              `customdata is undefined on point at index ${
                point.pointIndex
              }, data ${JSON.stringify(point.data)}. xLabel ${
                this.props.xLabel
              }, yLabel ${this.props.yLabel}, traces ${JSON.stringify(
                this.props.traces
              )}`
            );
          } else {
            plotDiv.layout.annotations.forEach(
              (annotation: any, index: number) => {
                if (point.customdata.depmap_id == annotation.depmapId) {
                  const update: { [key: string]: boolean } = {}; // key is a variable, and so this can't be one line
                  // this syntax works as exampled in https://plotly.com/javascript/plotlyjs-function-reference/#plotlyrelayout
                  update[`annotations[${index}].visible`] = !annotation.visible;
                  this.props.Plotly.relayout(plotDiv, update);
                }
              }
            );
          }
        }
      }
    });

    plotDiv.on("plotly_hover", (data: any) => {
      if (data.points.length === 1) {
        const point = data.points[0];
        if (this.isSinglePoint(point)) {
          nsewdrag.style.cursor = "pointer";
        }
      }
    });

    plotDiv.on("plotly_unhover", (data: any) => {
      if (data.points.length === 1) {
        const point = data.points[0];
        if (this.isSinglePoint(point)) {
          nsewdrag.style.cursor = "";
        }
      }
    });
  }

  render() {
    return (
      <div
        ref={(element) => (this.plotElement = element)}
        id="plot"
        data-build-count={this.buildCount}
      />
    );
  }
}

export class PlotResizer {
  resizeTimer: any;

  listeners: { [index: string]: ResizeListener };

  constructor() {
    this.resizeTimer = null;
    this.listeners = {};
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.onResize);
  }

  addListener(
    name: string,
    parentElement: HTMLElement,
    callback: (bounds: Bounds) => void
  ) {
    this.listeners[name] = {
      parentElement,
      resizeCallback: callback,
    };
  }

  removeListener(name: string): any {
    delete this.listeners[name];
  }

  addPlotlyElement(name: string, element: HTMLElement, Plotly: PlotlyType) {
    const e = element as any;

    const resizeCallback = (newSize: Bounds) => {
      // if there's no change since last resize, bail
      if (
        newSize.width == e.layout.width &&
        newSize.height == e.layout.height
      ) {
        return;
      }

      Plotly.relayout(e, newSize);
    };

    if (element.parentElement) {
      this.addListener(name, element.parentElement, resizeCallback);
    }
  }

  getSize(name: string): Bounds | null {
    const listener = this.listeners[name];
    if (!listener) {
      return null;
    }
    const bounds = listener.parentElement.getBoundingClientRect();
    const newSize = { width: bounds.width, height: bounds.height };
    return newSize;
  }

  // resize all elements
  resize() {
    Object.keys(this.listeners).forEach((name) => {
      const newSize = this.getSize(name);
      if (newSize == null) {
        return;
      }

      this.listeners[name].resizeCallback(newSize);
    });
  }

  enqueueResize(delay: number) {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = setTimeout(() => this.resize(), delay);
  }

  registerOnResize = () => {
    window.addEventListener("resize", this.onResize);
  };

  onResize = () => {
    this.enqueueResize(250);
  };
}
