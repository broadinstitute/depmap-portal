import React, { useEffect, useRef } from "react";
import type {
  Config,
  Datum,
  Layout,
  PlotData,
  PlotlyHTMLElement,
  ViolinData,
} from "plotly.js";
import { LegendKey, usePlotlyLoader } from "@depmap/data-explorer-2";

type Data = Record<string, any> | null;

type ExtendedPlotType = HTMLDivElement &
  PlotlyHTMLElement & {
    data: PlotData[];
    layout: Layout;
    config: Config;
    // eslint-disable-next-line @typescript-eslint/ban-types
    removeListener: (eventName: string, callback: Function) => void;
  };

interface Props {
  data: Data;
  colorMap: Map<LegendKey, string>;
  initialRange: [number, number];
  onChangeRange: (nextRange: [number, number]) => void;
  hasFixedMin?: boolean;
  hasFixedMax?: boolean;
}

// Hide the large plot since we only want to render the rangeslider.
const hideLargePlot = (plot: HTMLDivElement) => {
  const svgContainer = plot.querySelector(".svg-container") as HTMLElement;

  const rangeSliderContainer = plot.querySelector(
    ".rangeslider-container"
  ) as HTMLElement;

  const rangeSliderSvg = rangeSliderContainer.closest("svg");

  svgContainer.style.height = "100px";
  rangeSliderSvg!.setAttribute("height", "100");
  rangeSliderSvg!.setAttribute("height", "100");
  rangeSliderContainer.setAttribute("transform", "translate(0,0)");

  [...svgContainer.children].forEach((child) => {
    if (child !== rangeSliderSvg) {
      // eslint-disable-next-line no-param-reassign
      (child as HTMLElement).style.display = "none";
    }
  });
};

const hideRangeGrabbers = (
  plot: HTMLDivElement,
  hasFixedMin: boolean,
  hasFixedMax: boolean
) => {
  [
    hasFixedMin ? plot.querySelector(".rangeslider-grabber-min") : null,
    hasFixedMax ? plot.querySelector(".rangeslider-grabber-max") : null,
  ].forEach((grabber) => grabber?.remove());

  [
    hasFixedMin ? plot.querySelector(".rangeslider-mask-min") : null,
    hasFixedMax ? plot.querySelector(".rangeslider-mask-max") : null,
  ].forEach((mask) => {
    if (!mask) {
      return;
    }

    const initX = mask.hasAttribute("data-initial-x")
      ? mask.getAttribute("data-initial-x")
      : mask.getAttribute("x");

    const initWidth = mask.hasAttribute("data-initial-width")
      ? mask.getAttribute("data-initial-width")
      : mask.getAttribute("width");

    if (initWidth !== "0") {
      mask.setAttribute("x", initX as string);
      mask.setAttribute("width", initWidth as string);
      mask.setAttribute("data-initial-x", initX as string);
      mask.setAttribute("data-initial-width", initWidth as string);
    }
  });
};

export const hexToRgba = (hex: string, alpha: number) => {
  const [r, g, b] = hex
    .replace(/^#/, "")
    .replace(/(.)/g, hex.length < 6 ? "$1$1" : "$1")
    .match(/../g)!
    .map((word) => parseInt(word, 16));

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function ContinuousFilter({
  data,
  colorMap,
  initialRange,
  onChangeRange,
  hasFixedMin = false,
  hasFixedMax = false,
  Plotly,
}: Props & { Plotly: any }) {
  const ref = useRef<ExtendedPlotType>(null);

  useEffect(() => {
    const plot = ref.current;
    return () => Plotly.purge(plot as HTMLElement);
  }, [Plotly]);

  const initialRangeRef = useRef<[Datum, Datum]>(
    initialRange as [Datum, Datum]
  );

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    const colorKeys = [...colorMap.keys()];
    const x = (data?.x || []) as number[];

    const templateViolin = {
      type: "violin",
      x,
      points: false,
      hoverinfo: "none",
      line: { color: "#666" },
      side: "positive",
      width: 1,
      meanline: { visible: true, color: hexToRgba("#333", 0.5) },
      showlegend: false,
    } as Partial<ViolinData>;

    const violinTraces = colorKeys.map((legendKey, index) => {
      const fillcolor = colorMap.get(legendKey) + "88";

      return {
        ...templateViolin,
        x,
        y0: index,
        fillcolor,
      };
    });

    // Add an extra violin with a light outline to make
    // it stand out on top many dark-colored points.
    const violinOutlineTraces = colorKeys.map((legendKey, index) => {
      return {
        ...templateViolin,
        line: { color: hexToRgba("#fff", 0.5), width: 4 },
        meanline: { visible: false },
        fillcolor: "transparent",
        x,
        y0: index,
      } as any;
    });

    const plotlyData = [
      ...violinOutlineTraces,
      ...violinTraces,
    ] as Partial<PlotData>[];

    const layout: Partial<Layout> = {
      margin: { l: 0, r: 0, t: 0, b: 0 },

      xaxis: plot.layout?.xaxis || {
        rangeslider: {
          visible: true,
          thickness: 0.2,
        },
      },

      yaxis: { visible: false },
    };

    const config: Partial<Config> = {
      responsive: false,
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

    on("plotly_afterplot", () => {
      hideLargePlot(plot);
      hideRangeGrabbers(plot, hasFixedMin, hasFixedMax);

      if (!(plot as any).isInitialized) {
        (plot as any).isInitialized = true;
        Plotly.relayout(plot, { "xaxis.range": initialRangeRef.current });
      }
    });

    on("plotly_relayout", (eventData) => {
      if (!eventData || !eventData["xaxis.range"]) {
        return;
      }

      const [initMin, initMax] = initialRangeRef.current as [number, number];
      const [min, max] = eventData["xaxis.range"];

      onChangeRange([hasFixedMin ? initMin : min, hasFixedMax ? initMax : max]);

      // The rangeslider freaks out when this happens. We'll just reset it.
      if (Math.abs(max - min) < Number.EPSILON && plot) {
        setTimeout(() => {
          Plotly.relayout(plot, { "xaxis.range": [initMin, initMax] });
          Plotly.redraw(plot);
          onChangeRange([initMax, initMax]);
        });
      }
    });

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener?.(eventName, callback)
      );
    };
  }, [data, colorMap, onChangeRange, hasFixedMin, hasFixedMax, Plotly]);

  return <div ref={ref} />;
}

export default function LazyContinuousFilter({ data, ...otherProps }: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        data ? (
          <ContinuousFilter data={data} Plotly={Plotly} {...otherProps} />
        ) : null
      }
    </PlotlyLoader>
  );
}
