import { Layout } from "plotly.js";

export const getLayout = (
  data: any,
  heatmapXAxisTitle: string,
  barcChartXAxisTitle: string,
  heatmapXAxisTickLabels: string[],
  hoveredColumns: Set<number>,
  selectedColumns: Set<number>,
  range: any,
  useStackedLayout: boolean = false
): Partial<Layout> => {
  const yLength = [...new Set(data.y)].length;

  // Parts of the layout that are different for screen sizes less than 1250
  const gridRows = useStackedLayout ? 2 : 1;
  const gridColumns = useStackedLayout ? 1 : 2;
  const margin = useStackedLayout ? { t: 0, b: 25 } : { t: 25, b: 25 };
  const xDomain = useStackedLayout ? [0, 1] : [0, 0.7];
  const x2Domain = useStackedLayout ? [0, 1] : [0.73, 1];
  const showY2Axis = useStackedLayout;
  // If there are selected columns, the tick marks push the heatmap x axis rangeslider and label downwards towards the barchart.
  // This gives us more room so that the x axis label does not overlap the barchart.
  const stackedLayoutYGap = selectedColumns.size > 0 ? 0.5 : 0.4;

  return {
    autosize: true,
    grid: {
      rows: gridRows,
      columns: gridColumns,
      ygap: useStackedLayout ? stackedLayoutYGap : 0,
      pattern: "independent",
    },
    height: 600,
    margin,
    hovermode: "closest",
    hoverlabel: { namelength: -1 },
    dragmode: false,
    xaxis: {
      anchor: "x",
      automargin: true,
      domain: xDomain,

      showgrid: false,
      title: {
        text: heatmapXAxisTitle,
      },
      side: "bottom",

      tickvals: heatmapXAxisTickLabels.map((label, i) =>
        label ? data.x[i] : ""
      ),
      ticktext: heatmapXAxisTickLabels,
      tickmode: "array",
      tickangle: -25,
      tickfont: { size: 10 },

      rangeslider: {
        thickness: 0.03,
        visible: data.z.length > 0,
        borderwidth: 1,
        range: [0 - 0.5, [...new Set(data.x)].length - 0.5],
      },
      range,
    },

    yaxis: {
      anchor: "y",
      showgrid: false,
      fixedrange: true,
      tickfont: { size: 10 },
      automargin: true,
    },
    yaxis2: {
      anchor: "y2",
      fixedrange: true,
      tickfont: { size: 10 },
      visible: showY2Axis,
    },
    xaxis2: { domain: x2Domain, fixedrange: true, title: barcChartXAxisTitle },

    shapes: [
      // Outline
      [...selectedColumns].map((colIndex) => ({
        type: "path" as const,
        line: { width: 2, color: "black" },
        path: (() => {
          const x0 = colIndex - 0.5;
          const x1 = colIndex + 0.5;
          const y0 = -0.5;
          const y1 = yLength - 0.5;
          const shouldDrawLeft = !selectedColumns.has(colIndex - 1);
          const shouldDrawRight = !selectedColumns.has(colIndex + 1);
          const segments = [];
          if (shouldDrawLeft) {
            segments.push(`M ${x0} ${y0}`);
            segments.push(`L ${x0} ${y1}`);
          }
          segments.push(`M ${x0} ${y1}`);
          segments.push(`L ${x1} ${y1}`);
          segments.push(`M ${x1} ${y0}`);
          segments.push(`L ${x0} ${y0}`);
          if (shouldDrawRight) {
            segments.push(`M ${x1} ${y1}`);
            segments.push(`L ${x1} ${y0}`);
          }
          return segments.join(" ");
        })(),
      })),
      // Fill
      [...new Set([...hoveredColumns, ...selectedColumns])].map((colIndex) => ({
        type: "rect" as const,
        x0: colIndex - 0.5,
        x1: colIndex + 0.5,
        y0: -0.5,
        y1: yLength - 0.5,
        line: { width: 0 },
        fillcolor: "rgba(0, 0, 0, 0.15)",
      })),
    ].flat(),
  };
};
