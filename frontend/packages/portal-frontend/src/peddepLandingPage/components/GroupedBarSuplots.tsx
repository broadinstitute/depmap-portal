import React, { useEffect, useRef } from "react";
import Plotly, { Config, Layout } from "plotly.js";
import { ModelDataWithSubgroup, Subgroup } from "../models/subplotData";

interface GroupedBarSuplotsProp {
  subplotsData: ModelDataWithSubgroup[];
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

      // Remove duplicates
      const subtypes = Array.from(new Set(subplotsData.map((d) => d.subtype)));
      const subgroups = Array.from(
        new Set(subplotsData.map((d) => d.subgroup))
      );
      const subfeatures = Array.from(
        new Set(subplotsData.map((d) => d.subtypeFeature))
      );

      const traces: Partial<Plotly.PlotData>[] = [];
      // HACK: Plotly's barmode: 'stack' stacks traces, not categories inside traces.
      // So the only way to stack subfeatures within each subgroup for the same subtype is to create a trace per subfeature.
      // And since not all models have subfeatures, we previously set subtype == subfeature if subfeature was null
      // Create one trace per (subgroup, subfeature) pair.
      subgroups.forEach((subgroup) => {
        subfeatures.forEach((subfeature, i) => {
          traces.push({
            x: subtypes.map((st) =>
              st.length > 20 ? st.substring(0, 20).concat("...") : st
            ),
            y: subtypes.map((subtype) => {
              return countData[`${subgroup}-${subtype}-${subfeature}`] ?? 0;
            }),
            text: subtypes.map((subtype) => {
              const count =
                countData[`${subgroup}-${subtype}-${subfeature}`] ?? 0;
              return count > 0
                ? // undo hack where null subfeatures were set to subtype
                  `Subgroup: ${subgroup}<br>Subtype: ${subtype}<br>Feature: ${
                    subfeature === subtype ? "" : subfeature
                  }<br>Count: ${count}`
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
              color: subgroupToColor[subgroup].color,
              line: {
                color: subgroupToColor[subgroup].line,
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
        height: 500,
        xaxis: {
          tickangle: -60,
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
