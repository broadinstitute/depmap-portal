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
import seedrandom from "seedrandom";
import { MAX_POINTS_TO_ANNOTATE } from "../../../../../constants/plotConstants";
import { usePlotlyLoader } from "../../../../../contexts/PlotlyLoaderContext";
import {
  calcAnnotationPositions,
  DataExplorerColorPalette,
  DEFAULT_PALETTE,
  getRange,
  hexToRgba,
  isEveryValueNull,
  LEGEND_ALL,
  LEGEND_OTHER,
  LegendKey,
  orderContinuousPointsByBin,
} from "./plotUtils";
import usePlotResizer from "./usePlotResizer";
import installGroupSelectionDragLayer, {
  GroupSelectionConfig,
} from "./groupSelectionDragLayer";
import type ExtendedPlotType from "../../../ExtendedPlotType";

type Data = Record<string, any>;

interface Props {
  data: Data;
  xKey: string;
  hoverTextKey?: string;
  annotationTextKey?: string;
  height: number | "auto";
  colorMap: Map<LegendKey, string>;
  // colorData: per-point color key. Drives bgcolor on scatter traces and
  // (in the converged case where modes match) violin fillcolor.
  colorData?: any;
  // groupData: per-point group key. Drives violin-track assignment. When
  // not supplied, falls back to colorData for backward compatibility with
  // existing callers and the converged case.
  groupData?: any;
  // groupKeys: track display order. When not supplied, derived from
  // [...colorMap.keys()] (which is the legend order under the old
  // single-array convention).
  groupKeys?: LegendKey[];
  continuousColorKey?: string;
  legendDisplayNames: Partial<Record<LegendKey, string>>;
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
  // When true, group tracks whose points are entirely null are kept as
  // labeled "(no data)" placeholders instead of being dropped. Used by
  // expanded plots so a paginated transcript window renders at full size even
  // when the dataset doesn't measure every transcript in the window.
  placeholderEmptyTracks?: boolean;
  // When true, box/lasso selection is replaced with a custom drag whose
  // marquee is confined to the violin track (group) it starts in, and cannot
  // escape into a neighbouring track. Shift adds to the selection within that
  // same locked track. See groupSelectionDragLayer.
  enforceSingleGroupSelection?: boolean;
  // The points to put text labels on. Diverges from `selectedPoints` only under
  // group_by === "expansion": there, `selectedPoints` re-expands a model to
  // every region it appears in, while this stays the handful of contacted
  // points (see useSelection's annotation channel). Falls back to
  // `selectedPoints` when omitted, so the labeled set is unchanged elsewhere.
  pointsToAnnotate?: Set<number>;
  // The count shown in the "N points selected" fallback when there are too many
  // to label. The wrapper threads selection.size (model count under collapse);
  // defaults to the selected-point count when omitted.
  selectionCount?: number;
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
  groupData,
  groupKeys: groupKeysProp,
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
  placeholderEmptyTracks = false,
  enforceSingleGroupSelection = false,
  pointsToAnnotate,
  selectionCount,
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

  useEffect(() => {
    const plot = ref.current;
    return () => {
      (plot as any)?.__groupSelCleanup?.();
      Plotly.purge(plot as HTMLElement);
    };
  }, [Plotly]);

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
    // Group side (drives track assignment). Falls back to color side when
    // not supplied, preserving existing behavior for callers that don't
    // distinguish group from color.
    const effectiveGroupData = groupData ?? colorData;
    // Annotate explicitly: the component params are typed `any` (see the
    // `}: any)` signature), so groupKeysProp/colorKeys arrive as `any` and the
    // downstream .map/.filter callbacks would otherwise be implicitly-any.
    // Pinning the element type here types the whole violin-trace chain.
    const effectiveGroupKeys: LegendKey[] = groupKeysProp ?? colorKeys;
    const x = data[xKey] as number[];
    const y = calcY(
      x,
      effectiveGroupKeys,
      effectiveGroupData,
      hiddenLegendValues
    );
    const text = hoverTextKey ? data[hoverTextKey] : null;
    const annotationText = annotationTextKey ? data[annotationTextKey] : null;
    const visible = pointVisibility ?? x.map(() => true);

    const contColorData = data[continuousColorKey];

    // Continuous color: order points so the smallest-population bins draw last
    // (on top) and null points on the bottom, matching PrototypeScatterPlot.
    // The reorder lives inside the single continuous trace, so contTraceIndex
    // maps a clicked/selected position back to the original point index. For
    // continuous color, colorData is already the per-point bin-key series.
    const contTraceIndex =
      contColorData && colorData
        ? orderContinuousPointsByBin(
            contColorData,
            colorData,
            colorMap,
            visible
          )
        : [];

    const hasColorOptionsEnabled = colorKeys[0] !== LEGEND_ALL;

    const isSelectionMode =
      dragmode === "select" ||
      dragmode === "lasso" ||
      (selectedPoints && selectedPoints.size > 0);

    // When enforceSingleGroupSelection is on and a select/lasso tool is active,
    // we keep Plotly's real selection running (it does the hit testing and the
    // selected-point rendering) but hide its marquee in favor of our custom,
    // band-clamped one, and constrain the committed result to the anchor group
    // (see the plotly_selected handler). So the real `dragmode` passes through.
    const useGroupSelection =
      enforceSingleGroupSelection &&
      (dragmode === "select" || dragmode === "lasso");
    const groupSelectionTool = dragmode === "lasso" ? "lasso" : "box";

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

    // Paint order for categorical color groups. We stack so the smallest
    // groups end up on top and the catch-all "Other" group on the bottom,
    // matching the scatter path (getSolidColorGroups). plotlyData is reversed
    // below, so the first key here is drawn last (on top): we sort ascending
    // by visible-point count and pin LEGEND_OTHER to the end. Membership and
    // color assignment are unchanged — this only reorders the traces, which
    // matters once color groups span multiple stacks (group_by !== color_by).
    const orderedColorKeys = (() => {
      if (!colorMap || !colorData) {
        return [] as LegendKey[];
      }
      const counts = new Map<LegendKey, number>();
      for (let i = 0; i < colorData.length; i += 1) {
        if (visible[i] === false) {
          continue;
        }
        const k = colorData[i] as LegendKey;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const keys = [...colorMap.keys()];
      const others = keys.filter((key) => key === LEGEND_OTHER);
      const rest = keys
        .filter((key) => key !== LEGEND_OTHER)
        .sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0));
      return [...rest, ...others];
    })();

    const colorTraces =
      colorMap && colorData && !contColorData
        ? orderedColorKeys.map((key) =>
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
          x: contTraceIndex.map((i) => (visible[i] ? x[i] : null)),
          y: contTraceIndex.map((i) => y[i]),
          text: text ? contTraceIndex.map((i) => text[i]) : text,
          // selectedpoints are indices into the (reordered) trace, so map each
          // selected original index to its position in contTraceIndex.
          selectedpoints: contTraceIndex.reduce(
            (acc: number[], origIndex, i) => {
              if (selectedPoints?.has(origIndex)) {
                acc.push(i);
              }
              return acc;
            },
            []
          ),
          hoverlabel: {
            bgcolor: contTraceIndex.map((i) => colorMap.get(colorData[i])),
          },
          marker: {
            size: pointSize,
            color: contTraceIndex.map(
              (i) => contColorData[i] ?? hexToRgba(palette.other, pointOpacity)
            ),
            colorscale: palette.sequentialScale.map(
              ([value, color]: [string, string]) => [
                value,
                hexToRgba(color, pointOpacity),
              ]
            ),
            line: {
              width: outlineWidth,
              color: contTraceIndex.map(
                (i) => contColorData[i] ?? palette.other
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

    const violinTraces = effectiveGroupKeys
      .filter((key) => !hiddenLegendValues.has(key))
      .map((legendKey, index) => {
        // In the converged case (group_by === color_by, default) the
        // group key IS a color key and lives in colorMap. In the divergent
        // case (group_by ≠ color_by) the group key may not be in colorMap;
        // fall back to a neutral fill so the violin is still drawn but
        // doesn't fight with the per-point colors that carry the legend.
        let fillcolor = colorMap.get(legendKey) ?? palette.other;

        if (useSemiOpaqueViolins) {
          fillcolor += "88";
        }

        return {
          ...templateViolin,
          // The "all" bucket is the ungrouped sentinel (a single track holding
          // every point); it carries no meaningful group label, so render it
          // blank rather than leaking the raw Symbol(All) into the y-axis tick.
          name:
            legendKey === LEGEND_ALL
              ? ""
              : legendDisplayNames[legendKey] ?? String(legendKey),
          x: effectiveGroupData
            ? x.filter(
                (_: any, i: number) => effectiveGroupData[i] === legendKey
              )
            : x,
          y0: effectiveGroupKeys.length - hiddenLegendValues.size - index,
          fillcolor,
        };
      })
      // A track whose points are entirely null normally gets dropped (an empty
      // violin is noise). But for expanded plots that drop is what makes a
      // paginated window look short: a transcript the dataset doesn't measure
      // is all-null. When `placeholderEmptyTracks` is set we instead keep it as
      // a labeled "(no data)" slot — its y0 position is already reserved, so it
      // just fills the gap the drop would have left. BANDAID tied to the
      // interim pagination stopgap.
      .map((trace) =>
        placeholderEmptyTracks && isEveryValueNull(trace.x)
          ? {
              ...trace,
              // Prepend, not append: the y-axis ticktext truncates each name to
              // ~25 chars and a transcript label alone already exceeds that, so
              // an appended marker gets cut off. Leading "(no data)" survives.
              name: trace.name ? `(no data) ${trace.name}` : "(no data)",
            }
          : trace
      )
      .filter((trace) => placeholderEmptyTracks || !isEveryValueNull(trace.x));

    // Add an extra violin with a light outline to make
    // it stand out on top many dark-colored points.
    const violinOutlineTraces = effectiveGroupKeys
      .filter((key) => !hiddenLegendValues.has(key))
      .map((legendKey, index) => {
        return {
          ...templateViolin,
          line: { color: hexToRgba("#fff", 0.5), width: 4 },
          meanline: { visible: false },
          fillcolor: "transparent",
          x: effectiveGroupData
            ? x.filter(
                (_: any, i: number) => effectiveGroupData[i] === legendKey
              )
            : x,
          y0: effectiveGroupKeys.length - hiddenLegendValues.size - index,
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

    // The continuous trace is the only one whose points are reordered, so its
    // plotly pointIndex must be mapped back through contTraceIndex.
    const isContinuousCurve = (n: number) =>
      continuousColorTrace !== null &&
      (plotlyData[n] as any) === continuousColorTrace;

    const collapseLeftMargin = violinTraces.length === 1;

    // Annotation channel (expansion-selection): label precisely the contacted
    // points, not the re-expanded `selectedPoints`. They coincide off the
    // group_by === "expansion" collapse, so this is a no-op there; the fallback
    // keeps callers that don't pass the set (e.g. the scatter path) unchanged.
    const pointsForAnnotation = pointsToAnnotate ?? selectedPoints;
    // Count for the "too many to label" fallback. selectionCount is the model
    // count under collapse (selection.size, threaded from the wrapper). TODO:
    // the noun "point(s)" should become the index type's display name (e.g.
    // "model(s)") once that is threaded through; literal for now.
    const annotationCount = selectionCount ?? selectedPoints?.size ?? 0;

    const layout: Partial<Layout> = {
      height: height === "auto" ? calcPlotHeight(plot) : height,
      margin: {
        t: 30,
        r: 15,
        b: 50 + xAxisFontSize * 2.2,
        l: collapseLeftMargin ? 15 : 50 + yAxisFontSize * 2.2,
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
          Boolean(effectiveGroupData) &&
          effectiveGroupData.length > 0 &&
          violinTraces.length < 40,
        automargin: true,
        tickvals: violinTraces.map((vt) => vt.y0),
        ticktext: violinTraces.map((vt) => truncate(vt.name)),
        tickfont: { size: yAxisFontSize },
      },

      dragmode,

      // enforceSingleGroupSelection: a thin band sweep is mostly-horizontal,
      // which Plotly's default selectdirection "any" auto-reads as an "h"
      // (full-y-axis) selection — spanning every band and bypassing the pointer
      // clamp, since Plotly sets that span programmatically. Force diagonal-only
      // ("d") so every box stays an ordinary drag-cornered rectangle; the
      // interceptor then clamps its height to the anchor band.
      selectdirection: useGroupSelection ? "d" : "any",

      annotations:
        annotationText &&
        pointsForAnnotation &&
        pointsForAnnotation.size <= MAX_POINTS_TO_ANNOTATE
          ? [...pointsForAnnotation]
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
                      x: 0.5,
                      y: 0.95,
                      xref: "paper",
                      yref: "paper",
                      text: [
                        annotationCount,
                        annotationCount === 1 ? "point" : "points",
                        "selected",
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

    // enforceSingleGroupSelection: hand the live config to the custom drag
    // layer and (re)install it. The config is read on each mousedown, so it
    // stays current across effect re-runs. Switching tool or toggling the mode
    // off resets the additive (shift-select) state; benign re-renders keep it.
    {
      const prev = (plot as any).__groupSel as GroupSelectionConfig | undefined;
      const resetAdditive =
        !prev ||
        prev.tool !== groupSelectionTool ||
        prev.enabled !== useGroupSelection;

      if (prev && resetAdditive) {
        prev.committedShapes = [];
        prev.selectionRegionKey = null;
      }

      (plot as any).__groupSel = {
        enabled: useGroupSelection,
        tool: groupSelectionTool,
        axis: "y",
        // Groups here are violin tracks at integer y0s. The waterfall uses the
        // same drag layer with a "ranges" model on the x-axis; both rely on
        // groupSelectionDragLayer's shared l2p + axis._offset conversion to map
        // region bounds to exact on-screen pixels (see axisOffset there).
        regionModel: {
          kind: "violinTracks",
          validKeys: new Set<number>(
            violinTraces.map((vt) => vt.y0 as number)
          ),
        },
        committedShapes: resetAdditive ? [] : prev!.committedShapes,
        selectionRegionKey: resetAdditive ? null : prev!.selectionRegionKey,
      } as GroupSelectionConfig;

      installGroupSelectionDragLayer(plot as any);
    }

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

    plot.annotateSelected = (points?: number[]) => {
      // Position annotation tails for the given points (the context path passes
      // its representative points; selection + annotation state is already set
      // by setSelectionFromContext). Falls back to the current selection when
      // called with no argument. No longer commits a selection of its own —
      // that "annotate == select" coupling is now split into the two channels.
      const pts = points ?? (selectedPoints ? [...selectedPoints] : []);
      assignAnnotationPositions(pts);
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
      // A zoom/resize invalidates the pixel-space committed marquees, so drop
      // the additive (shift-select) state along with the stored axes.
      const cfg = (plot as any).__groupSel as GroupSelectionConfig | undefined;
      if (cfg) {
        cfg.committedShapes = [];
        cfg.selectionRegionKey = null;
      }

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
        onClickPoint(
          isContinuousCurve(curveNumber)
            ? contTraceIndex[pointIndex]
            : pointIndex,
          anyModifier
        );
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

    on("plotly_selecting", (e: PlotSelectionEvent) => {
      if (selectedPoints?.size > 0) {
        onClickResetSelection();
      }

      // enforceSingleGroupSelection (density): the band anchor is deferred until
      // the drag box first touches a point (groupSelectionDragLayer leaves
      // selectionRegionKey null on a fresh violin drag). Lock it here to the
      // band of the first contacted point nearest the drag start; from then on
      // the interceptor confines the box to that band.
      //
      // Known limitation (deliberate trade-off): the interceptor clamps the live
      // pointer to the band but does not re-pin Plotly's anchor corner (the
      // mousedown position). So a drag going UPWARD from a start below the
      // resolved violin can momentarily render a box that spans into the
      // neighbour above. Re-pinning the anchor would mean rewriting Plotly's
      // in-progress drag start — invasive, and not worth losing the simple
      // "clamp the pointer" model we settled on, especially for a gesture this
      // uncommon. It is purely a visual artifact: plotly_selected filters the
      // committed points to the anchor band on mouse up, so the selection itself
      // is always unambiguous and its integrity is unaffected.
      if (!useGroupSelection) {
        return;
      }
      const cfg = (plot as any).__groupSel as GroupSelectionConfig | undefined;
      if (
        !cfg ||
        cfg.regionModel.kind !== "violinTracks" ||
        cfg.selectionRegionKey != null || // already resolved (or shift-locked)
        !e?.points?.length // no contact yet — still traversing a gap
      ) {
        return;
      }
      const startY = (plot as any).__groupSelStartCoord as number | undefined;
      let bestBand: number | null = null;
      let bestDist = Infinity;
      e.points.forEach((p) => {
        if (p.data.hoverinfo === "skip" || p.data.hoverinfo === "none") {
          return;
        }
        const origIndex = isContinuousCurve(p.curveNumber)
          ? contTraceIndex[p.pointIndex]
          : p.pointIndex;
        const dist = startY == null ? 0 : Math.abs(y[origIndex] - startY);
        if (dist < bestDist) {
          bestDist = dist;
          bestBand = Math.round(y[origIndex]);
        }
      });
      if (bestBand != null) {
        cfg.selectionRegionKey = bestBand;
      }
    });

    on("plotly_selected", (e: PlotSelectionEvent) => {
      let points =
        e?.points
          .filter(
            (p) => p.data.hoverinfo !== "skip" && p.data.hoverinfo !== "none"
          )
          .map((p) =>
            isContinuousCurve(p.curveNumber)
              ? contTraceIndex[p.pointIndex]
              : p.pointIndex
          ) || [];

      // enforceSingleGroupSelection: Plotly hit-tests across the whole plot, so
      // drop any selected points that aren't in the track the drag was anchored
      // to. A point's track is round(y) (points jitter < 0.5 from their center).
      if (useGroupSelection) {
        const anchorY0 = (plot as any).__groupSel?.selectionRegionKey as
          | number
          | null;
        if (anchorY0 != null) {
          points = points.filter((i) => Math.round(y[i]) === anchorY0);
        }
      }

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
            title: { text: legendTitle },
            font: { size: 14 },
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
        plot.removeListener?.(eventName, callback)
      );
    };
  }, [
    data,
    xKey,
    colorMap,
    colorData,
    groupData,
    groupKeysProp,
    continuousColorKey,
    legendDisplayNames,
    legendTitle,
    hoverTextKey,
    annotationTextKey,
    height,
    selectedPoints,
    pointsToAnnotate,
    selectionCount,
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
    placeholderEmptyTracks,
    enforceSingleGroupSelection,
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
