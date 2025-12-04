/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import type {
  Config,
  Layout,
  PlotData,
  PlotlyHTMLElement,
  PlotMouseEvent,
  PlotSelectionEvent,
} from "plotly.js";

interface Props {
  x: (string | number)[];
  groupedData: Array<{
    y: number[];
    name: string;
    color: string;
  }>;
  hoverLabel: string;
  xAxisTitle: string;
  useLogScale?: boolean;
  selectionMode?: "single" | "multiple" | "none";
  selectedPoints?: Set<number>;
  onSelect?: (pointIndices: number[]) => void;
  colorValues?: (string | number)[];
  colorMap?: Record<string | number, string>;
  colorLabels?: Record<string | number, string>;
}

type ExtendedPlotType = HTMLDivElement &
  PlotlyHTMLElement & {
    data: PlotData[];
    layout: Layout;
    config: Config;
    // This is built into Plotly but not documented in its type definitions.
    // eslint-disable-next-line @typescript-eslint/ban-types
    removeListener: (eventName: string, callback: Function) => void;
  };

const truncate = (max: number) => (s: string | number) => {
  if (typeof s === "number") {
    return s.toFixed(3);
  }

  return s && s.length > max ? `${s.substr(0, max)}…` : s;
};

export function autoAdjustBottomMargin(
  el: HTMLElement,
  Plotly: any,
  padding = 10
) {
  const ticks = el.querySelectorAll(".xtick text");
  if (!ticks.length) return;

  let maxHeight = 0;
  ticks.forEach((node) => {
    const box = (node as SVGGraphicsElement).getBoundingClientRect();
    if (box.height > maxHeight) maxHeight = box.height;
  });

  const requiredMargin = Math.min(maxHeight + padding, 150);
  const currentMargin = (el as any)._fullLayout?.margin?.b ?? 0;

  // Only update if different → prevents infinite loop
  if (Math.abs(requiredMargin - currentMargin) > 1) {
    Plotly.relayout(el, { "margin.b": requiredMargin });
  }
}

const updateTickDensity = (
  Plotly: any,
  plot: HTMLElement,
  x: (string | number)[]
): void => {
  const layout = (plot as any).layout;
  const xaxis = layout.xaxis;

  // Get the current visible range
  const range = xaxis.range || [0, x.length - 1];
  const visibleCount = Math.ceil(range[1]) - Math.floor(range[0]);

  // Get plot width to estimate how many ticks can fit
  const plotWidth = layout.width || plot.clientWidth || 800;
  const maxTicks = Math.floor(plotWidth / 60); // Adjust 60 based on your label width

  // Calculate how often to show ticks
  const tickDivisor = Math.max(1, Math.ceil(visibleCount / maxTicks / 3));

  // Update tick labels - empty string for hidden ticks
  const newTickText = x
    .map(truncate(20))
    .map((s, i) => (i % tickDivisor === 0 ? s : ""));

  Plotly.relayout(plot, { "xaxis.ticktext": newTickText });
  Plotly.redraw(plot);
};

function PrototypeBarChart({
  x,
  groupedData,
  xAxisTitle,
  hoverLabel,
  useLogScale = false,
  selectionMode = "none",
  selectedPoints = undefined,
  onSelect = () => {},
  onLoad = () => {},
  colorValues = undefined,
  colorMap = undefined,
  colorLabels = undefined,
  Plotly,
}: Props & { onLoad?: (el: ExtendedPlotType) => void; Plotly: any }) {
  const ref = useRef<ExtendedPlotType>(null);
  const [dragmode, setDragmode] = useState<Layout["dragmode"]>("zoom");

  const axes = useRef<Partial<Layout>>({
    xaxis: undefined,
    yaxis: undefined,
  });

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;

    // Build traces from groupedData
    // If groupedData has only 1 member, treat as ungrouped (no barmode: 'group')
    let plotlyData: Partial<PlotData>[];
    const isSingleGroup = groupedData.length === 1;

    if (colorValues && colorValues.length === x.length && isSingleGroup) {
      // Single group with color mapping - create multiple traces with sparse arrays
      const colorGroups = new Map<string | number, number[]>();

      colorValues.forEach((colorValue, index) => {
        if (!colorGroups.has(colorValue)) {
          colorGroups.set(colorValue, []);
        }
        colorGroups.get(colorValue)!.push(index);
      });

      // Create one trace per color group
      plotlyData = Array.from(colorGroups.entries()).map(
        ([colorValue, indices]) => {
          const color = colorMap?.[colorValue] || "#1f77b4";
          const name = colorLabels?.[colorValue] || String(colorValue);

          // Build arrays with data at the correct positions
          const traceX: (string | number | null)[] = new Array(x.length).fill(
            null
          );
          const traceY: (number | null)[] = new Array(
            groupedData[0].y.length
          ).fill(null);
          const traceCustomData: (string | number | null)[] = new Array(
            x.length
          ).fill(null);

          indices.forEach((i) => {
            traceX[i] = x[i];
            traceY[i] = groupedData[0].y[i];
            traceCustomData[i] = truncate(45)(x[i]);
          });

          // Calculate selected points for this trace
          const traceSelectedPoints = selectedPoints
            ? indices.filter((i) => selectedPoints.has(i))
            : [];

          return {
            type: "bar" as const,
            x: traceX,
            y: traceY,
            customdata: traceCustomData,
            marker: { color },
            selected: { opacity: 1 },
            unselected: {
              marker: { opacity: selectionMode === "none" ? 1 : 0.5 },
            },
            name,
            hovertemplate: `${hoverLabel}: %{customdata}<br>count: %{y:,}<extra></extra>`,
            selectedpoints: traceSelectedPoints,
            legendgroup: String(colorValue),
            showlegend: true,
          };
        }
      );
    } else {
      // Standard grouped (or single) bar mode
      plotlyData = groupedData.map((group) => {
        // Only set selectedpoints if we actually have selections
        const traceSelectedPoints =
          selectionMode !== "none" && selectedPoints && selectedPoints.size > 0
            ? [...selectedPoints]
            : undefined;

        return {
          type: "bar" as const,
          x,
          y: group.y,
          customdata: x.map(truncate(45)),
          marker: { color: group.color },
          selected: { opacity: 1 },
          unselected: {
            marker: { opacity: selectionMode === "none" ? 1 : 0.5 },
          },
          name: group.name,
          hovertemplate: `${hoverLabel}: %{customdata}<br>${group.name}: %{y:,}<extra></extra>`,
          selectedpoints: traceSelectedPoints,
          legendgroup: group.name,
          showlegend: !isSingleGroup, // Only show legend for multi-group
        };
      });
    }

    const showRangeSlider = x.length > 20;

    const layout: Partial<Layout> = {
      height: 500,
      dragmode,
      barmode: groupedData.length > 1 ? "group" : undefined,
      margin: {
        l: 70,
        r: 20,
        t: 40,
        b: 50,
      },
      legend: {
        orientation: "h",
        x: 0.5,
        xanchor: "center",
        y: 1.02,
        yanchor: "bottom",
      },
      xaxis: axes.current.xaxis || {
        type: "category",
        title: xAxisTitle,
        nticks: 20,
        tickmode: "array",
        tickvals: x,
        ticktext: x.map(truncate(20)),
        ...(showRangeSlider
          ? {
              range: [-1, 20],
              rangeslider: {
                visible: true,
                thickness: 0.1,
                borderwidth: 1,
              },
            }
          : null),
      },
      yaxis: axes.current.yaxis || {
        type: useLogScale ? "log" : "linear",
        title: "count",
      },
    };

    const config: Partial<Config> = {
      responsive: true,
      edits: { annotationTail: true },
      displaylogo: false,
      modeBarButtonsToRemove:
        selectionMode !== "multiple" ? ["select2d", "lasso2d"] : [],
    };

    Plotly.react(plot!, plotlyData, layout, config);

    // Keep track of added listeners so we can easily remove them.
    const listeners: [string, (e: any) => void][] = [];

    const on = (eventName: string, callback: (e: any) => void) => {
      plot.on(
        eventName as Parameters<PlotlyHTMLElement["on"]>[0],
        callback as Parameters<PlotlyHTMLElement["on"]>[1]
      );
      listeners.push([eventName, callback]);
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

      if (!showRangeSlider) {
        autoAdjustBottomMargin(plot, Plotly, 40);
      }
    });

    on("plotly_relayout", (eventData) => {
      const rangeChanged =
        eventData["xaxis.range"] !== undefined ||
        eventData["xaxis.autorange"] !== undefined;

      axes.current = {
        xaxis: { ...plot.layout.xaxis, autorange: false },
        yaxis: { ...plot.layout.yaxis, autorange: false },
      };

      if (eventData && eventData.dragmode) {
        const nextDragmode = eventData.dragmode;
        setDragmode(nextDragmode);

        if (
          (nextDragmode === "select" || nextDragmode === "lasso") &&
          dragmode !== "select" &&
          dragmode !== "lasso"
        ) {
          onSelect([]);
        }
      }

      if (rangeChanged) {
        updateTickDensity(Plotly, plot, x);
      }
    });

    on("plotly_click", (e: PlotMouseEvent) => {
      if (selectionMode === "none") {
        return;
      }

      const { pointIndex, curveNumber } = e.points[0];

      // For grouped bars (multiple groups), pointIndex directly maps to data index
      // For single group with color mapping, we need to find the actual data index
      let actualIndex = pointIndex;

      if (isSingleGroup && colorValues && colorValues.length === x.length) {
        // Find which original index this point corresponds to
        const trace = plot.data[curveNumber];
        let count = 0;
        for (let i = 0; i < x.length; i++) {
          if (trace.x![i] !== null) {
            if (count === pointIndex) {
              actualIndex = i;
              break;
            }
            count++;
          }
        }
      }

      const anyModifier =
        e.event.ctrlKey || e.event.metaKey || e.event.shiftKey;

      if (!anyModifier || selectionMode === "single") {
        onSelect([actualIndex]);
        return;
      }

      // Collect all selected points across all traces
      const selectedIndices = new Set<number>();
      plot.data.forEach((trace) => {
        const traceSelected = trace.selectedpoints as number[] | undefined;
        if (traceSelected) {
          if (!isSingleGroup || !colorValues) {
            // For grouped bars, indices are direct
            traceSelected.forEach((idx) => selectedIndices.add(idx));
          } else {
            // Map trace-relative indices back to original indices
            let count = 0;
            for (let i = 0; i < x.length; i++) {
              if (trace.x![i] !== null) {
                if (traceSelected.includes(count)) {
                  selectedIndices.add(i);
                }
                count++;
              }
            }
          }
        }
      });

      if (selectedIndices.has(actualIndex)) {
        selectedIndices.delete(actualIndex);
      } else {
        selectedIndices.add(actualIndex);
      }

      onSelect([...selectedIndices]);
    });

    on("plotly_selected", (e: PlotSelectionEvent) => {
      if (!e) {
        return;
      }

      // Map selected points back to original indices
      const selectedIndices = new Set<number>();

      if (!isSingleGroup) {
        // For grouped bars, point indices are direct
        e.points.forEach((point) => {
          selectedIndices.add(point.pointIndex);
        });
        onSelect([...selectedIndices]);
      } else if (colorValues && colorValues.length === x.length) {
        // For colored bars, map trace-relative to original indices
        e.points.forEach((point) => {
          const trace = plot.data[point.curveNumber];
          let count = 0;
          for (let i = 0; i < x.length; i++) {
            if (trace.x![i] !== null) {
              if (count === point.pointIndex) {
                selectedIndices.add(i);
                break;
              }
              count++;
            }
          }
        });
        onSelect([...selectedIndices]);
      } else {
        onSelect(e.points.map(({ pointIndex }) => pointIndex));
      }
    });

    // https://github.com/plotly/plotly.js/blob/55dda47/src/lib/prepare_regl.js
    on("plotly_webglcontextlost", () => {
      // Fixes a bug where points disappear after the browser has been left
      // idle for some time.
      Plotly.redraw(plot);
    });

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener?.(eventName, callback)
      );
    };
  }, [
    x,
    groupedData,
    dragmode,
    xAxisTitle,
    hoverLabel,
    useLogScale,
    selectionMode,
    selectedPoints,
    onSelect,
    colorValues,
    colorMap,
    colorLabels,
    Plotly,
  ]);

  return <div ref={ref} />;
}

export default function LazyBarChart({ x, groupedData, ...otherProps }: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        x && groupedData ? (
          <PrototypeBarChart
            x={x}
            groupedData={groupedData}
            Plotly={Plotly}
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
