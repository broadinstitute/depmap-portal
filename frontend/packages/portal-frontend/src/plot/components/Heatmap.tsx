import { Margin } from "plotly.js";
import React, { useEffect, useRef } from "react";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";
import styles from "../styles/Heatmap.scss";

export interface HeatmapProps {
  dataTypeLabels: string[];
  zVals: number[][];
  xVals: string[];
  onLoad: (plot: ExtendedPlotType) => void;
  height?: number;
  margin?: Margin;
  customWidth?: number | undefined;
  customColorScale?: (string | number)[][];
}

type HeatmapPropsWithPlotly = HeatmapProps & { Plotly: PlotlyType };

function Heatmap({
  dataTypeLabels,
  zVals,
  xVals,
  onLoad = () => {},
  // The default height and margin are matches for Context Explorer's
  // overview tab plot.
  height = 300,
  customWidth = undefined,
  customColorScale = undefined,
  margin = {
    l: 10,

    r: 20,

    b: 25,

    t: 0,

    pad: 0,
  },
  Plotly,
}: HeatmapPropsWithPlotly) {
  const ref = useRef<ExtendedPlotType>(null);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    const data: any = [
      {
        z: zVals,
        x: xVals,
        y: dataTypeLabels,
        zmax: 10,
        zmin: 0,
        ygap: 12,
        showscale: false,
        colorscale: customColorScale ?? [
          // Data not available colors
          [0, "rgb(217, 217, 217)"], // 100% opacity
          [0.05, "rgba(217, 217, 217, .4)"], // 40% opacity (datatype not selected)

          // Loss of Function colors
          // Because we have a zmin of 0 and zmax of 10, we
          // can use these colors via using a zVal of 1 or 1.5.
          [0.1, "rgba(47, 169, 208, 1)"], // 100% opacity
          [0.15, "rgba(47, 169, 208, .4)"], // 40% opacity (datatype not selected)

          // OMICS colors
          // (to use, set zVal to 2 or 2.5)
          [0.2, "rgba(36, 74, 139, 1)"], // 100% opacity
          [0.25, "rgba(36, 74, 139, .4)"], // 40% opacity (datatype not selected)

          // Compound Viability colors
          [0.3, "rgba(197, 82, 82, 1)"], // 100% opacity
          [0.35, "rgba(197, 82, 82, .4)"], // 40% opacity (datatype not selected)

          // Disease Subtype colors
          [0.4, "rgba(225, 121, 14, 1)"], // 100% opacity
          [0.45, "rgba(225, 121, 14, .4)"], // 40% opacity (datatype not selected)

          // Not used. Just added as an endpoint to the colorscale
          [1.0, "rgb(0, 0, 0)"],
        ],
        type: "heatmap",
        hoverongaps: false,
        hoverinfo: "none",
      },
    ];

    const axisTemplate: Partial<Plotly.LayoutAxis> = {
      showgrid: false,
      visible: true,
    };

    const layout: Partial<Plotly.Layout> = customWidth
      ? {
          title: "",

          xaxis: axisTemplate,

          yaxis: axisTemplate,

          autosize: true,

          dragmode: false,

          height,

          margin,
          width: customWidth,
        }
      : {
          title: "",

          xaxis: axisTemplate,

          yaxis: axisTemplate,

          autosize: true,

          dragmode: false,

          height,

          margin,
        };

    const config: Partial<Plotly.Config> = { responsive: true };

    Plotly.newPlot(plot, data, layout, config);
  }, [
    Plotly,
    dataTypeLabels,
    zVals,
    xVals,
    height,
    margin,
    customWidth,
    customColorScale,
  ]);

  return <div className={styles.Heatmap} ref={ref} />;
}

export default function LazyHeatmap({
  dataTypeLabels,
  zVals,
  xVals,
  ...otherProps
}: HeatmapProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        zVals && xVals && dataTypeLabels ? (
          <Heatmap
            dataTypeLabels={dataTypeLabels}
            zVals={zVals}
            xVals={xVals}
            Plotly={Plotly}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
