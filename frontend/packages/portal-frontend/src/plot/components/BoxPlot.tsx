import React, { useEffect, useRef } from "react";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";

export interface BoxPlotInfo {
  name: string;
  hoverLabels?: string[];
  vals: any;
  color: { r: number; b: number; g: number };
  lineColor: string;
}

export interface BoxPlotProps {
  plotName: string;
  boxData: BoxPlotInfo[];
  dottedLinePosition?: number;
  onLoad?: (plot: ExtendedPlotType) => void;
  setXAxisRange?: (range: any[]) => void;
  plotHeight?: number;
  xAxisRange?: any[];
  xAxisTitle?: string;
  bottomMargin?: number;
  topMargin?: number;
  showUnderlyingPoints?: boolean;
  showDottedLines?: boolean;
  orientation?: "h" | "v" | undefined; // if not set, defaults to "h" for horizontal
}

type BoxPlotWithPlotly = BoxPlotProps & { Plotly: PlotlyType };

function BoxPlot({
  boxData,
  plotName,
  orientation = "h",
  showUnderlyingPoints = true,
  dottedLinePosition = undefined,
  showDottedLines = true,
  onLoad = () => {},
  plotHeight = undefined,
  xAxisRange = undefined,
  xAxisTitle = undefined,
  setXAxisRange = undefined,
  bottomMargin = 0,
  topMargin = 25,
  Plotly,
}: BoxPlotWithPlotly) {
  const ref = useRef<ExtendedPlotType>(null);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  const formatTextWrap = (text: string, maxLineLength: number) => {
    const words = text.replace(/[\r\n]+/g, " ").split(" ");
    let lineLength = 0;

    return words.reduce((result, word) => {
      if (lineLength + word.length >= maxLineLength) {
        lineLength = word.length;
        return result + `<br>${word}`; // don't add spaces upfront
      }
      lineLength += word.length + (result ? 1 : 0);
      return result ? result + ` ${word}` : `${word}`; // add space only when needed
    }, "");
  };

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;

    const data: Partial<Plotly.PlotData>[] = boxData.map((box: BoxPlotInfo) => {
      return {
        name: formatTextWrap(box.name, 14),
        y: orientation === "v" ? box.vals : undefined,
        x: orientation === "h" ? box.vals : undefined,
        boxpoints: showUnderlyingPoints ? "all" : false,
        orientation,
        jitter: 0.5,
        pointpos: 0,
        type: "box",
        fillcolor: `RGBA(${box.color.r.toString()}, ${box.color.g.toString()}, ${box.color.b.toString()}, 0.4)`,
        marker: {
          color: `RGBA(${box.color.r.toString()}, ${box.color.g.toString()}, ${box.color.b.toString()}, 1)`,
        },
        line: {
          color: "#000000",
          width: 1,
        },
        hoverinfo: "text",
        hovertext: box.hoverLabels?.map(
          (label, index) => `${label}: ${box.vals[index].toFixed(3)}`
        ),
        hoveron: "points",
      };
    });

    const layout: Partial<Plotly.Layout> = {
      margin: { t: topMargin, r: 5, b: bottomMargin, l: 130 },
      autosize: plotHeight === undefined,
      dragmode: false,
      height: plotHeight,
      width: 370,
      showlegend: false,
      yaxis: {
        zeroline: false,
      },
      xaxis: {
        zeroline: true,
        title: xAxisTitle,
        autorange: xAxisRange === undefined,
        range: xAxisRange,
      },
      shapes: showDottedLines
        ? [
            {
              x0: 0,
              y0: 0,
              x1: 0,
              y1: 100,
              type: "line",
              yref: "paper",
              line: {
                color: "black",
                dash: "dot",
                width: 1,
              },
            },
            {
              x0: dottedLinePosition,
              y0: 0,
              x1: dottedLinePosition,
              y1: 100,
              type: "line",
              yref: "paper",
              line: {
                color: "black",
                dash: "dot",
                width: 1,
              },
            },
          ]
        : undefined,
    };

    const config: Partial<Plotly.Config> = { responsive: true };

    Plotly.react(plot, data, layout, config);
  }, [
    Plotly,
    boxData,
    plotHeight,
    xAxisRange,
    bottomMargin,
    topMargin,
    xAxisTitle,
    dottedLinePosition,
    showDottedLines,
    showUnderlyingPoints,
    orientation,
    onLoad,
  ]);

  useEffect(() => {
    if (ref.current?.layout && plotName === "other") {
      const update: Partial<Plotly.Layout> = {
        xaxis: {
          range: xAxisRange ?? ref.current.layout.xaxis.range,
          title: xAxisTitle ?? "",
        },
      };

      Plotly.relayout(ref.current, update);
    } else if (ref.current?.layout && plotName === "main") {
      const update: Partial<Plotly.Layout> = {
        margin: { t: 25, r: 5, b: bottomMargin, l: 130 },
        xaxis: {
          range: xAxisRange ?? ref.current.layout.xaxis.range,
          title: xAxisTitle ?? "",
        },
      };

      Plotly.relayout(ref.current, update);
    }
  }, [xAxisRange, xAxisTitle, Plotly, bottomMargin, plotName]);

  useEffect(() => {
    if (
      ref.current?.layout.xaxis.range &&
      setXAxisRange &&
      plotName === "main"
    ) {
      setXAxisRange(ref.current?.layout.xaxis.range);
    }
  }, [ref.current?.layout.xaxis.range, plotName, setXAxisRange]);

  return <div ref={ref} />;
}

export default function LazyBoxPlot({ boxData, ...otherProps }: BoxPlotProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        boxData ? (
          <BoxPlot
            boxData={boxData}
            Plotly={Plotly}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
