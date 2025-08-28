import React, { useEffect, useRef } from "react";
import { BOX_THICKNESS, getNewContextUrl } from "src/contextExplorer/utils";
import ExtendedPlotType from "../../../plot/models/ExtendedPlotType";
import PlotlyLoader, {
  PlotlyType,
} from "../../../plot/components/PlotlyLoader";
import { BoxPlotInfo } from "src/contextExplorer/models/types";
import { PlotlyHTMLElement } from "plotly.js";

export interface BoxPlotProps {
  boxData: BoxPlotInfo[];
  dottedLinePosition: number;
  isLevel0?: boolean;
  isActivePlot?: boolean;
  selectedCode?: string;
  onLoad?: (plot: ExtendedPlotType) => void;
  plotHeight?: number;
  xAxisRange?: any[];
  xAxisTitle?: string;
  bottomMargin?: number;
  topMargin?: number;
  urlPrefix?: string; // Required if linking y-axis from somewhere other than context explorer (e.g. gene page)
  tab?: string; // Required if linking y-axis from somewhere other than context explorer (e.g. gene page)
}

type BoxPlotWithPlotly = BoxPlotProps & { Plotly: PlotlyType };

function BoxPlot({
  boxData,
  dottedLinePosition,
  isLevel0 = false,
  selectedCode = undefined,
  onLoad = () => {},
  isActivePlot = false,
  plotHeight = undefined,
  xAxisRange = undefined,
  xAxisTitle = undefined,
  bottomMargin = 0,
  topMargin = 0,
  urlPrefix = undefined,
  tab = undefined,
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
          box.color.a?.toString() || (0.3).toString()
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
      margin: { t: topMargin, r: 5, b: bottomMargin, l: 5 },
      autosize: true,
      dragmode: "pan",
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

    // Keep track of added listeners so we can easily remove them.
    const listeners: [string, (e: any) => void][] = [];

    const on = (eventName: string, callback: (e: any) => void) => {
      plot.on(
        eventName as Parameters<PlotlyHTMLElement["on"]>[0],
        callback as Parameters<PlotlyHTMLElement["on"]>[1]
      );
      listeners.push([eventName, callback]);
    };

    on("plotly_resize", () => {
      setTimeout(() => {
        Plotly.redraw(plot);
      });
    });

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener(eventName, callback)
      );
    };
  }, [
    Plotly,
    boxData,
    plotHeight,
    xAxisRange,
    bottomMargin,
    topMargin,
    xAxisTitle,
    dottedLinePosition,
    selectedCode,
    urlPrefix,
    isLevel0,
    isActivePlot,
    tab,
    onLoad,
  ]);

  return <div ref={ref} />;
}

export default function LazyBoxPlot({
  boxData,
  isLevel0 = false,
  isActivePlot = false,
  plotHeight = undefined,
  selectedCode = undefined,
  urlPrefix = undefined,
  tab = undefined,
  ...otherProps
}: BoxPlotProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        boxData ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "100px auto",
              color: "#4479B2",
              height: plotHeight,
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
                  {isLevel0 && (
                    <span
                      style={{
                        paddingRight: "10px",
                        paddingTop: box.name === selectedCode ? "0px" : "12px",
                        fontSize: "16px",
                        color: "#4479B2",
                      }}
                      className={
                        isActivePlot
                          ? "glyphicon glyphicon-chevron-up"
                          : "glyphicon glyphicon-chevron-down"
                      }
                    />
                  )}
                  {boxData.length > 0 && !box?.name.includes("Other") ? (
                    box?.name.split("/").map((code, j) => (
                      <React.Fragment key={code}>
                        {code === selectedCode ? (
                          <span style={{ color: "#333333", fontWeight: "600" }}>
                            {code}
                          </span>
                        ) : (
                          <a
                            href={getNewContextUrl(code, urlPrefix, tab)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {code}
                          </a>
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
                            fontSize: "12px",
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
