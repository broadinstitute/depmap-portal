import React, { useEffect, useRef } from "react";
import Plotly, { Config, Layout, PlotData } from "plotly.js";
import { BarSubplotData } from "../models/subplotData";

interface GroupedBarSuplotsProp {
  subplotsData: BarSubplotData[];
}

export default function GroupedBarSuplots(props: GroupedBarSuplotsProp) {
  const { subplotsData } = props;

  const plotRef = useRef(null);

  useEffect(() => {
    if (plotRef.current) {
      const plotlyData: Partial<PlotData>[] = subplotsData.map(
        (subplotData) => {
          return {
            x: subplotData.xAxisLabels,
            y: subplotData.values,
            text: subplotData.labels,
            name: subplotData.name,
            type: "bar",
            marker: {
              color: subplotData.color,
              line: {
                color: subplotData.lineColor,
                width: 2,
              },
            },
            hoverinfo: "y+text",
          };
        }
      );

      const layout: Partial<Layout> = {
        title: "",
        xaxis: {
          tickangle: -50,
          tickfont: {
            size: 10,
          },
        },
        yaxis: {
          title: "",
          //   zeroline: false,
          gridwidth: 1,
        },
        barmode: "group",
        legend: {
          orientation: "h",
          xanchor: "right",
          x: 1,
          y: 1.05,
        },
        showlegend: true,
        margin: {
          l: 50,
          r: 100,
          b: 200,
          t: 50,
          pad: 4,
        },
      };

      const config: Partial<Config> = {
        // Automatically resizes the plot when the window is resized.
        responsive: true,
        // hides hover widget toolbar
        displayModeBar: false,
      };

      Plotly.react(plotRef.current, plotlyData, layout, config);
    }
  }, [subplotsData]);

  return (
    <div>
      <div ref={plotRef} />
    </div>
  );
}
