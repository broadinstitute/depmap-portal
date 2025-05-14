/* eslint-disable */
import * as models from "src/plot/models/volcanoPlotModels";
import * as Plotly from "plotly.js";
import { PlotHTMLElement } from "@depmap/plotly-wrapper";

export function formatTrace(
  volcanoData: Array<models.VolcanoData>,
  highlightedPoints: Array<number> | null = null
) {
  const traces: any = volcanoData.map((volcanoDataTrace) => {
    const plotlyTrace: Partial<Plotly.PlotData> = {
      x: volcanoDataTrace.x,
      y: volcanoDataTrace.y.map((x: number) => {
        return -Math.log10(x); // log transforms the y axis
      }),
      text: volcanoDataTrace.text,
      customdata: volcanoDataTrace.label, // original label, for point click to match against
      marker: {
        line: {
          color: "black",
          width: 1,
        },
        size: 7,
        color: volcanoDataTrace.color
          ? volcanoDataTrace.color
          : getColor(volcanoDataTrace),
      },
      hoverinfo: "text",
      mode: "markers",
      type: "scatter",
      showlegend: false,
    };

    if (volcanoDataTrace.name) {
      plotlyTrace.name = volcanoDataTrace.name;
    }

    if (highlightedPoints) {
      const symbols = Array<string>(plotlyTrace.x?.length || 0).fill("circle");
      const lineWidths = Array<number>(plotlyTrace.x?.length || 0).fill(0);

      highlightedPoints.map((index: number) => {
        symbols[index] = "star";
        lineWidths[index] = 2;
      });

      plotlyTrace.marker!.symbol = symbols;
      plotlyTrace.marker!.line = { width: lineWidths };
    }

    return plotlyTrace;
  });

  return traces;
}

const getColor = (
  volcanoData: models.VolcanoData,
  selectedLabel: string | null = null
) => {
  // color selected is orange. else, color depending on original volcanoplot data color
  const colors: Array<string> = [];
  volcanoData.isSignificant.map((isSignificant: boolean, index: number) => {
    let color: string;
    if (volcanoData.label[index] == selectedLabel) {
      color = "orange";
    } else if (volcanoData.color) {
      color = isSignificant ? volcanoData.color[index] : "grey";
    } else {
      color = "grey";
    }
    colors.push(color);
  });
  return colors;
};

export const formatLayout = (
  xLabel: string,
  yLabel: string,
  bounds: { width: number; height: number } | null | "autosize" = null,
  annotations: Array<Partial<Plotly.Annotations>> | null = null
) => {
  // let bounds = resizer.getSize("main-plot");
  if (!bounds) {
    bounds = { width: 600, height: 600 };
  }
  const layout: any = {
    autosize: bounds, // autosizes width but not height
    width: bounds.width,
    height: bounds.height,
    hovermode: "closest",
    margin: {
      l: 50,
      r: 50,
      b: 50,
      t: 30,
    },
    xaxis: {
      title: xLabel,
    },
    yaxis: {
      title: `-log10(${yLabel})`,
    },
    annotations,
  };
  return layout;
};

export const getHoverCallbacks = (plotlyRefState: PlotHTMLElement) => {
  if (plotlyRefState) {
    return {
      plotly_hover: () => {
        const nsewdrag = plotlyRefState.querySelector(
          ".nsewdrag"
        ) as PlotHTMLElement;
        nsewdrag.style.cursor = "pointer";
      },
      plotly_unhover: () => {
        const nsewdrag = plotlyRefState.querySelector(
          ".nsewdrag"
        ) as PlotHTMLElement;
        nsewdrag.style.cursor = "";
      },
    };
  }
};

export const withColorChange = (
  plotDiv: PlotHTMLElement,
  volcanoData: Array<models.VolcanoData>,
  onSelectedLabelChange: models.OnSelectedLabelChange
) => {
  if (plotDiv && onSelectedLabelChange) {
    const onPointClick = (point: Plotly.PlotDatum) => {
      // customdata has the value of the original label passed in props (see formatTrace)
      const pointLabel = point.customdata as string;
      onSelectedLabelChange(pointLabel); // do whatever was passed in props
      updateColorFromSelectedLabel(plotDiv, volcanoData, pointLabel); // also change the color of the point
    };
    return onPointClick;
  }
};

const updateColorFromSelectedLabel = (
  plotDiv: PlotHTMLElement,
  volcanoData: Array<models.VolcanoData>,
  selectedLabel: string
) => {
  volcanoData.map((volcanoTrace, index) => {
    const update = {
      "marker.color": getColor(volcanoTrace, selectedLabel),
    };
    // we use plotly's restyle instead of re-instantiating the whole compoent. this lets us preserve e.g. plotly zoom, and has better performance
    Plotly.restyle(plotDiv, update, index);
  });
};
