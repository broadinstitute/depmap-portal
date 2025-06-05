/* eslint-disable */
import React from "react";
import Plotly from "plotly.js";
import { LegacyPortalApiResponse } from "@depmap/api";
import { PlotHTMLElement } from "@depmap/plotly-wrapper";
import { assert, getDefaultColor, getHighlightLineColor } from "@depmap/utils";

import {
  getEntitySummaryStripHighlightData,
  HoverInfo,
} from "src/entity/utilities/colorAndHighlights";

type EntitySummaryResponse = LegacyPortalApiResponse["getEntitySummary"];

type Props = {
  datasetEntitySummary: EntitySummaryResponse;
  elementId: string; // should not include #
  attachEventListenerForPlotShown: (handlePlotShown: () => void) => void;
  removeEventListenerForPlotShown: () => void;
  showSublineage: boolean;
  cellLinesToHighlight: Set<string>;
};

const allCellLinesSize = 2;
const allCellLinesSpacing = 2;
const plotHeight = 40;

function isStripPoint(point: Plotly.PlotDatum) {
  return point.data.type == "scatter";
}

class SublineagePlot extends React.Component<Props> {
  plotElement?: PlotHTMLElement;

  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    // fixme: remove when characterization plots switch to the full EntitySummary react component
    // this is used for the characterization plots, where SublineagePlot is directly initialized after non-react javascript retrieves the full data
    this.buildPlot();

    // listen for changes in list membership
    window.addEventListener("celllinelistsupdated", this.buildPlot);

    // when tab is shown, resize plot and apply hover info
    this.props.attachEventListenerForPlotShown(() => {
      // the plot uses responsive true, what resizes by listening to the resize event
      // https://github.com/plotly/plotly.js/blob/af8f15f5d15e6c42be380aabcac589bf3bf976cd/src/plot_api/plot_api.js#L189

      // in theory, this code indicates that we can call
      //   Plotly.Plots.resize(this.props.elementId);
      // in order to resize the element. it is a promise, so we can even put hover info position in a .then()
      // however, in practice, this works for the dependency tab entity summary, but not for the characterization tab

      // emitting the resize event works, so we do that
      window.dispatchEvent(new Event("resize"));
      this.applyHoverInfo();

      // this has the bug that hoverinfo is not repositioned when plot is resized
      // in theory, we could listen for the resize event then hover, but that doesn't seem to work
    });
  }

  componentWillUnmount() {
    window.removeEventListener("celllinelistsupdated", this.buildPlot);
    this.props.removeEventListenerForPlotShown();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.showSublineage != prevProps.showSublineage) {
      this.buildPlot();
    }
  }

  buildPlot = () => {
    if (!this.plotElement) {
      throw new Error("Expected this.plotElement to be defined");
    }

    const [traces, numPlotsPerSubPlot] = this.buildTraces();
    const layout = this.buildLayout(traces.length, numPlotsPerSubPlot);
    Plotly.newPlot(this.plotElement, traces, layout, { responsive: true });

    // fixme: take this out when characterization moves to the full entitySummary
    if (this.handlePointClick) {
      this.plotElement.on("plotly_click", (data: Plotly.PlotMouseEvent) =>
        this.handlePointClick(data)
      );

      this.plotElement.on("plotly_hover", (data: any) => {
        const dragLayer = this.plotElement!.querySelector(
          `.${data.points[0].yaxis._mainSubplot}>.nsewdrag`
        ) as HTMLElement;

        dragLayer.style.cursor = "pointer";
      });

      this.plotElement.on("plotly_unhover", (data: any) => {
        const dragLayer = this.plotElement!.querySelector(
          `.${data.points[0].yaxis._mainSubplot}>.nsewdrag`
        ) as HTMLElement;

        dragLayer.style.cursor = "";
      });
    }

    this.applyHoverInfo();
  };

  buildTraces = (): [Array<Partial<Plotly.PlotData>>, Map<number, number>] => {
    const { datasetEntitySummary, showSublineage } = this.props;

    const allDataHistogramPlotTrace: Partial<Plotly.PlotData> = {
      type: "histogram",
      x: datasetEntitySummary.strip.traces
        .filter((trace) => trace.lineage_level == 1)
        .reduce((prev: Array<number>, cur) => prev.concat(cur.data.value), []),
      marker: {
        color: getDefaultColor(datasetEntitySummary.entity_type),
      },
    };

    const nullSize = Math.min(
      ...datasetEntitySummary.strip.traces.reduce(
        (prev: Array<number>, cur) =>
          prev.concat(cur.data.size.filter(Boolean)),
        []
      )
    );

    const numPlotsPerSubPlot = new Map<number, number>();
    numPlotsPerSubPlot.set(1, 2); // height of the allData histogram in traces

    const boxPlotTraces = new Array<Partial<Plotly.PlotData>>();
    const scatterPlotTraces = new Array<Partial<Plotly.ScatterData>>();

    let subPlotNumber = 1;

    // we don't modify the datasetEntitySummary object, since that will mutate the props object. we just filter it
    const rawTraces = showSublineage
      ? datasetEntitySummary.strip.traces
      : datasetEntitySummary.strip.traces.filter(
          (trace) => trace.lineage_level == 1
        );

    const formatTextWrap = (text: string, maxLineLength: number) => {
      const words = text.replace(/[\r\n]+/g, " ").split(" ");
      let lineLength = 0;

      return words.reduce((result, word) => {
        if (lineLength + word.length >= maxLineLength) {
          lineLength = word.length;
          return result + `<br>${word}`; // don't add spaces upfront
        } else {
          lineLength += word.length + (result ? 1 : 0);
          return result ? result + ` ${word}` : `${word}`; // add space only when needed
        }
      }, "");
    };

    rawTraces.forEach((rawTrace) => {
      const label =
        rawTrace.lineage_level == 1
          ? `<b>${rawTrace.category}</b> (${rawTrace.num_lines})`
          : formatTextWrap(`${rawTrace.category} (${rawTrace.num_lines})`, 40);

      if (rawTrace.lineage_level == 1) {
        subPlotNumber += 1;
        numPlotsPerSubPlot.set(subPlotNumber, 0);
      }
      numPlotsPerSubPlot.set(
        subPlotNumber,
        (numPlotsPerSubPlot.get(subPlotNumber) || 0) + 1
      );

      const baseTrace: Partial<Plotly.PlotData> = {
        x: rawTrace.data.value,
        y: Array(rawTrace.data.value.length).fill(label),
        yaxis: `y${subPlotNumber}`,
        opacity: rawTrace.lineage_level == 1 ? 1 : 0.5,
        text: label,
      };

      boxPlotTraces.push({
        ...baseTrace,
        type: "box",
        orientation: "h",
        boxpoints: false,
        width: 0.7,
        fillcolor: "white",
        line: {
          color: "black",
        },
        hoverinfo: "skip",
      });

      const stripHighlightData = getEntitySummaryStripHighlightData(
        rawTrace.data.depmap_id,
        this.props.cellLinesToHighlight,
        rawTrace.data.mutation_num,
        rawTrace.data.size,
        datasetEntitySummary.entity_type
      );

      scatterPlotTraces.push({
        ...baseTrace,
        // @ts-expect-error Plotly type definitions are wrong?
        customdata: rawTrace.data.cell_line_information,
        size: rawTrace.data.size,
        depmap_id: rawTrace.data.depmap_id,
        mutation_num: rawTrace.data.mutation_num,

        type: "scatter",
        mode: "markers",
        text: rawTrace.data.label,
        hoverinfo: "text",
        marker: {
          // size is diameter in pixels
          size: rawTrace.data.size.map((s) => (s == null ? nullSize : s)),
          color: stripHighlightData.color,
          opacity: stripHighlightData.opacity,
          line: {
            width: stripHighlightData.line,
            color: getHighlightLineColor(),
          },
          symbol: stripHighlightData.symbol,
        },
      });
    });

    return [
      [allDataHistogramPlotTrace]
        .concat(scatterPlotTraces)
        .concat(boxPlotTraces)
        .reverse(),

      numPlotsPerSubPlot,
    ];
  };

  buildPlotShapes(
    yIntervals: Array<Array<number>>
  ): Array<Partial<Plotly.Shape>> {
    const figure = this.props.datasetEntitySummary;
    const shapes: Array<Partial<Plotly.Shape>> = [];
    for (let j = 0; j < yIntervals.length; j++) {
      let yPos = yIntervals[j][1] * 1.01;
      if (j == 0) {
        yPos -= 0.02;
      }

      if (Object.prototype.hasOwnProperty.call(figure, "line")) {
        const solidRedLine: Partial<Plotly.Shape> = {
          type: "line",
          xref: "x",
          yref: "paper",
          x0: figure.line,
          x1: figure.line,
          y0: yIntervals[j][0],
          y1: yIntervals[j][1],
          opacity: -1,
          line: {
            color: "red",
            width: 1,
          }, // layer: 'below' does not work
        };
        shapes.push(solidRedLine);
      }

      const dottedZeroLine: Partial<Plotly.Shape> = {
        type: "line",
        xref: "x",
        yref: "paper",
        x0: 0,
        x1: 0,
        y0: yIntervals[j][0],
        y1: yIntervals[j][1],
        opacity: 0.1,
        line: {
          dash: "dot",
        }, // layer: 'below' does not work
      };
      shapes.push(dottedZeroLine);
    }
    return shapes;
  }

  buildLayout(
    numTraces: number,
    numPlotsPerSubPlot: Map<number, number>
  ): Partial<Plotly.Layout> {
    const dataSize = numTraces / 2;
    const numSubPlots = numPlotsPerSubPlot.size;
    const layout: Partial<Plotly.Layout> = {
      height:
        plotHeight *
        (dataSize + numSubPlots + allCellLinesSize + allCellLinesSpacing),
      margin: {
        l: 230,
        t: 20,
        r: 30,
      },
      hovermode: "closest", // otherwise, all points with the same/similar x will hover
      xaxis: {
        range: this.props.datasetEntitySummary.x_range,
        zeroline: false,
        title: this.props.datasetEntitySummary.x_label,
      },
      showlegend: false,
    };

    // plotly wants you to specify the position of subplots as a ratio position of the y axis
    let yCounter = 0;
    const yIncrement =
      1 / (dataSize + numSubPlots - 1 + allCellLinesSize + allCellLinesSpacing); // num traces plus num subplots. minus 1 for not needing spacing at the bottom. plus 3 for size of all cell lines, plus two for two additional yIncrement spacings after all cell lines
    const yIntervals = [];

    // compute the y axis domain ratio for each subplot
    for (let i = 0; i < numSubPlots; i++) {
      const yEnd = yCounter + (numPlotsPerSubPlot.get(i + 1) || 1) * yIncrement;
      const domain = [1 - yEnd, 1 - yCounter];

      (layout as any)[i == 0 ? "yaxis" : `yaxis${i + 1}`] = {
        zeroline: false,
        automargin: true,
        showgrid: true,
        domain,
      };
      yIntervals.push(domain);
      yCounter = yEnd + yIncrement;

      if (i == 0) {
        // add the post-histogram spacing
        yCounter += yIncrement * allCellLinesSpacing;
      }
    }
    layout.shapes = this.buildPlotShapes(yIntervals);

    return layout;
  }

  handlePointClick = (data: Plotly.PlotMouseEvent) => {
    const urlRoot = this.props.datasetEntitySummary.strip.url_root;

    if (isStripPoint(data.points[0])) {
      // any on click should only fire if is scatter
      const point = data.points[0];
      // what does data.points.length === 1 check? does it check that it is not the historgram?
      if (data.points.length === 1) {
        // @ts-expect-error customdata
        window.open(`${urlRoot}${point.customdata.depmap_id}`, "_blank");
      }
    }
  };

  applyHoverInfo() {
    const { elementId, datasetEntitySummary } = this.props;
    if (datasetEntitySummary.description != "") {
      assert(datasetEntitySummary.x_label.includes("Gene Effect"));
      let algorithm;

      if (datasetEntitySummary.x_label == "Gene Effect (Chronos)") {
        algorithm = "Chronos";
      } else if (datasetEntitySummary.x_label == "Gene Effect (CERES)") {
        algorithm = "CERES";
      } else if (datasetEntitySummary.x_label == "Gene Effect (DEMETER2)") {
        algorithm = "DEMETER2";
      } else {
        debugger;
        assert(
          false,
          `Unknown units, expected Gene Effect (Chronos/CERES), got ${datasetEntitySummary.x_label}`
        );
      }

      const hoverText = `The ${algorithm} dependency score is based on data from a cell depletion assay. A lower ${algorithm} score indicates a higher likelihood that the gene of interest is essential in a given cell line.<br>A score of 0 indicates a gene is not essential; correspondingly -1 is comparable to the median of all pan-essential genes (<span style='color: red;'>red line</span>).`;

      // this anchorSelector string is specifically pieced together this way because there have been errors with minification, such that the space between the #sublineage_plot and g.infolayer disappeared
      const anchorSelector = `#${elementId} ` + `g.infolayer text.xtitle`;
      new HoverInfo(anchorSelector, hoverText).appendTo(`#${elementId}`);
      HoverInfo.positionAll();
    }
  }

  render() {
    return (
      <div
        id={this.props.elementId}
        ref={(element: any) => {
          this.plotElement = element || undefined;
        }}
      />
    );
  }
}

export default SublineagePlot;
