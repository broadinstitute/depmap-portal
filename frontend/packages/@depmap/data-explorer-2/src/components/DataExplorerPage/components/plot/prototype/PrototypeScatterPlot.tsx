/* eslint-disable react/require-default-props */
// This is a forked version of frontend/packages/portal-frontend/src/plot/components/ScatterPlot.tsx
// The idea is this one can be used for experimental changes.
import React, { useEffect, useMemo, useRef, useState } from "react";
import type Plotly from "plotly.js";
import type {
  Config,
  Layout,
  PlotData,
  PlotlyHTMLElement,
  PlotMouseEvent,
  PlotSelectionEvent,
} from "plotly.js";
import { usePlotlyLoader } from "../../../../../contexts/PlotlyLoaderContext";
import {
  calcAnnotationPositions,
  calcAutoscaleShapes,
  calcPlotIndicatorLineShapes,
  categoricalDataToValueCounts,
  countExclusivelyTrueValues,
  countInclusivelyTrueValues,
  DataExplorerColorPalette,
  DEFAULT_PALETTE,
  getRange,
  hexToRgba,
  LegendKey,
  RegressionLine,
} from "./plotUtils";
import usePlotResizer from "./usePlotResizer";
import type ExtendedPlotType from "../../../ExtendedPlotType";
import styles from "../../../styles/ScatterPlot.scss";

type Data = Record<string, any>;

const MAX_POINTS_TO_ANNOTATE = 50;

interface LegendInfo {
  title: string;
  items: { name: string; hexColor: string }[];
}

interface Props {
  data: Data;
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  // Height can be defined in pixels or set to "auto."  In auto mode, it will
  // attempt to fill the height of the viewport.
  height: number | "auto";
  legendForDownload?: LegendInfo;
  // If defined, the corresponding key from `data` will used to generate hover
  // text.
  hoverTextKey?: string;
  // Allows you to specify which key of `data` should be used to label annotations.
  // If this is not defined, it will try to use `hoverTextKey` instead. If that's
  // not defined, it will use (x, y) values to annotate points.
  annotationTextKey?: string;
  colorKey1?: string;
  colorKey2?: string;
  categoricalColorKey?: string;
  continuousColorKey?: string;
  contLegendKeys?: LegendKey[] | null;
  colorMap: Map<LegendKey, string>;
  selectedPoints?: Set<number>;
  // Special case. Set to false to avoid outlining the VERY densely packed Waterfall plot points.
  outlineUnselectedPoints?: boolean;
  onClickPoint?: (pointIndex: number, ctrlKey: boolean) => void;
  onMultiselect?: (pointIndices: number[]) => void;
  onClickResetSelection?: () => void;
  pointVisibility?: boolean[];
  showIdentityLine?: boolean;
  regressionLines?: RegressionLine[] | null;
  onLoad?: (plot: ExtendedPlotType) => void;
  customHoverinfo?: PlotData["hoverinfo"];
  hideXAxis?: boolean;
  hideXAxisGrid?: boolean;
  // optional styling
  pointSize?: number;
  pointOpacity?: number;
  outlineWidth?: number;
  palette?: DataExplorerColorPalette;
  xAxisFontSize?: number;
  yAxisFontSize?: number;
}

type PlotlyType = typeof Plotly;
type PropsWithPlotly = Props & { Plotly: PlotlyType };

const calcPlotHeight = (plot: HTMLDivElement) => {
  if (window.innerWidth < 900) {
    return 600;
  }

  return window.innerHeight - plot.offsetTop - 22;
};

const byValueCountOf = (counts: Map<string | symbol | null, number>) => (
  a: string | symbol,
  b: string | symbol
) => {
  const countA = counts.get(a) || 0;
  const countB = counts.get(b) || 0;

  if (countA === countB) {
    return 0;
  }

  return countA < countB ? -1 : 1;
};

// HACK: Selected points get a black outline and this looks weird when
// regression lines sit on top of them. We'll do some hacky DOM manipulation to
// change the stacking order.
const moveSelectedPointsOnTopOfLines = (plot: HTMLDivElement) => {
  const modebar = plot.querySelector(".modebar-container") as HTMLElement;
  const focusCanvas = plot.querySelector(".gl-canvas-focus") as HTMLElement;

  // `focusCanvas` is the canvas that has the focused (i.e. selected) points.
  // We'll move that just before the modebar in the DOM, which actually puts it
  // right after the shapes (i.e. y=x and regression lines).
  modebar.parentElement!.insertBefore(focusCanvas, modebar);

  // That's almost exactly what we want but now those points can appear on top
  // of annotations (i.e. point labels). We'll move those so they're a little
  // later in the DOM, right before the hover information.
  const infolayer = plot.querySelector(".infolayer") as HTMLElement;
  const hoverlayer = plot.querySelector(".hoverlayer") as HTMLElement;
  hoverlayer.parentElement!.insertBefore(infolayer, hoverlayer);

  // Also nudge the hover label slightly to the right. It can sometimes get in
  // the way when trying to click on a point.
  hoverlayer.style.transform = "translateX(8px)";
};

function PrototypeScatterPlot({
  data,
  xKey,
  yKey,
  xLabel,
  yLabel,
  height,
  colorKey1,
  colorKey2,
  legendForDownload,
  categoricalColorKey,
  continuousColorKey,
  contLegendKeys,
  colorMap,
  hoverTextKey = undefined,
  annotationTextKey = undefined,
  selectedPoints = undefined,
  pointVisibility = undefined,
  showIdentityLine = false,
  regressionLines = undefined,
  outlineUnselectedPoints = true,
  onClickPoint = () => {},
  onMultiselect = () => {},
  onClickResetSelection = () => {},
  onLoad = () => {},
  customHoverinfo = undefined,
  hideXAxis = false,
  hideXAxisGrid = false,
  pointSize = 7,
  pointOpacity = 1.0,
  outlineWidth = 0.5,
  palette = DEFAULT_PALETTE,
  xAxisFontSize = 14,
  yAxisFontSize = 14,
  Plotly,
}: PropsWithPlotly) {
  const ref = useRef<ExtendedPlotType>(null);
  usePlotResizer(Plotly, ref);

  // We save the axes of the plot so we can keep the zoom level consistent
  // between calls to Plotly#react. This value is upated
  // - When the plot is first rendered (and an autorange is calculated)
  // - After each plotly_relayout event (e.g. when the user changes the zoom
  // level).
  const axes = useRef<Partial<Layout>>({
    xaxis: undefined,
    yaxis: undefined,
  });

  const extents = useMemo(() => {
    const [minX, maxX] = getRange(data[xKey] as number[]);
    const [minY, maxY] = getRange(data[yKey] as number[]);

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const ratio = Math.min(rangeX, rangeY) / Math.max(rangeX, rangeY);

    return { minX, maxX, minY, maxY, rangeX, rangeY, ratio };
  }, [data, xKey, yKey]);

  const shapes = useMemo(() => {
    return calcPlotIndicatorLineShapes(
      showIdentityLine,
      regressionLines,
      extents,
      true
    );
  }, [showIdentityLine, regressionLines, extents]);

  const annotationTails = useRef<Record<string, { ax: number; ay: number }>>(
    {}
  );

  const [dragmode, setDragmode] = useState<Layout["dragmode"]>("zoom");

  // On mount, we call the `onLoad` callback with a reference to the DOM node
  // (which is extended with convenience functions).
  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  // When the columns or underlying data change, we force an autoscale by
  // discarding the stored axes.
  useEffect(() => {
    axes.current = {
      xaxis: undefined,
      yaxis: undefined,
    };
  }, [xKey, yKey, xLabel, yLabel, data]);

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
      yaxis.title = {
        ...(yaxis.title as object),
        font: { size: yAxisFontSize },
      };
    }
  }, [xAxisFontSize, yAxisFontSize]);

  // All other updates are handled by this one big effect.
  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;

    const x = data[xKey] as number[];
    const y = data[yKey] as number[];
    const text = hoverTextKey ? data[hoverTextKey] : x.map(() => "");
    const annotationText = annotationTextKey
      ? data[annotationTextKey]
      : x.map(
          (_: any, i: number) => `${x[i]?.toFixed(2)}, ${y[i]?.toFixed(2)}`
        );
    const visible = pointVisibility ?? x.map(() => true);

    const color1 = colorKey1 ? data[colorKey1] : null;
    const color2 = colorKey2 ? data[colorKey2] : null;
    const catColorData = categoricalColorKey ? data[categoricalColorKey] : null;
    const catColorValueCounts = categoricalDataToValueCounts(
      catColorData?.map((value: string, i: number) =>
        x[i] !== null && y[i] !== null ? value : null
      ),
      visible
    );
    const contColorData: (number | null)[] = continuousColorKey
      ? data[continuousColorKey]
      : null;
    const contColorValueCounts = categoricalDataToValueCounts(
      contLegendKeys,
      x.map(() => true)
    );
    const hasColorOptionsEnabled = Boolean(
      color1 || color2 || catColorData || contColorData
    );

    const isSelectionMode =
      dragmode === "select" ||
      dragmode === "lasso" ||
      (selectedPoints && selectedPoints.size > 0);

    const templateTrace = {
      type: "scattergl" as const,
      mode: "markers" as const,
      // HACK: Settings coordinates to `null` is the most performant way to
      // hide them. We make sure to do this for both axes because it affects
      // autoscaling.
      x: x.map((value: number, i) =>
        visible[i] &&
        // Make sure there's a value on the opposite axis, otherwise an
        // unplottable outlier could affect the axis scale.
        y[i] !== null
          ? value
          : null
      ),
      y: y.map((value: number, i) =>
        visible[i] &&
        // Same idea as above.
        x[i] !== null
          ? value
          : null
      ),
      name: "",
      text,
      hoverinfo: customHoverinfo || ("x+y+text" as const),
      showlegend: false,
      hoverlabel: { bgcolor: palette.all },
      selectedpoints: selectedPoints ? [...selectedPoints] : [],
      marker: {
        color: hexToRgba(palette.all, pointOpacity),
        size: pointSize,
        line: { color: palette.all, width: outlineWidth },
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

    const color1Trace = color1
      ? makeColorTrace(palette.compare1, (i) => color1[i] && !color2?.[i])
      : null;

    const color2Trace = color2
      ? makeColorTrace(palette.compare2, (i) => color2[i] && !color1?.[i])
      : null;

    const colorOverlapTrace =
      color1 && color2
        ? makeColorTrace(palette.compareBoth, (i) => color1[i] && color2[i])
        : null;

    const comparisonColorTraces = [
      [color1Trace, countExclusivelyTrueValues(color1, color2, visible)],
      [color2Trace, countExclusivelyTrueValues(color2, color1, visible)],
      [colorOverlapTrace, countInclusivelyTrueValues(color1, color2, visible)],
    ]
      .filter(([trace]) => trace)
      .sort(([, a], [, b]) => (a! < b! ? -1 : 1))
      .map(([trace]) => trace);

    // TODO: Instead of making a trace for each category and sorting those
    // traces, we could sort the individual points instead (much more
    // performant). That comes with its own issues (selection behavior is
    // becomes buggy when points are out of order) but we've already solved
    // that for `continuousColorTrace` below.
    let categoricalColorTraces: Partial<PlotData>[] = [];

    if (colorMap && catColorData) {
      const catCardinality = Object.keys(colorMap || {}).length;

      categoricalColorTraces =
        catCardinality < 75
          ? [...colorMap.keys()]
              .sort(byValueCountOf(catColorValueCounts))
              .map((key) =>
                makeColorTrace(
                  colorMap.get(key)!,
                  (i) => key === catColorData[i]
                )
              )
          : // WORKAROUND: If there's a large number of categories,
            // make a trace for each color instead. This is worse
            // for the stacking order but better for performance.
            [...new Set(colorMap.values())].map((color) =>
              makeColorTrace(
                color!,
                (i) => color === colorMap.get(catColorData[i])
              )
            );
    }

    // TODO: Add support for palette.divergingScale
    let continuousColorTrace: any = null;

    // HACK: The continuous trace gets its own index. That is, its points are
    // mixed up relative to the other traces. This creates much confusion...
    // but it's worth it. It allows us to plot points from the bins with the
    // fewest values on top. This makes the plot much more interpretable. But
    // it means that when we click or select a point, we have to figure out
    // what index it originally came from.
    const contTraceIndex: number[] = [];

    if (contColorData && contLegendKeys) {
      const sortedX: (number | null)[] = [];
      const sortedY: (number | null)[] = [];
      const sortedColor: (number | null)[] = [];
      const hoverColor: string[] = [];
      const sortedText: string[] = [];
      const sortedAnnotationText: string[] = [];
      const remappedSelectedPoints: number[] = [];

      const sortedBins = [...colorMap.keys()]
        .sort(byValueCountOf(contColorValueCounts))
        .reverse();

      contColorData
        .map((value, origIndex) => ({
          value,
          origIndex,
        }))
        .sort((a, b) => {
          const binIndexA = sortedBins.indexOf(contLegendKeys[a.origIndex]);
          const binIndexB = sortedBins.indexOf(contLegendKeys[b.origIndex]);

          if (binIndexA < binIndexB) {
            return -1;
          }

          if (binIndexA > binIndexB) {
            return 1;
          }

          if (a.value === b.value || a.value == null || b.value == null) {
            return 0;
          }

          return a.value < b.value ? -1 : 1;
        })
        .forEach(({ origIndex }, i: number) => {
          contTraceIndex.push(origIndex);
          sortedX.push(templateTrace.x[origIndex]);
          sortedY.push(templateTrace.y[origIndex]);
          sortedColor.push(contColorData[origIndex]);
          hoverColor.push(colorMap.get(contLegendKeys[origIndex])!);
          sortedText.push(text[origIndex]);
          sortedAnnotationText.push(annotationText[origIndex]);
          if (selectedPoints?.has(origIndex)) {
            remappedSelectedPoints.push(i);
          }
        });

      continuousColorTrace = {
        ...templateTrace,
        x: sortedX,
        y: sortedY,
        text: sortedText,
        annotationText: sortedAnnotationText,
        selectedpoints: remappedSelectedPoints,
        hoverlabel: { bgcolor: hoverColor },
        marker: {
          size: pointSize,
          color: sortedColor.map((c: number | null) => c ?? "transparent"),
          colorscale: palette.sequentialScale.map(([value, color]) => [
            value,
            hexToRgba(color, pointOpacity),
          ]),
          line: {
            width: outlineWidth,
            color: sortedColor.map((c: number | null) => c ?? "transparent"),
            colorscale: palette.sequentialScale,
          },
        },
      };
    }

    let otherPointsTrace = null;

    if (color1 || color2) {
      otherPointsTrace = makeColorTrace(
        palette.other,
        (i) => !color1?.[i] && !color2?.[i]
      );
    }

    if (catColorData) {
      otherPointsTrace = makeColorTrace(
        palette.other,
        (i) => catColorData[i] === null
      );
    }

    if (contColorData) {
      otherPointsTrace = makeColorTrace(
        palette.other,
        (i) => contColorData[i] === null
      );
    }

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

    const plotlyData = [
      defaultTrace,
      ...comparisonColorTraces,
      ...categoricalColorTraces,
      continuousColorTrace,
      otherPointsTrace,
      selectionOutlineTrace,
    ]
      .filter(Boolean)
      .reverse() as Partial<PlotData>[];

    const isContinuousCurve = (curveNumber: number) => {
      return plotlyData[curveNumber] === continuousColorTrace;
    };

    // Restore or initialize axes. We set `autorange` to true on the first render
    // so that Plotly can calculate the extents of the plot for us.
    const xaxis = axes.current.xaxis || {
      title: {
        text: xLabel,
        font: { size: xAxisFontSize },
        standoff: 8,
      } as any,
      tickfont: { size: xAxisFontSize },
      exponentformat: "e",
      type: "linear",
      autorange: true,
      visible: !hideXAxis,
      showgrid: !hideXAxisGrid,
    };

    const yaxis = axes.current.yaxis || {
      title: {
        text: yLabel,
        font: { size: yAxisFontSize },
        standoff: 0,
      } as any,
      tickfont: { size: yAxisFontSize },
      exponentformat: "e",
      autorange: true,
    };

    const layout: Partial<Layout> = {
      dragmode,
      // Actual shapes are drawn in the "plotly_afterplot" event handler.
      // That's to prevent them having any effect on autoscaling. However, we
      // *do* want to force the scales to match when `showIdentityLine` is
      // true. That's what `calcAutoscaleShapes()` is for. It's a hak that adds
      // an invisible line that tricks Plotly into adjusting the scale.
      shapes: calcAutoscaleShapes(showIdentityLine, extents),
      height: height === "auto" ? calcPlotHeight(plot) : height,

      margin: {
        t: 30,
        r: 30,
        b: 50 + xAxisFontSize * 2.2,
        l: 50 + yAxisFontSize * 2.2,
      },
      hovermode: "closest",

      // We hide the legend because the traces don't have names and some of
      // them are merely decorative (e.g. selectionOutlineTrace). DE2 has its
      // own custom-build legend so this isn't a problem.
      showlegend: false,

      xaxis,
      yaxis,

      annotations:
        selectedPoints && selectedPoints.size <= MAX_POINTS_TO_ANNOTATE
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
                ax:
                  annotationTails.current[`${xKey}-${yKey}-${pointIndex}`]?.ax,
                ay:
                  annotationTails.current[`${xKey}-${yKey}-${pointIndex}`]?.ay,
              }))
          : (() => {
              return selectedPoints
                ? [
                    {
                      text: `(${selectedPoints.size} selected points)`,
                      arrowcolor: "transparent",
                      bordercolor: "#c7c7c7",
                      bgcolor: "#fff",
                      xref: "paper",
                      yref: "paper",
                    },
                  ]
                : undefined;
            })(),
    };

    const config: Partial<Config> = {
      // Automatically resizes the plot when the window is resized.
      responsive: true,

      // Allows the user to move annotations (but just the tail and not the
      // whole thing).
      edits: { annotationTail: true },
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
    };

    const assignAnnotationPositions = (pointIndices: number[]) => {
      // Don't both doing the calculation if we're not going to show them.
      if (new Set(pointIndices).size > MAX_POINTS_TO_ANNOTATE) {
        return;
      }

      const fullLayout = (plot as any)._fullLayout;

      calcAnnotationPositions(x, y, pointIndices, fullLayout).forEach(
        ({ pointIndex, ax, ay }) => {
          annotationTails.current[`${xKey}-${yKey}-${pointIndex}`] = { ax, ay };
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
      // Add in shapes (y=x, regression lines) only after the plot has been
      // rendered. This prevents them from influencing the autorange
      // calculation.
      if (shapes !== plot.layout.shapes) {
        Plotly.update(plot, {}, { shapes });
        plot.layout.shapes = calcAutoscaleShapes(showIdentityLine, extents);
      }

      if (!axes.current.xaxis || !axes.current.yaxis) {
        axes.current = {
          xaxis: { ...plot.layout.xaxis, autorange: false },
          yaxis: { ...plot.layout.yaxis, autorange: false },
        };
      }

      moveSelectedPointsOnTopOfLines(plot);
    });

    on("plotly_relayout", () => {
      axes.current = {
        xaxis: { ...plot.layout.xaxis, autorange: false },
        yaxis: { ...plot.layout.yaxis, autorange: false },
      };

      plot.layout.annotations?.forEach((annotation) => {
        const { ax, ay } = annotation;

        if (ax != null && ay != null) {
          const { pointIndex } = annotation as any;
          annotationTails.current[`${xKey}-${yKey}-${pointIndex}`] = { ax, ay };
        }
      });
    });

    on("plotly_click", (e: PlotMouseEvent) => {
      const { pointIndex, curveNumber } = e.points[0];
      const anyModifier =
        e.event.ctrlKey || e.event.metaKey || e.event.shiftKey;

      const index = isContinuousCurve(curveNumber)
        ? contTraceIndex[pointIndex]
        : pointIndex;

      if (onClickPoint) {
        onClickPoint(index, anyModifier);
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
      if (selectedPoints && selectedPoints.size > 0) {
        onClickResetSelection();
      }
    });

    on("plotly_selected", (e: PlotSelectionEvent) => {
      const points =
        e?.points
          .filter(
            (p) => p.data.hoverinfo !== "skip" && p.data.hoverinfo !== "none"
          )
          .map((p) => {
            return isContinuousCurve(p.curveNumber)
              ? contTraceIndex[p.pointIndex]
              : p.pointIndex;
          }) || [];

      assignAnnotationPositions(points);
      onMultiselect(points);
    });

    on("plotly_deselect", () => {
      onClickResetSelection();
    });

    // WORKAROUND: Double-click is supposed to reset the zoom but it only works
    // actually intermittently so we'll do it ourselves.
    on("plotly_doubleclick", () => {
      zoom("reset");
    });

    // WORKAROUND: For some reason, autosize only works
    // with width so we'll calculate the height as well.
    on("plotly_autosize", () => {
      if (height === "auto") {
        const nextHeight = calcPlotHeight(plot);
        if (plot.layout.height !== nextHeight) {
          plot.layout.height = nextHeight;
          Plotly.redraw(plot);
        }
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

    plot.zoomIn = () => zoom("in");
    plot.zoomOut = () => zoom("out");
    plot.resetZoom = () => zoom("reset");

    plot.downloadImage = (options) => {
      if (!legendForDownload) {
        window.console.warn("`legendForDownload` is undefined");
        return;
      }

      // These dummy traces exist only to force Plotly to add a legend with the
      // correct colors (there is no good way of rendering our custom legend as
      // part of the exported image).
      const legendTraces = legendForDownload.items.map(({ name, hexColor }) => {
        return {
          ...templateTrace,
          showlegend: true,
          // HACK: Use a plot type of "indicator" rather than "scatter". This
          // prevents a rare bug where these dummy traces interfere with the
          // real ones and some points don't get rendered.
          type: "indicator",
          name,
          x: [null], // Data doesn't matter but can't be completely empty
          y: [null],
          marker: { ...templateTrace.marker, color: hexColor },
        };
      });

      const imagePlot = {
        ...plot,
        data: [...plot.data, ...legendTraces],
        layout: {
          ...plot.layout,
          shapes: calcPlotIndicatorLineShapes(
            showIdentityLine,
            regressionLines,
            extents,
            false
          ),
          showlegend: true,
          legend: {
            title: {
              text: legendForDownload.title,
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

    plot.yValueMissing = (pointIndex: number) => {
      return typeof data[yKey][pointIndex] !== "number";
    };

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener(eventName, callback)
      );
    };
  }, [
    data,
    xKey,
    yKey,
    colorKey1,
    colorKey2,
    categoricalColorKey,
    continuousColorKey,
    contLegendKeys,
    colorMap,
    xLabel,
    yLabel,
    legendForDownload,
    hoverTextKey,
    annotationTextKey,
    height,
    selectedPoints,
    onClickPoint,
    onMultiselect,
    onClickResetSelection,
    pointVisibility,
    dragmode,
    extents,
    showIdentityLine,
    regressionLines,
    outlineUnselectedPoints,
    customHoverinfo,
    hideXAxis,
    hideXAxisGrid,
    pointSize,
    pointOpacity,
    outlineWidth,
    palette,
    xAxisFontSize,
    yAxisFontSize,
    shapes,
    Plotly,
  ]);

  return <div className={styles.ScatterPlot} ref={ref} />;
}

export default function LazyPrototypeScatterPlot({
  data,
  ...otherProps
}: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        data ? (
          <PrototypeScatterPlot data={data} Plotly={Plotly} {...otherProps} />
        ) : null
      }
    </PlotlyLoader>
  );
}
