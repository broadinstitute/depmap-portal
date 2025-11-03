import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  Config,
  Layout,
  PlotData,
  PlotlyHTMLElement,
  PlotMouseEvent,
  PlotSelectionEvent,
  ViolinData,
} from "plotly.js";
import { usePlotlyLoader } from "../../../../../contexts/PlotlyLoaderContext";
import seedrandom from "seedrandom";
import {
  calcAnnotationPositions,
  DataExplorerColorPalette,
  DEFAULT_PALETTE,
  getRange,
  hexToRgba,
  isEveryValueNull,
  LEGEND_ALL,
  LegendKey,
} from "./plotUtils";
import usePlotResizer from "./usePlotResizer";
import type ExtendedPlotType from "../../../ExtendedPlotType";

type Data = Record<string, any>;

const MAX_POINTS_TO_ANNOTATE = 50;

interface Props {
  data: Data;
  xKey: string;
  hoverTextKey?: string;
  annotationTextKey?: string;
  height: number | "auto";
  colorMap: Map<LegendKey, string>;
  colorData?: any;
  continuousColorKey?: string;
  legendDisplayNames: any;
  legendTitle?: string | null;
  selectedPoints?: Set<number>;
  onClickPoint?: (pointIndex: number, ctrlKey: boolean) => void;
  onMultiselect?: (pointIndices: number[]) => void;
  onClickResetSelection?: () => void;
  pointVisibility?: boolean[];
  useSemiOpaqueViolins?: boolean;
  onLoad?: (plot: ExtendedPlotType) => void;
  hiddenLegendValues?: any;
  // optional styling
  pointSize?: number;
  pointOpacity?: number;
  outlineWidth?: number;
  palette?: DataExplorerColorPalette;
  xAxisFontSize?: number;
  yAxisFontSize?: number;
}

const calcPlotHeight = (plot: HTMLDivElement) => {
  if (window.innerWidth < 900) {
    return 600;
  }

  return window.innerHeight - plot.offsetTop - 22;
};

const truncate = (s: string) => {
  const MAX = 25;
  return s && s.length > MAX ? `${s.substr(0, MAX)}…` : s;
};

// HACK: Plotly doesn't allow you to put a violin on top of a scatter plot, so
// we'll improvise.
const movePointsBehindViolinPlot = (plot: HTMLDivElement) => {
  const gl = plot.querySelector(".gl-container") as HTMLElement;
  gl.parentElement!.prepend(gl);

  const svg = plot.querySelector(".main-svg") as HTMLElement;
  svg.style.background = "transparent";

  svg.querySelectorAll(".gridlayer path").forEach((path) => {
    // eslint-disable-next-line no-param-reassign
    (path as HTMLElement).style.stroke = "#000";
    // eslint-disable-next-line no-param-reassign
    (path as HTMLElement).style.strokeOpacity = "0.08";
  });

  // Also nudge the hover label slightly to the right. It can sometimes get in
  // the way when trying to click on a point.
  const hoverlayer = plot.querySelector(".hoverlayer") as HTMLElement;
  hoverlayer.style.transform = "translateX(8px)";
};

// TODO: If we have continuous color data, can we use that to make the y values
// more meaningful (less random)?
const calcY = (
  x: any,
  colorKeys: any,
  colorData: any,
  hiddenLegendValues: any
) => {
  const sRandom = seedrandom("fixedSeed");

  if (!colorData) {
    return x.map(() => sRandom() / 2.1 + 1);
  }

  const y: any = [];
  let offsetY = colorKeys.length - hiddenLegendValues.size;

  colorKeys.forEach((key: string) => {
    if (!hiddenLegendValues.has(key)) {
      colorData.forEach((colorKey: any, i: number) => {
        if (colorKey === key) {
          y[i] = sRandom() / 2.1 + offsetY;
        }
      });

      offsetY -= 1;
    } else {
      colorData.forEach((colorKey: any) => {
        if (colorKey === key) {
          // Make sure values are deterministic.
          sRandom();
        }
      });
    }
  });

  return y as number[];
};

const hasSomeNonNullValue = (array: unknown[]) => {
  for (let i = 0; i < array.length; i += 1) {
    if (array[i] !== null) {
      return true;
    }
  }

  return false;
};

function PrototypeDensity1D({
  data,
  xKey,
  colorMap,
  colorData,
  continuousColorKey,
  legendDisplayNames,
  legendTitle,
  height,
  hoverTextKey,
  annotationTextKey,
  selectedPoints = null,
  pointVisibility = null,
  useSemiOpaqueViolins = false,
  onClickPoint = () => {},
  onMultiselect = () => {},
  onClickResetSelection = () => {},
  onLoad = () => {},
  hiddenLegendValues = new Set(),
  pointSize = 7,
  pointOpacity = 1.0,
  outlineWidth = 0.5,
  palette = DEFAULT_PALETTE,
  xAxisFontSize = 14,
  yAxisFontSize = 14,
  Plotly,
}: any) {
  const ref = useRef<ExtendedPlotType>(null);
  usePlotResizer(Plotly, ref);

  const axes = useRef<Partial<Layout>>({
    xaxis: undefined,
    yaxis: undefined,
  });

  const annotationTails = useRef<Record<string, { ax: number; ay: number }>>(
    {}
  );

  const [dragmode, setDragmode] = useState<Layout["dragmode"]>("zoom");

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  const [minX, maxX] = useMemo(() => getRange(data[xKey]), [data, xKey]);

  // When the type of data changes, we force an autoscale by discarding the
  // stored axes.
  useEffect(() => {
    axes.current = {
      xaxis: undefined,
      yaxis: undefined,
    };
  }, [data.xLabel, colorData, minX, maxX]);

  useEffect(() => {
    axes.current.yaxis = undefined;
  }, [colorMap, colorData, hiddenLegendValues.size]);

  // Update axes when font size changes.
  useEffect(() => {
    const xaxis = axes.current.xaxis;
    const yaxis = axes.current.yaxis;

    if (xaxis) {
      xaxis.tickfont = { size: xAxisFontSize };
      xaxis.title = {
        ...(xaxis.title as object),
        font: { size: xAxisFontSize },
      };
    }

    if (yaxis) {
      yaxis.tickfont = { size: yAxisFontSize };
    }
  }, [xAxisFontSize, yAxisFontSize]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    const colorKeys = [...colorMap.keys()];
    const x = data[xKey] as number[];
    const y = calcY(x, colorKeys, colorData, hiddenLegendValues);
    const text = hoverTextKey ? data[hoverTextKey] : null;
    const annotationText = annotationTextKey ? data[annotationTextKey] : null;
    const visible = pointVisibility ?? x.map(() => true);

    const contColorData = data[continuousColorKey];
    const hasColorOptionsEnabled = colorKeys[0] !== LEGEND_ALL;

    const isSelectionMode =
      dragmode === "select" ||
      dragmode === "lasso" ||
      (selectedPoints && selectedPoints.size > 0);

    const templateTrace = {
      type: "scattergl" as const,
      mode: "markers" as const,
      x: x.map((value: number, i) => (visible[i] ? value : null)),
      y,
      name: "",
      text,
      showlegend: false,
      hoverinfo: "x+text",
      hoverlabel: { bgcolor: palette.all },
      selectedpoints: selectedPoints ? [...selectedPoints] : [],
      marker: {
        color: hexToRgba(palette.all, pointOpacity),
        size: pointSize,
        line: {
          color: palette.all,
          width: outlineWidth,
        },
      },
      selected: { marker: { opacity: 1 } },
      unselected: {
        marker: {
          opacity: isSelectionMode ? 0.5 : 1,
        },
      },
    };

    const makeColorTrace = (
      color: string,
      hasTargetColor: (i: number) => boolean
    ) => {
      return {
        ...templateTrace,
        marker: {
          ...templateTrace.marker,
          line: templateTrace.marker.line
            ? {
                ...templateTrace.marker.line,
                color,
              }
            : undefined,
          color: hexToRgba(color, pointOpacity),
        },
        hoverlabel: { bgcolor: color },
        x: x.map((value: number, i) => {
          return visible[i] && hasTargetColor(i) ? value : null;
        }),
      };
    };

    const defaultTrace = hasColorOptionsEnabled ? null : templateTrace;

    const colorTraces =
      colorMap && colorData && !contColorData
        ? [...colorMap.keys()].map((key) =>
            makeColorTrace(
              colorMap.get(key)!,
              (i) => colorMap.get(key) === colorMap.get(colorData[i])
            )
          )
        : [];

    // TODO: Add support for palette.divergingScale
    const continuousColorTrace = contColorData
      ? {
          ...templateTrace,
          hoverlabel: {
            bgcolor: colorData.map((key: LegendKey) => colorMap.get(key)),
          },
          marker: {
            size: pointSize,
            color: contColorData.map(
              (c: number | null) => c ?? hexToRgba(palette.other, pointOpacity)
            ),
            colorscale: palette.sequentialScale.map(
              ([value, color]: [string, string]) => [
                value,
                hexToRgba(color, pointOpacity),
              ]
            ),
            line: {
              width: outlineWidth,
              color: contColorData.map(
                (c: number | null) => c ?? palette.other
              ),
              colorscale: palette.sequentialScale,
            },
          },
        }
      : null;

    // WORKAROUND: We use a special trace to give selected
    // points a dark outline, due to limitations of Plotly.
    const selectionOutlineTrace = {
      ...templateTrace,
      marker: {
        color: "transparent",
        size: pointSize + outlineWidth * 2,
        line: { color: "#000", width: Math.max(outlineWidth, 2) },
      },
      selected: { marker: { opacity: 1 } },
      unselected: { marker: { opacity: 0 } },
      hoverinfo: "skip",
    };

    const templateViolin = {
      type: "violin",
      x,
      y0: 1,
      points: false,
      hoverinfo: "none",
      line: { color: "#666" },
      side: "positive",
      width: 1,
      meanline: { visible: true, color: hexToRgba("#333", 0.5) },
      // The entire legend is usually hidden but we do reveal it when
      // converting the plot to an image. We want to make sure this gets hidden
      // even in that case.
      showlegend: false,
    } as Partial<ViolinData>;

    const violinTraces = colorKeys
      .filter((key) => !hiddenLegendValues.has(key))
      .map((legendKey, index) => {
        let fillcolor = colorMap.get(legendKey);

        if (useSemiOpaqueViolins) {
          fillcolor += "88";
        }

        return {
          ...templateViolin,
          name: legendDisplayNames[legendKey],
          x: colorData
            ? x.filter((_: any, i: number) => colorData[i] === legendKey)
            : x,
          y0: colorKeys.length - hiddenLegendValues.size - index,
          fillcolor,
        };
      })
      .filter((trace) => !isEveryValueNull(trace.x));

    // Add an extra violin with a light outline to make
    // it stand out on top many dark-colored points.
    const violinOutlineTraces = colorKeys
      .filter((key) => !hiddenLegendValues.has(key))
      .map((legendKey, index) => {
        return {
          ...templateViolin,
          line: { color: hexToRgba("#fff", 0.5), width: 4 },
          meanline: { visible: false },
          fillcolor: "transparent",
          x: colorData
            ? x.filter((_: any, i: number) => colorData[i] === legendKey)
            : x,
          y0: colorKeys.length - hiddenLegendValues.size - index,
        } as any;
      });

    const plotlyData = [
      ...violinTraces,
      ...violinOutlineTraces,
      defaultTrace,
      ...colorTraces,
      continuousColorTrace,
      selectionOutlineTrace,
    ]
      .filter(Boolean)
      .filter((trace) => hasSomeNonNullValue(trace.x))
      .reverse() as Partial<PlotData>[];

    const isClickableTrace = (n: number) => {
      return ([
        defaultTrace,
        continuousColorTrace,
        ...colorTraces,
      ] as Partial<PlotData>[]).includes(plotlyData[n]);
    };

    const layout: Partial<Layout> = {
      height: height === "auto" ? calcPlotHeight(plot) : height,
      // margin: { t: 30, l: 30, r: 30 },
      margin: {
        t: 30,
        r: 30,
        b: 50 + xAxisFontSize * 2.2,
        l: 50 + yAxisFontSize * 2.2,
      },
      hovermode: "closest",
      hoverlabel: {
        namelength: -1,
      },

      // We have a custom legend so we hide Plotly's legend. However, this
      // property is toggled just before capturing a snapshot image. See the
      // definition of plot.downloadImage() below.
      showlegend: false,

      xaxis: axes.current.xaxis || {
        title: {
          text: data.xLabel,
          font: { size: xAxisFontSize },
          standoff: 8,
        } as any,
        exponentformat: "e",
        type: "linear",
        autorange: true,
        tickfont: { size: xAxisFontSize },
      },

      yaxis: {
        ...(axes.current.yaxis || { autorange: true }),

        visible:
          Boolean(colorData) &&
          colorData.length > 0 &&
          violinTraces.length < 40,
        automargin: true,
        tickvals: violinTraces.map((vt) => vt.y0),
        ticktext: violinTraces.map((vt) => truncate(vt.name)),
        tickfont: { size: yAxisFontSize },
      },

      dragmode,

      annotations:
        annotationText && selectedPoints?.size <= MAX_POINTS_TO_ANNOTATE
          ? [...selectedPoints]
              .filter(
                // Filter out any annotations associated with missing data. This can
                // happen if the x or y column has changed since the annotations were
                // created.
                (pointIndex) =>
                  typeof x[pointIndex] === "number" &&
                  typeof y[pointIndex] === "number"
              )
              .map((pointIndex) => ({
                x: x[pointIndex],
                y: y[pointIndex],
                text: annotationText[pointIndex],
                visible: visible[pointIndex],
                xref: "x",
                yref: "y",
                arrowhead: 0,
                standoff: 4,
                arrowcolor: "#888",
                bordercolor: "#c7c7c7",
                bgcolor: "#fff",
                pointIndex,
                // Restore any annotation arrowhead positions the user may have edited.
                ax: annotationTails.current[`${xKey}-${pointIndex}`]?.ax,
                ay: annotationTails.current[`${xKey}-${pointIndex}`]?.ay,
              }))
          : (() => {
              return selectedPoints
                ? [
                    {
                      text: [
                        selectedPoints.size,
                        "selected",
                        selectedPoints.size === 1 ? "point" : "points",
                      ].join(" "),
                      arrowcolor: "transparent",
                      bordercolor: "#c7c7c7",
                      bgcolor: "#fff",
                    },
                  ]
                : undefined;
            })(),
    };

    const config: Partial<Config> = {
      responsive: true,
      edits: { annotationTail: true },
      displaylogo: false,
      modeBarButtonsToRemove: ["select2d", "lasso2d"],
    };

    Plotly.react(plot, plotlyData, layout, config);

    // Keep track of added listeners so we can easily remove them.
    const listeners: [string, (e: any) => void][] = [];

    const on = (eventName: string, callback: (e: any) => void) => {
      plot.on(
        eventName as Parameters<PlotlyHTMLElement["on"]>[0],
        callback as Parameters<PlotlyHTMLElement["on"]>[1]
      );
      listeners.push([eventName, callback]);
    };

    // HACK: The zoom functions provided by Plotly's modebar aren't exposed
    // by its API. The only way to trigger them is by actually clicking the
    // buttons 😕
    const getButton = (attr: string, val: string) =>
      plot.querySelector(
        `.modebar-btn[data-attr="${attr}"][data-val="${val}"]`
      ) as HTMLAnchorElement;

    const zoom = (val: "in" | "out" | "reset") => {
      getButton("zoom", val).click();

      // This redraw fixes a very strange bug where setting the drag mode to
      // select (or lasso) with a filter also applied causes all of the points
      // to disappear.
      Plotly.redraw(plot);
    };

    const assignAnnotationPositions = (pointIndices: number[]) => {
      // Don't both doing the calculation if we're not going to show them.
      if (new Set(pointIndices).size > MAX_POINTS_TO_ANNOTATE) {
        return;
      }

      const fullLayout = (plot as any)._fullLayout;

      calcAnnotationPositions(x, y, pointIndices, fullLayout).forEach(
        ({ pointIndex, ax, ay }) => {
          annotationTails.current[`${xKey}-${pointIndex}`] = { ax, ay };
        }
      );
    };

    plot.annotateSelected = () => {
      if (selectedPoints) {
        const points = [...selectedPoints];
        assignAnnotationPositions(points);
        onMultiselect(points);
      }
    };

    // After initializing the plot with `autorange` set to true, store what
    // Plotly calculated for the axes zoom level and turn off autorange.
    on("plotly_afterplot", () => {
      if (!axes.current.xaxis || !axes.current.yaxis) {
        axes.current = {
          xaxis: { ...plot.layout.xaxis, autorange: false },
          yaxis: { ...plot.layout.yaxis, autorange: false },
        };
      }

      movePointsBehindViolinPlot(plot);
    });

    on("plotly_relayout", () => {
      axes.current = {
        xaxis: { ...plot.layout.xaxis, autorange: false },
        yaxis: { ...plot.layout.yaxis, autorange: false },
      };

      plot.layout.annotations?.forEach((annotation) => {
        const { ax, ay } = annotation;

        if (ax != null && ay != null) {
          const { pointIndex } = annotation as { pointIndex: number };
          annotationTails.current[`${xKey}-${pointIndex}`] = { ax, ay };
        }
      });
    });

    on("plotly_click", (e: PlotMouseEvent) => {
      const { curveNumber, pointIndex } = e.points[0];
      const anyModifier =
        e.event.ctrlKey || e.event.metaKey || e.event.shiftKey;

      if (isClickableTrace(curveNumber) && onClickPoint) {
        onClickPoint(pointIndex, anyModifier);
      }

      // WORKAROUND: If you mean to double-click to zoom out and
      // select a point by accident, restore the previous selections.
      const prevAxes = axes.current;
      const prevSelection = selectedPoints;

      setTimeout(() => {
        if (axes.current !== prevAxes && prevSelection) {
          onMultiselect([...prevSelection]);
        }
      }, 100);
    });

    on("plotly_selecting", () => {
      if (selectedPoints?.size > 0) {
        onClickResetSelection();
      }
    });

    on("plotly_selected", (e: PlotSelectionEvent) => {
      const points =
        e?.points
          .filter(
            (p) => p.data.hoverinfo !== "skip" && p.data.hoverinfo !== "none"
          )
          .map((p) => p.pointIndex) || [];

      assignAnnotationPositions(points);
      onMultiselect(points);
    });

    on("plotly_deselect", () => {
      onClickResetSelection();
    });

    // WORKAROUND: Double-click is supposed to reset the zoom but it only works
    // actually intermittently so we'll do it ourselves.
    on("plotly_doubleclick", () => {
      plot.resetZoom();
    });

    // WORKAROUND: For some reason, autosize only works
    // with width so we'll calculate the height as well.
    on("plotly_autosize", () => {
      if (height === "auto") {
        setTimeout(() => {
          plot.layout.height = calcPlotHeight(plot);
          Plotly.redraw(plot);
        });
      }
    });

    // https://github.com/plotly/plotly.js/blob/55dda47/src/lib/prepare_regl.js
    on("plotly_webglcontextlost", () => {
      // Fixes a bug where points disappear after the browser has been left
      // idle for some time.
      Plotly.redraw(plot);
    });

    // Add a few non-standard methods to the plot for convenience.
    plot.setDragmode = (nextDragmode) => {
      const shouldResetSelection =
        plot.layout.dragmode !== nextDragmode &&
        (nextDragmode === "select" || nextDragmode === "lasso");

      if (shouldResetSelection && onClickResetSelection) {
        onClickResetSelection();
      }

      setDragmode(nextDragmode);
    };

    plot.zoomIn = () => setTimeout(zoom, 0, "in");
    plot.zoomOut = () => setTimeout(zoom, 0, "out");
    plot.resetZoom = () => setTimeout(zoom, 0, "reset");

    plot.downloadImage = (options) => {
      // Add some extra traces used to populate the legend.
      const legendTraces = colorKeys
        .filter((key) => !hiddenLegendValues.has(key))
        .map((legendKey) => {
          const fillcolor = colorMap.get(legendKey);

          return {
            type: "violin",
            showlegend: true,
            x: [null],
            line: { color: "#666" },
            hoverinfo: "skip",
            name: legendDisplayNames[legendKey],
            fillcolor,
          };
        });

      const imagePlot = {
        ...plot,
        data: [...plot.data, ...legendTraces],
        layout: {
          ...plot.layout,
          showlegend: true,
          legend: {
            title: {
              text: legendTitle,
            },
          },
        },
      };

      Plotly.downloadImage(imagePlot, options);
    };

    plot.isPointInView = (pointIndex: number) => {
      const px = x[pointIndex] as number;
      const py = y[pointIndex] as number;
      const xrange = plot.layout.xaxis.range as [number, number];
      const yrange = plot.layout.yaxis.range as [number, number];

      return (
        px >= xrange[0] && px <= xrange[1] && py >= yrange[0] && py <= yrange[1]
      );
    };

    plot.xValueMissing = (pointIndex: number) => {
      return typeof data[xKey][pointIndex] !== "number";
    };

    // Not possible
    plot.yValueMissing = () => false;

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener(eventName, callback)
      );
    };
  }, [
    data,
    xKey,
    colorMap,
    colorData,
    continuousColorKey,
    legendDisplayNames,
    legendTitle,
    hoverTextKey,
    annotationTextKey,
    height,
    selectedPoints,
    onClickPoint,
    onMultiselect,
    onClickResetSelection,
    pointVisibility,
    useSemiOpaqueViolins,
    dragmode,
    hiddenLegendValues,
    pointSize,
    pointOpacity,
    outlineWidth,
    palette,
    xAxisFontSize,
    yAxisFontSize,
    Plotly,
  ]);

  return <div ref={ref} />;
}

export default function LazyPrototypeDensity1D({ data, ...otherProps }: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        data ? (
          <PrototypeDensity1D data={data} Plotly={Plotly} {...otherProps} />
        ) : null
      }
    </PlotlyLoader>
  );
}
