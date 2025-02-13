import React, { useEffect, useRef } from "react";
import { BOX_THICKNESS, getNewContextUrl } from "src/contextExplorer/utils";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";

export interface BoxPlotInfo {
  name: string;
  hoverLabels: string[];
  xVals: number[];
  color: { r: number; b: number; g: number; a?: number };
  lineColor: string;
  pointLineColor?: string;
  code?: string;
}

export interface BoxPlotProps {
  plotName: string;
  boxData: BoxPlotInfo[];
  dottedLinePosition: number;
  doLinkYAxisLabels?: boolean;
  selectedCode?: string;
  onLoad?: (plot: ExtendedPlotType) => void;
  setXAxisRange?: (range: any[]) => void;
  plotHeight?: number;
  xAxisRange?: any[];
  xAxisTitle?: string;
  bottomMargin?: number;
  topMargin?: number;
}

type BoxPlotWithPlotly = BoxPlotProps & { Plotly: PlotlyType };

function BoxPlot({
  boxData,
  plotName,
  dottedLinePosition,
  onLoad = () => {},
  plotHeight = undefined,
  xAxisRange = undefined,
  xAxisTitle = undefined,
  setXAxisRange = undefined,
  bottomMargin = 0,
  topMargin = 0,
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
        x: box.xVals,
        boxpoints: "all",
        orientation: "h",
        jitter: 0.5,
        pointpos: 0,
        type: "box",
        fillcolor: `RGBA(${box.color.r.toString()}, ${box.color.g.toString()}, ${box.color.b.toString()}, ${
          box.color.a?.toString() || (0.4).toString()
        })`,
        marker: {
          color: `RGBA(${box.color.r.toString()}, ${box.color.g.toString()}, ${box.color.b.toString()}, 1)`,
          line: {
            color: `RGBA(0, 0, 0, 0.3)`,
            width: 1,
          },
        },
        line: {
          color: "#000000",
          width: 1,
        },
        hoverinfo: "text",
        hovertext: box.hoverLabels.map(
          (label, index) => `${label}: ${box.xVals[index].toFixed(3)}`
        ),
        hoveron: "points",
      };
    });

    const layout: Partial<Plotly.Layout> = {
      margin: { t: topMargin, r: 10, b: bottomMargin, l: 10 },
      autosize: true,
      dragmode: "pan",
      height: plotHeight,
      width: 200,
      showlegend: false,
      yaxis: {
        zeroline: false,
        visible: false,
      },
      xaxis: {
        zeroline: true,
        title: xAxisTitle,
        autorange: xAxisRange === undefined,
        range: xAxisRange,
      },
      shapes: [
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
      ],
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
    } else if (
      ref.current?.layout &&
      (plotName === "main" || plotName === "main-header")
    ) {
      const update: Partial<Plotly.Layout> = {
        margin: { t: topMargin, r: 15, b: bottomMargin, l: 0 },
        xaxis: {
          range: xAxisRange ?? ref.current.layout.xaxis.range,
          title: xAxisTitle ?? "",
        },
      };

      Plotly.relayout(ref.current, update);
    }
  }, [
    xAxisRange,
    xAxisTitle,
    Plotly,
    bottomMargin,
    topMargin,
    plotName,
    plotHeight,
  ]);

  useEffect(() => {
    if (
      ref.current?.layout.xaxis.range &&
      setXAxisRange &&
      (plotName === "main" || plotName === "main-header")
    ) {
      setXAxisRange(ref.current?.layout.xaxis.range);
    }
  }, [ref.current?.layout.xaxis.range, plotName, setXAxisRange]);

  return <div ref={ref} />;
}

export default function LazyBoxPlot({
  boxData,
  selectedCode,
  doLinkYAxisLabels,
  ...otherProps
}: BoxPlotProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        boxData ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px auto",
              color: "#4479B2",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateRows: `repeat(${boxData.length}, ${BOX_THICKNESS}px)`,
                alignItems: "center",
              }}
            >
              {[...boxData.slice(1), boxData[0]].reverse().map((box, index) => (
                <div
                  key={box.name}
                  style={{
                    gridRow: index,
                    maxWidth: "120px",
                    overflow: "hidden",
                    overflowWrap: "break-word",
                    fontSize: "12px",
                  }}
                >
                  {boxData.length > 0 && !box?.name.includes("Other") ? (
                    box?.name.split("/").map((code, j) => (
                      <React.Fragment key={code}>
                        {code === selectedCode ? (
                          <span style={{ color: "#333333", fontWeight: "600" }}>
                            {code}
                          </span>
                        ) : (
                          <a href={getNewContextUrl(code)}>{code}</a>
                        )}
                        {j < box?.name.split("/").length - 1 && "/"}
                      </React.Fragment>
                    ))
                  ) : (
                    <div>
                      {box.name === selectedCode ||
                      box?.name.includes("Other") ? (
                        <span
                          style={{
                            color: "#333333",
                            fontWeight: "600",
                            fontSize: box?.name.includes("Other")
                              ? "14px"
                              : "12px",
                          }}
                        >
                          {box.name}
                        </span>
                      ) : (
                        <span>{box.name}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <BoxPlot
              boxData={boxData}
              Plotly={Plotly}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...otherProps}
            />
          </div>
        ) : null
      }
    </PlotlyLoader>
  );
}
