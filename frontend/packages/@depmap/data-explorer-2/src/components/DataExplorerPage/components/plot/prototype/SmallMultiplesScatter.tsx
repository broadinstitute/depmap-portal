/* eslint-disable react/require-default-props */
// SmallMultiplesScatter
//
// The faceted ("small multiples") rendering of the scatter plot — the 2D
// realization of group_by, sibling to PrototypeScatterPlot. Built as a single
// plotly figure with a grid of subplots: one panel per facet, ranges shared
// across panels via axis `matches`.
//
// It takes the SAME props as PrototypeScatterPlot (the `formattedData` lookup
// plus key names, colorMap, palette, handlers) and adds `facetKeys`
// (per-point facet identity — e.g. findCategoricalSlice(data,"expansion").
// values) and `facetOrder`. So the eventual wrapper dispatch is the existing
// prop block plus those two.
//
// Point encoding mirrors PrototypeScatterPlot: every trace carries the
// full-length arrays with non-member points nulled, and `selectedpoints` uses
// global indices. That keeps selection faceting-agnostic and makes
// plotly_click / plotly_selected report global indices with no remap. Color
// grouping comes from the shared getSolidColorGroups() seam.
//
// Deliberately deferred for this first cut (each a focused follow-up, flagged
// rather than half-built):
//   - Continuous color keeps no on-top re-sort: one colorscale trace per facet
//     in natural order. Drops the contTraceIndex remap (and the index-mangling
//     it caused); the cost is dense bins may overdraw sparse ones within a
//     panel, which faceting already mitigates.
//   - Regression lines (per-facet fit). Identity lines are now supported (see
//     the showIdentityLine prop): per-subplot shapes injected after autorange,
//     with a master-only autoscale hack propagated across panels via `matches`.
//   - The imperative handle's extended methods (annotateSelected / download
//     image). onLoad still fires with the single figure node.
import React, { useEffect, useRef, useState } from "react";
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
  calcAutoscaleShapes,
  calcPlotIndicatorLineShapes,
  DataExplorerColorPalette,
  DEFAULT_PALETTE,
  facetMaskFor,
  getRange,
  getSolidColorGroups,
  hexToRgba,
  LegendKey,
  orderContinuousPointsByBin,
  RegressionLine,
} from "./plotUtils";
import usePlotResizer from "./usePlotResizer";
import type ExtendedPlotType from "../../../ExtendedPlotType";
import styles from "../../../styles/ScatterPlot.scss";

type Data = Record<string, any>;

interface Props {
  data: Data;
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  // Per-point facet identity, length matches data[xKey]. For the expansion
  // case this is the per-point expansion label.
  facetKeys: string[];
  // Explicit facet identity/order; defaults to first-seen order of facetKeys.
  facetOrder?: string[];
  height: number | "auto";
  hoverTextKey?: string;
  annotationTextKey?: string;
  colorKey1?: string;
  colorKey2?: string;
  categoricalColorKey?: string;
  continuousColorKey?: string;
  // Per-point bin-key series for continuous color (LEGEND_RANGE_*), parallel to
  // the continuous values. Supplied by the caller (e.g. useScatterPlotData) so
  // continuous points can stack by bin like PrototypeScatterPlot.
  contLegendKeys?: LegendKey[] | null;
  colorMap: Map<LegendKey, string>;
  selectedPoints?: Set<number>;
  pointVisibility?: boolean[];
  onClickPoint?: (pointIndex: number, anyModifier: boolean) => void;
  onMultiselect?: (pointIndices: number[]) => void;
  onClickResetSelection?: () => void;
  onLoad?: (plot: ExtendedPlotType) => void;
  pointSize?: number;
  pointOpacity?: number;
  outlineWidth?: number;
  palette?: DataExplorerColorPalette;
  xAxisFontSize?: number;
  yAxisFontSize?: number;
  // Per-point selection annotations are off by default for faceted plots:
  // tiled across small panels they clutter fast, and the panel title plus
  // the selection panel already carry identity. Set > 0 to re-enable a cap.
  maxAnnotations?: number;
  // Draw the x = y identity line in every panel. Off by default (current
  // faceted behavior). When on, a master-only autoscale hack equalizes the x/y
  // scale and propagates to all panels via `matches`, so the line reads ~45°
  // everywhere; the line itself is injected per subplot after autorange.
  showIdentityLine?: boolean;
  // Per-facet regression lines keyed by facet label (from useScatterPlotData).
  // Each panel draws its own; a facet with no entry draws none.
  regressionLinesByFacet?: Map<string, RegressionLine> | null;
  // When true, a facet with no plottable point is kept as an empty panel
  // labeled "(no data)" rather than dropped. Used by expanded plots so a
  // paginated transcript window keeps its full set of panels even when the
  // dataset doesn't measure every transcript.
  placeholderEmptyFacets?: boolean;
}

type PlotlyType = typeof Plotly;
type PropsWithPlotly = Props & { Plotly: PlotlyType };

const GAP_X = 0.06;
const GAP_Y = 0.1;

function SmallMultiplesScatter({
  data,
  xKey,
  yKey,
  xLabel,
  yLabel,
  facetKeys,
  facetOrder,
  height,
  hoverTextKey,
  annotationTextKey,
  colorKey1,
  colorKey2,
  categoricalColorKey,
  continuousColorKey,
  contLegendKeys,
  colorMap,
  selectedPoints,
  pointVisibility,
  onClickPoint = () => {},
  onMultiselect = () => {},
  onClickResetSelection = () => {},
  onLoad = () => {},
  pointSize = 7,
  pointOpacity = 1,
  outlineWidth = 0.5,
  palette = DEFAULT_PALETTE,
  xAxisFontSize = 12,
  yAxisFontSize = 12,
  maxAnnotations = 0,
  showIdentityLine = false,
  regressionLinesByFacet,
  placeholderEmptyFacets = false,
  Plotly,
}: PropsWithPlotly) {
  const ref = useRef<(HTMLDivElement & ExtendedPlotType) | null>(null);
  usePlotResizer(Plotly, ref);

  // Dragmode is React state, not just plotly's internal layout, so every
  // Plotly.react re-applies the *current* mode. The hidden modebar means
  // setDragmode (below) is the only way it changes; driving it imperatively
  // would get clobbered the next time the effect re-reacts (e.g. after a
  // click updates the selection), flipping the mode back and desyncing the
  // custom toolbar. Matches PrototypeScatterPlot.
  const [dragmode, setDragmode] = useState<Layout["dragmode"]>("zoom");

  // Master axis ranges, preserved across re-reacts so that changing dragmode
  // (or selecting) doesn't snap the zoom back to full extent. Every non-
  // master axis uses `matches`, so only the master ("xaxis"/"yaxis") pair
  // carries a range and the rest follow it. Mirrors PrototypeScatterPlot.
  const axes = useRef<{
    xaxis?: { range?: number[]; autorange: boolean };
    yaxis?: { range?: number[]; autorange: boolean };
  }>({});
  // Identity of the data currently on the axes. When it changes (a new x/y
  // dataset), the preserved zoom is dropped so the plot re-autoranges.
  const lastDataset = useRef<string | null>(null);

  useEffect(() => {
    // Capture the node now; ref.current may have changed by the time this
    // cleanup runs (react-hooks/exhaustive-deps).
    const node = ref.current;
    return () => {
      if (node) {
        Plotly.purge(node as HTMLElement);
      }
    };
  }, [Plotly]);

  useEffect(() => {
    const plot = ref.current;
    if (!plot) {
      return undefined;
    }

    // Reset the preserved zoom when an axis's dataset changes. The axis label
    // is the signal: coloring, grouping, selection, and dragmode don't change
    // it (so those keep the current zoom), but swapping the x/y dataset does.
    const datasetKey = `${xLabel}\u0000${yLabel}`;
    if (lastDataset.current !== datasetKey) {
      axes.current = {};
      lastDataset.current = datasetKey;
    }

    const x = data[xKey] as (number | null)[];
    const y = data[yKey] as (number | null)[];
    const text = hoverTextKey
      ? (data[hoverTextKey] as string[])
      : x.map(() => "");
    const annotationText = annotationTextKey
      ? (data[annotationTextKey] as string[])
      : x.map((_, i) => `${x[i]?.toFixed(2)}, ${y[i]?.toFixed(2)}`);
    const visible = pointVisibility ?? x.map(() => true);

    const color1 = colorKey1 ? (data[colorKey1] as (boolean | null)[]) : null;
    const color2 = colorKey2 ? (data[colorKey2] as (boolean | null)[]) : null;
    const catColorData = categoricalColorKey
      ? (data[categoricalColorKey] as (string | number | null)[])
      : null;
    const contColorData = continuousColorKey
      ? (data[continuousColorKey] as (number | null)[])
      : null;

    const selected = selectedPoints ?? new Set<number>();
    const selectedpoints = [...selected];

    // Candidate facets, then drop any with no plottable point at all (every
    // point null on an axis). This is the legend's non-plottable-entity rule
    // applied to facet selection: a facet that can never render shouldn't
    // hold a slot. Deliberately ignores visibility — a facet hidden only by a
    // legend toggle still has plottable data, so it's kept (and renders empty
    // for now; the toggled-off placeholder is handled separately).
    const candidateFacets = facetOrder ?? Array.from(new Set(facetKeys));
    const plottableFacets = new Set<string>();
    const visibleFacets = new Set<string>();
    for (let i = 0; i < x.length; i += 1) {
      if (x[i] !== null && y[i] !== null) {
        plottableFacets.add(facetKeys[i]);
        if (visible[i]) {
          visibleFacets.add(facetKeys[i]);
        }
      }
    }
    const facets = placeholderEmptyFacets
      ? candidateFacets
      : candidateFacets.filter((f) => plottableFacets.has(f));
    const F = facets.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(F)));
    const rows = Math.max(1, Math.ceil(F / cols));

    // Shared extents across all points (mirrors PrototypeScatterPlot). Every
    // panel shares one range via `matches`, so the identity line and the
    // autoscale hack are computed once from these.
    const [minX, maxX] = getRange(x as number[]);
    const [minY, maxY] = getRange(y as number[]);
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const ratio = Math.min(rangeX, rangeY) / Math.max(rangeX, rangeY);
    const extents = { minX, maxX, minY, maxY, rangeX, rangeY, ratio };

    const resolvedHeight =
      typeof height === "number"
        ? height
        : plot.clientHeight || plot.parentElement?.clientHeight || 600;

    const layout: Record<string, any> = {
      height: resolvedHeight,
      margin: { t: 28, r: 16, b: 60, l: 68 },
      showlegend: false,
      hovermode: "closest",
      dragmode,
      annotations: [] as any[],
      // Master-only autoscale hack: equalizes x/y scale so the identity line is
      // ~45°, propagating to matched panels. Returns [] when showIdentityLine is
      // off, so default behavior is unchanged. The visible indicator shapes are
      // injected post-autorange (see plotly_afterplot).
      shapes: calcAutoscaleShapes(showIdentityLine, extents),
    };

    const plotlyData: Partial<PlotData>[] = [];

    // Color grouping is facet-independent, so resolve it once. Continuous color
    // is handled separately (see below), so skip the seam in that case.
    const solidGroups = contColorData
      ? null
      : getSolidColorGroups({
          color1,
          color2,
          catColorData,
          colorMap,
          palette,
          visible,
        });

    // The mask shared by every trace: a point is plottable in facet `facet`
    // only if it's visible, in that facet, and has values on both axes.
    const maskFor = (facet: string, member: (i: number) => boolean) => {
      const inFacet = facetMaskFor(facetKeys, facet, x, y, visible);
      return (i: number) => (inFacet(i) ? member(i) : false);
    };

    // Maps a continuous trace's curveNumber to its bin-stacked draw order, so
    // click/select can map a reordered pointIndex back to the original index.
    // Only continuous traces are reordered; every other trace stays in natural
    // (global-index) order, so they're simply absent from this map.
    const contOrderByCurve = new Map<number, number[]>();

    facets.forEach((facet, k) => {
      const col = k % cols;
      const row = Math.floor(k / cols);

      const xDomain: [number, number] = [
        col / cols + (col === 0 ? 0 : GAP_X / 2),
        (col + 1) / cols - (col === cols - 1 ? 0 : GAP_X / 2),
      ];
      const yTop = 1 - row / rows;
      const yBot = 1 - (row + 1) / rows;
      const yDomain: [number, number] = [yBot + GAP_Y / 2, yTop - GAP_Y / 2];

      const suffix = k === 0 ? "" : String(k + 1);
      const xRef = `x${suffix}`;
      const yRef = `y${suffix}`;

      // A selection lives in exactly one facet, so only that panel should dim
      // its unselected points; the others stay at full opacity.
      const facetHasSelection = selectedpoints.some(
        (i) => facetKeys[i] === facet
      );

      // A facet kept by the plottable check above but with no currently
      // visible point is hidden by a legend toggle (e.g. coloring AND
      // grouping by expansion, then toggling a transcript off). Keep its
      // slot so the grid stays stable, but mark it so the empty frame reads
      // as intentional rather than a rendering bug. (A facet with no
      // plottable data at all was already dropped, so this is toggle-only.)
      const facetNoData = !plottableFacets.has(facet);
      const facetHidden = !facetNoData && !visibleFacets.has(facet);

      layout[`xaxis${suffix}`] = {
        domain: xDomain,
        anchor: yRef,
        matches: k === 0 ? undefined : "x",
        tickfont: { size: Math.max(8, xAxisFontSize - 3) },
        exponentformat: "e",
        zeroline: false,
        // Only the master carries a range; matched axes follow it.
        ...(k === 0 ? axes.current.xaxis ?? { autorange: true } : {}),
      };
      layout[`yaxis${suffix}`] = {
        domain: yDomain,
        anchor: xRef,
        matches: k === 0 ? undefined : "y",
        tickfont: { size: Math.max(8, yAxisFontSize - 3) },
        exponentformat: "e",
        zeroline: false,
        ...(k === 0 ? axes.current.yaxis ?? { autorange: true } : {}),
      };

      // Bottom of the stack: the selection-outline trace (a larger, dark-ringed
      // transparent marker that peeks out from behind selected points).
      const outlineMask = maskFor(facet, () => true);
      plotlyData.push({
        type: "scattergl",
        mode: "markers",
        xaxis: xRef,
        yaxis: yRef,
        x: x.map((v, i) => (outlineMask(i) ? v : null)),
        y: y.map((v, i) => (outlineMask(i) ? v : null)),
        name: "",
        hoverinfo: "skip",
        showlegend: false,
        selectedpoints,
        marker: {
          color: "transparent",
          size: pointSize + outlineWidth * 2,
          line: { color: "#000", width: Math.max(outlineWidth, 2) },
        },
        selected: { marker: { opacity: 1 } },
        unselected: { marker: { opacity: 0 } },
      } as Partial<PlotData>);

      const pushSolid = (color: string, member: (i: number) => boolean) => {
        const mask = maskFor(facet, member);
        plotlyData.push({
          type: "scattergl",
          mode: "markers",
          xaxis: xRef,
          yaxis: yRef,
          x: x.map((v, i) => (mask(i) ? v : null)),
          y: y.map((v, i) => (mask(i) ? v : null)),
          text,
          name: "",
          hoverinfo: "x+y+text",
          hoverlabel: { bgcolor: color },
          showlegend: false,
          selectedpoints,
          marker: {
            color: hexToRgba(color, pointOpacity),
            size: pointSize,
            line: { color, width: outlineWidth },
          },
          selected: { marker: { opacity: 1 } },
          unselected: { marker: { opacity: facetHasSelection ? 0.5 : 1 } },
        } as Partial<PlotData>);
      };

      if (contColorData) {
        // Continuous: the "other" (null-valued) points first (bottom), then one
        // colorscale trace whose points are ordered so this facet's
        // smallest-population bins draw last (on top), matching
        // PrototypeScatterPlot. The order is computed from this facet's visible
        // points (outlineMask) so each panel stacks by its own populations.
        // Because the points are reordered, we record the order under the
        // trace's curveNumber so click/select can map back to original indices.
        pushSolid(palette.other, (i) => contColorData[i] === null);

        const contMask = maskFor(facet, (i) => contColorData[i] !== null);
        // Count basis must match PrototypeScatterPlot, which counts plain
        // `visible` with no plottability check. facetMaskFor (via outlineMask)
        // also requires x/y non-null, which would drop visible-but-unplottable
        // points from the per-facet bin counts and can flip the stacking order
        // wherever two bins have near-equal populations.
        const facetVisible = x.map(
          (_, i) => visible[i] && facetKeys[i] === facet
        );
        const order =
          contLegendKeys && colorMap
            ? orderContinuousPointsByBin(
                contColorData,
                contLegendKeys,
                colorMap,
                facetVisible
              )
            : x.map((_, i) => i);

        contOrderByCurve.set(plotlyData.length, order);
        plotlyData.push({
          type: "scattergl",
          mode: "markers",
          xaxis: xRef,
          yaxis: yRef,
          x: order.map((i) => (contMask(i) ? x[i] : null)),
          y: order.map((i) => (contMask(i) ? y[i] : null)),
          text: text ? order.map((i) => text[i]) : text,
          name: "",
          hoverinfo: "x+y+text",
          showlegend: false,
          selectedpoints: order.reduce((acc: number[], origIndex, i) => {
            if (selected.has(origIndex)) {
              acc.push(i);
            }
            return acc;
          }, []),
          // Per-point hover background keyed to each point's bin color (in the
          // reordered draw order), matching PrototypeScatterPlot. Without this
          // the continuous trace's hover box falls back to Plotly's default
          // black; only the separate "other" trace (via pushSolid) was colored.
          hoverlabel: {
            bgcolor: order.map(
              (i) =>
                (contLegendKeys
                  ? colorMap.get(contLegendKeys[i])
                  : undefined) ?? palette.other
            ) as any,
          },
          marker: {
            size: pointSize,
            color: order.map((i) => contColorData[i] ?? "transparent"),
            colorscale: palette.sequentialScale.map(([value, color]) => [
              value,
              hexToRgba(color as string, pointOpacity),
            ]),
            line: {
              width: outlineWidth,
              color: order.map((i) => contColorData[i] ?? "transparent"),
              colorscale: palette.sequentialScale,
            },
          },
          selected: { marker: { opacity: 1 } },
          unselected: { marker: { opacity: facetHasSelection ? 0.5 : 1 } },
        } as Partial<PlotData>);
      } else {
        // Solid color groups (none / categorical / comparison), in paint order.
        (solidGroups ?? []).forEach((group) =>
          pushSolid(group.color, group.includes)
        );
      }

      // Facet title (paper-positioned, centered above the panel).
      (layout.annotations as any[]).push({
        text: facet,
        x: (xDomain[0] + xDomain[1]) / 2,
        y: yTop - GAP_Y / 2 + 0.012,
        xref: "paper",
        yref: "paper",
        xanchor: "center",
        yanchor: "bottom",
        showarrow: false,
        font: {
          size: 11,
          color: facetHidden || facetNoData ? "#999" : undefined,
        },
      });

      // No data for this facet in the chosen dataset: an inert "(no data)"
      // placeholder over the empty panel, so the page keeps its full set of
      // panels and the gap is explained rather than silently missing.
      if (facetNoData) {
        (layout.annotations as any[]).push({
          text: "(no data)",
          x: (xDomain[0] + xDomain[1]) / 2,
          y: (yDomain[0] + yDomain[1]) / 2,
          xref: "paper",
          yref: "paper",
          xanchor: "center",
          yanchor: "middle",
          showarrow: false,
          font: { size: 12, color: "#999" },
        });
      }

      // Toggled-off facet: an inert placeholder over the (empty) panel.
      if (facetHidden) {
        (layout.annotations as any[]).push({
          text: "(hidden)",
          x: (xDomain[0] + xDomain[1]) / 2,
          y: (yDomain[0] + yDomain[1]) / 2,
          xref: "paper",
          yref: "paper",
          xanchor: "center",
          yanchor: "middle",
          showarrow: false,
          font: { size: 12, color: "#999" },
        });
      }
    });

    // Selected-point annotations, placed on their own facet's axes. Above the
    // per-facet cap we fall back to a single count, mirroring the single-panel
    // plot.
    // One shared title per axis, centered along the grid's bottom and left
    // edges, instead of repeating a title on every bottom/left subplot. The
    // shifts push each into its margin; tune with the margins above.
    (layout.annotations as any[]).push(
      {
        text: xLabel,
        x: 0.5,
        y: 0,
        xref: "paper",
        yref: "paper",
        yshift: -44,
        xanchor: "center",
        yanchor: "bottom",
        showarrow: false,
        font: { size: xAxisFontSize },
      },
      {
        text: yLabel,
        x: 0,
        y: 0.5,
        xref: "paper",
        yref: "paper",
        xshift: -54,
        xanchor: "center",
        yanchor: "middle",
        textangle: -90,
        showarrow: false,
        font: { size: yAxisFontSize },
      }
    );

    const facetIndex = new Map(facets.map((f, i) => [f, i]));
    if (
      maxAnnotations > 0 &&
      selected.size > 0 &&
      selected.size <= maxAnnotations
    ) {
      [...selected].forEach((pointIndex) => {
        if (
          typeof x[pointIndex] !== "number" ||
          typeof y[pointIndex] !== "number"
        ) {
          return;
        }
        const k = facetIndex.get(facetKeys[pointIndex]);
        if (k === undefined) {
          return;
        }
        const suffix = k === 0 ? "" : String(k + 1);
        (layout.annotations as any[]).push({
          x: x[pointIndex],
          y: y[pointIndex],
          text: annotationText[pointIndex],
          visible: visible[pointIndex],
          xref: `x${suffix}`,
          yref: `y${suffix}`,
          arrowhead: 0,
          standoff: 4,
          arrowcolor: "#888",
          bordercolor: "#c7c7c7",
          bgcolor: "#fff",
        });
      });
    } else if (maxAnnotations > 0 && selected.size > maxAnnotations) {
      (layout.annotations as any[]).push({
        text: `(${selected.size} selected points)`,
        xref: "paper",
        yref: "paper",
        x: 1,
        y: 1,
        showarrow: false,
        bordercolor: "#c7c7c7",
        bgcolor: "#fff",
      });
    }

    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d"],
    };

    Plotly.react(plot, plotlyData, layout as Partial<Layout>, config);

    // Capture the master ranges Plotly computed on first render, so later
    // re-reacts restore them rather than re-autoranging.
    if (!axes.current.xaxis || !axes.current.yaxis) {
      axes.current = {
        xaxis: { range: (plot.layout as any).xaxis?.range, autorange: false },
        yaxis: { range: (plot.layout as any).yaxis?.range, autorange: false },
      };
    }

    // Convenience methods the plot controls call on the figure node (the
    // modebar is hidden, so these are the only way to drive it). It's one
    // figure with `matches`-shared axes, so dragmode/zoom act on the whole
    // grid at once.
    const getButton = (attr: string, val: string) =>
      plot.querySelector(
        `.modebar-btn[data-attr="${attr}"][data-val="${val}"]`
      ) as HTMLAnchorElement | null;
    const zoom = (val: "in" | "out" | "reset") =>
      getButton("zoom", val)?.click();

    plot.setDragmode = (nextDragmode) => {
      const resetting =
        dragmode !== nextDragmode &&
        (nextDragmode === "select" || nextDragmode === "lasso");
      if (resetting && onClickResetSelection) {
        onClickResetSelection();
      }
      setDragmode(nextDragmode);
    };
    plot.resetZoom = () => zoom("reset");
    plot.zoomIn = () => zoom("in");
    plot.zoomOut = () => zoom("out");
    plot.downloadImage = (options) => {
      // First cut: plain figure export. Embedding the external legend (the
      // single-panel plot's dummy-trace hack) is deferred.
      Plotly.downloadImage(plot, options as any);
    };
    // Faceted: navigating-to-a-point and per-point annotations are off for
    // now, so these are safe stubs that keep the controls from throwing.
    plot.isPointInView = () => true;
    plot.xValueMissing = (pointIndex: number) => x[pointIndex] === null;
    plot.yValueMissing = (pointIndex: number) => y[pointIndex] === null;
    plot.annotateSelected = () => {};
    plot.removeAnnotations = () => {};

    if (onLoad) {
      onLoad(plot);
    }

    // Per-facet indicator shapes: the identity line (same in every panel) plus
    // this panel's regression line, if one was fit (regressionLinesByFacet).
    // The shared `extents` is identical across panels (ranges linked by
    // `matches`); only the subplot refs and per-facet slope/intercept differ.
    // Built here, injected after autorange settles (below).
    const indicatorShapes: NonNullable<Layout["shapes"]> = [];
    if (showIdentityLine || regressionLinesByFacet) {
      for (let k = 0; k < facets.length; k += 1) {
        const suffix = k === 0 ? "" : String(k + 1);
        const facetLine = regressionLinesByFacet?.get(facets[k]) ?? null;
        indicatorShapes.push(
          ...(calcPlotIndicatorLineShapes(
            showIdentityLine,
            facetLine ? [facetLine] : null,
            extents,
            true,
            { xref: `x${suffix}`, yref: `y${suffix}` }
          ) ?? [])
        );
      }
    }

    const listeners: [string, (e: any) => void][] = [];
    const on = (name: string, cb: (e: any) => void) => {
      listeners.push([name, cb]);
      plot.on(
        name as Parameters<PlotlyHTMLElement["on"]>[0],
        cb as Parameters<PlotlyHTMLElement["on"]>[1]
      );
    };

    // Re-inject indicator shapes AFTER autorange has settled, so their
    // over-length endpoints can't perturb the computed ranges. We then reset
    // the layout's base shapes to the autoscale hack so it — not the
    // over-length lines — feeds any later autorange.
    //
    // This must run on EVERY afterplot, not just the first: a later redraw
    // (notably a window resize, which usePlotResizer services via
    // Plotly.Plots.resize) repaints from those indicator-less base shapes and
    // would otherwise drop the identity/regression lines. Re-asserting here
    // puts them back; Plotly de-dupes the no-op repeats when nothing changed,
    // so it doesn't loop. Mirrors PrototypeScatterPlot's handling.
    on("plotly_afterplot", () => {
      if (
        indicatorShapes.length === 0 ||
        (plot.layout as any).shapes === indicatorShapes
      ) {
        return;
      }
      Plotly.update(plot, {}, { shapes: indicatorShapes });
      (plot.layout as any).shapes = calcAutoscaleShapes(
        showIdentityLine,
        extents
      );
    });

    on("plotly_click", (e: PlotMouseEvent) => {
      const pt = e.points[0];
      if (!pt) {
        return;
      }
      const native = e.event as MouseEvent;
      const anyModifier = native.ctrlKey || native.metaKey || native.shiftKey;
      const order = contOrderByCurve.get(pt.curveNumber as number);
      const index = order
        ? order[pt.pointIndex as number]
        : (pt.pointIndex as number);
      onClickPoint(index, anyModifier);
    });

    on("plotly_selecting", () => {
      if (selected.size > 0) {
        onClickResetSelection();
      }
    });

    on("plotly_selected", (e: PlotSelectionEvent) => {
      const points = (e?.points ?? [])
        .filter(
          (p) => p.data.hoverinfo !== "skip" && p.data.hoverinfo !== "none"
        )
        .map((p) => {
          const order = contOrderByCurve.get(p.curveNumber as number);
          return order
            ? order[p.pointIndex as number]
            : (p.pointIndex as number);
        });
      if (points.length > 0) {
        onMultiselect(points);
      }
    });

    on("plotly_deselect", () => {
      onClickResetSelection();
    });

    on("plotly_relayout", () => {
      axes.current = {
        xaxis: { range: (plot.layout as any).xaxis?.range, autorange: false },
        yaxis: { range: (plot.layout as any).yaxis?.range, autorange: false },
      };
    });

    return () => {
      listeners.forEach(([name, cb]) =>
        // Plotly's HTMLElement type omits removeListener, but the graph div is
        // an EventEmitter at runtime, so the method is present. Augment locally
        // rather than reaching for Parameters<PlotlyHTMLElement["removeListener"]>,
        // which can't index a property the type doesn't declare.
        (plot as PlotlyHTMLElement & {
          removeListener?: (
            event: string,
            callback: (...args: unknown[]) => void
          ) => void;
        }).removeListener?.(name, cb)
      );
    };
  }, [
    data,
    xKey,
    yKey,
    xLabel,
    yLabel,
    facetKeys,
    facetOrder,
    height,
    hoverTextKey,
    annotationTextKey,
    colorKey1,
    colorKey2,
    categoricalColorKey,
    continuousColorKey,
    contLegendKeys,
    colorMap,
    selectedPoints,
    pointVisibility,
    onClickPoint,
    onMultiselect,
    onClickResetSelection,
    pointSize,
    pointOpacity,
    outlineWidth,
    palette,
    xAxisFontSize,
    yAxisFontSize,
    maxAnnotations,
    showIdentityLine,
    regressionLinesByFacet,
    onLoad,
    dragmode,
    placeholderEmptyFacets,
    Plotly,
  ]);

  return <div className={styles.ScatterPlot} ref={ref as any} />;
}

export default function LazySmallMultiplesScatter({
  data,
  ...otherProps
}: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly: PlotlyType) =>
        data ? (
          <SmallMultiplesScatter data={data} Plotly={Plotly} {...otherProps} />
        ) : null
      }
    </PlotlyLoader>
  );
}
