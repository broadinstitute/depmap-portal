import React, { useEffect, useRef, useState } from "react";
import Plotly, { Config, Layout } from "plotly.js";
import {
  ExtendedPlotType,
  ModelDataWithSubgroup,
  Subgroup,
} from "../models/subplotData";

interface GroupedBarSuplotsProp {
  subgroups: Subgroup[];
  subplotsData: ModelDataWithSubgroup[];
  countData: Record<string, number>;
  subtypeCountData: Record<string, number>;
}

export default function GroupedBarSuplots(props: GroupedBarSuplotsProp) {
  const { subgroups, subplotsData, countData, subtypeCountData } = props;
  const [visibleSubgroups, setVisibleSubgroups] = useState(new Set(subgroups));

  const plotRef = useRef<ExtendedPlotType>(null);

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
      const subtypes = Array.from(
        new Set(
          subplotsData
            .filter((d) => {
              if (visibleSubgroups.size) {
                return visibleSubgroups.has(d.subgroup);
              }
              return d;
            }) // do not show subtypes of subgroups that have been filtered out unless no subgroups should be visible (hack: so legend group still shows)
            .map((d) => d.subtype)
        )
      );

      const subfeatures = Array.from(
        new Set(subplotsData.map((d) => d.subtypeFeature))
      );

      const traces: Partial<Plotly.PlotData>[] = [];
      // HACK: Plotly's barmode: 'stack' stacks traces, not categories inside traces.
      // So the only way to stack subfeatures within each subgroup for the same subtype is to create a trace per subfeature.
      // And since not all models have subfeatures, we previously set subtype == subfeature if subfeature was null so (subgroup, subfeature) are unique pair
      // Create one trace per (subgroup, subfeature) pair.

      subgroups.forEach((subgroup) => {
        // determines whether subgroup plot should show and if not, only show the subgroup legend group
        let showSubgroup: boolean | "legendonly";
        if (visibleSubgroups.size > 0) {
          if (visibleSubgroups.has(subgroup)) {
            showSubgroup = true;
          } else {
            showSubgroup = "legendonly";
          }
        } else {
          showSubgroup = "legendonly";
        }
        subfeatures.forEach((subfeature, i) => {
          traces.push({
            x: subtypes.map((st) =>
              st.length > 20 ? st.substring(0, 20).concat("...") : st
            ),
            y: subtypes.map((subtype) => {
              return countData[`${subgroup}-${subtype}-${subfeature}`] ?? 0;
            }),
            text: subtypes.map((subtype) => {
              const totalCount = subtypeCountData[subtype];
              const count =
                countData[`${subgroup}-${subtype}-${subfeature}`] ?? 0;
              return count > 0
                ? // undo hack where null subfeatures were set to subtype
                  `Subgroup: ${subgroup}<br>Subtype: ${subtype}<br>Feature: ${
                    subfeature === subtype ? "" : subfeature
                  }<br>Count: ${count}/${totalCount}`
                : "";
            }),
            hoverinfo: "text",
            name: i === 0 ? subgroup : "", // Only first subtype gets legend label
            showlegend: i === 0,
            legendgroup: subgroup,
            stackgroup: subgroup,
            visible: showSubgroup, // filter out the traces of clicked subgroup in graph but keep the subgroup visible in legend
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
          r: 50,
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
  }, [countData, subgroups, subplotsData, subtypeCountData, visibleSubgroups]);

  // custom legend click behavior since default behavior doesn't work with our plot hack
  useEffect(() => {
    const plot: ExtendedPlotType | null = plotRef.current;
    if (plot) {
      const handleLegendClick = (e: any) => {
        const clickedSubgroup = e.node.textContent;

        const newVisible = new Set(visibleSubgroups);

        if (newVisible.has(clickedSubgroup)) {
          newVisible.delete(clickedSubgroup);
        } else {
          newVisible.add(clickedSubgroup);
        }

        setVisibleSubgroups(newVisible);
        return false; // Prevent default Plotly behavior
      };

      plot.on("plotly_legendclick", handleLegendClick);
      return () => {
        // This is built into Plotly but not documented in its type definitions.
        plot.removeListener("plotly_legendclick", handleLegendClick);
      };
    }
    return () => {};
  }, [visibleSubgroups]);

  return <div ref={plotRef} />;
}
