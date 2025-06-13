import React, { useEffect, useRef } from "react";
import Plotly, { Config, Layout, PlotData } from "plotly.js";
import { BarSubplotData, Subgroup } from "../models/subplotData";

interface GroupedBarSuplotsProp {
  subplotsData: any;
  countData: Record<string, number>;
}

export default function GroupedBarSuplots(props: GroupedBarSuplotsProp) {
  const { subplotsData, countData } = props;
  console.log(subplotsData);

  const plotRef = useRef(null);

  useEffect(() => {
    if (plotRef.current) {
      // Define subgroup colors
      const subgroupToColor: {
        [key in Subgroup]: { color: string; line: string };
      } = {
        "CNS/Brain": { color: "#f5db84", line: "#f5c422" },
        Heme: { color: "#d3b2db", line: "#ba37db" },
        Solid: { color: "#a3bce6", line: "#1154bf" },
      };
      const subtypes = Array.from(new Set(subplotsData.map((d) => d.subtype)));
      const subgroups = Array.from(
        new Set(subplotsData.map((d) => d.subgroup))
      );
      const subfeatures = Array.from(
        new Set(subplotsData.map((d) => d.subtypeFeature))
      );
      console.log(subtypes);
      console.log(subgroups);
      console.log(subfeatures);

      const traces: Partial<Plotly.PlotData>[] = [];

      subgroups.forEach((subgroup) => {
        subfeatures.forEach((subfeature, i) => {
          traces.push({
            x: subtypes,
            y: subtypes.map((subtype) => {
              return countData[`${subgroup}-${subtype}-${subfeature}`] ?? 0;
            }),
            text: subtypes.map((subtype) => {
              const count =
                countData[`${subgroup}-${subtype}-${subfeature}`] ?? 0;
              return count > 0
                ? `Parent: ${subgroup}<br>Type: ${subtype}<br>Subtype: ${subfeature}<br>Count: ${count}`
                : "";
            }),
            hoverinfo: "text",
            name: i === 0 ? subgroup : "", // Only first subtype gets legend label
            showlegend: i === 0,
            legendgroup: subgroup,
            offsetgroup: subgroup,
            stackgroup: subgroup,
            type: "bar",
            marker: {
              color: subgroupToColor[subgroup as Subgroup].color,
              line: {
                color: subgroupToColor[subgroup as Subgroup].line,
                width: 2,
              },
            },
          });
        });
      });
      console.log("Traces: ", traces);

      console.log(traces);

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
        barmode: "stack",
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
        hovermode: "closest",
      };

      const config: Partial<Config> = {
        // Automatically resizes the plot when the window is resized.
        responsive: true,
        // hides hover widget toolbar
        displayModeBar: false,
      };

      Plotly.react(plotRef.current, traces, layout, config);
    }
  }, [countData, subplotsData]);

  return (
    <div>
      <div ref={plotRef} />
    </div>
  );
}
