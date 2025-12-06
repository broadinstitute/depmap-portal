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
  data: { x: string[]; y: number[] };
  hoverLabel: string;
  xAxisTitle: string;
  useLogScale?: boolean;
  selectionMode?: "single" | "multiple" | "none";
  selectedPoints?: Set<number>;
  onSelect?: (pointIndices: number[]) => void;
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

const truncate = (max: number) => (s: string) => {
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
  data: Props["data"]
): void => {
  const layout = (plot as any).layout;
  const xaxis = layout.xaxis;

  // Get the current visible range
  const range = xaxis.range || [0, data.x.length - 1];
  const visibleCount = Math.ceil(range[1]) - Math.floor(range[0]);

  // Get plot width to estimate how many ticks can fit
  const plotWidth = layout.width || plot.clientWidth || 800;
  const maxTicks = Math.floor(plotWidth / 60); // Adjust 60 based on your label width

  // Calculate how often to show ticks
  const tickDivisor = Math.max(1, Math.ceil(visibleCount / maxTicks / 3));

  // Update tick labels - empty string for hidden ticks
  const newTickText = data.x
    .map(truncate(20))
    .map((s, i) => (i % tickDivisor === 0 ? s : ""));

  Plotly.relayout(plot, { "xaxis.ticktext": newTickText });
  Plotly.redraw(plot);
};

function PrototypeBarChart({
  data,
  xAxisTitle,
  hoverLabel,
  useLogScale = false,
  selectionMode = "none",
  selectedPoints = undefined,
  onSelect = () => {},
  onLoad = () => {},
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

    const plotlyData = [
      {
        type: "bar" as const,
        x: data.x,
        y: data.y,
        customdata: data.x.map(truncate(45)),
        marker: { color: "#1f77b4" },
        selected: { opacity: 1 },
        unselected: {
          marker: { opacity: selectionMode === "none" ? 1 : 0.5 },
        },
        hovertemplate: `${hoverLabel}: %{customdata}<br>count: %{y:,}<extra></extra>`,
        selectedpoints: selectedPoints ? [...selectedPoints] : [],
        showlegend: false,
      },
    ];

    const showRangeSlider = data.x.length > 20;

    const layout: Partial<Layout> = {
      height: 500,
      dragmode,
      margin: {
        l: 70,
        r: 20,
        t: 40,
        b: 50,
      },
      xaxis: axes.current.xaxis || {
        type: "category",
        title: xAxisTitle,
        nticks: 20,
        tickmode: "array",
        tickvals: data.x,
        ticktext: data.x.map(truncate(20)),
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
        updateTickDensity(Plotly, plot, data);
      }
    });

    on("plotly_click", (e: PlotMouseEvent) => {
      if (selectionMode === "none") {
        return;
      }

      const { pointIndex } = e.points[0];

      const anyModifier =
        e.event.ctrlKey || e.event.metaKey || e.event.shiftKey;

      if (!anyModifier || selectionMode === "single") {
        onSelect([pointIndex]);
        return;
      }

      // Collect all selected points across all traces
      const selectedIndices = new Set<number>();
      plot.data.forEach((trace) => {
        const traceSelected = trace.selectedpoints as number[] | undefined;
        if (traceSelected) {
          // Map trace-relative indices back to original indices
          let count = 0;
          for (let i = 0; i < data.x.length; i++) {
            if (trace.x![i] !== null) {
              if (traceSelected.includes(count)) {
                selectedIndices.add(i);
              }
              count++;
            }
          }
        }
      });

      if (selectedIndices.has(pointIndex)) {
        selectedIndices.delete(pointIndex);
      } else {
        selectedIndices.add(pointIndex);
      }

      onSelect([...selectedIndices]);
    });

    on("plotly_selected", (e: PlotSelectionEvent) => {
      if (!e) {
        return;
      }

      onSelect(e.points.map(({ pointIndex }) => pointIndex));
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
    data,
    dragmode,
    xAxisTitle,
    hoverLabel,
    useLogScale,
    selectionMode,
    selectedPoints,
    onSelect,
    Plotly,
  ]);

  return <div ref={ref} />;
}

export default function LazyBarChart({ data, ...otherProps }: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        data ? (
          <PrototypeBarChart data={data} Plotly={Plotly} {...otherProps} />
        ) : null
      }
    </PlotlyLoader>
  );
}
