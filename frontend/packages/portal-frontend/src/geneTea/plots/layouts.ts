import { Layout } from "plotly.js";

export const getDefaultLayout = (
  data: any,
  heatmapXAxisTitle: string,
  barcChartXAxisTitle: string,
  heatmapXAxisTickLabels: string[],
  hoveredColumns: Set<number>,
  selectedColumns: Set<number>,
  range: any
): Partial<Layout> => {
  const yLength = [...new Set(data.y)].length;
  return {
    autosize: true,
    // grid: { rows: 1, columns: 2, pattern: "independent" },
    height: 600,
    margin: { t: 50, b: 50 },
    hovermode: "closest",
    hoverlabel: { namelength: -1 },
    dragmode: false,
    title: {
      text: "", // TODO add later
    },
    xaxis: {
      domain: [0, 0.7],

      showgrid: false,
      title: {
        text: heatmapXAxisTitle,
        standoff: 5,
      },
      side: "top",

      // ticklabelposition: 'outside bottom',
      ticktext: heatmapXAxisTickLabels,
      tickmode: "array",
      tickfont: { size: 10 },

      automargin: true,
      rangeslider: {
        thickness: 0.05,
        visible: true,
        borderwidth: 2,
      },
      range,
    },

    yaxis: {
      showgrid: false,
      fixedrange: true,
      tickfont: { size: 10 },
      automargin: true,
      // autorange: true,
    },
    yaxis2: {
      anchor: "x2",
      fixedrange: true,
      tickfont: { size: 10 },
      visible: false,
    },
    xaxis2: { domain: [0.73, 1], fixedrange: true, title: barcChartXAxisTitle },

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

// window.innerWidth < 1200
export const getTabletScreenSizeLayout = (
  data: any,
  heatmapXAxisTitle: string,
  barcChartXAxisTitle: string,
  heatmapXAxisTickLabels: string[],
  hoveredColumns: Set<number>,
  selectedColumns: Set<number>,
  range: any
): Partial<Layout> => {
  const yLength = [...new Set(data.y)].length;
  return {
    autosize: true,
    grid: { rows: 2, columns: 1, pattern: "independent" },
    // height: 650,
    margin: { t: 10, b: 100 },
    hovermode: "closest",
    hoverlabel: { namelength: -1 },
    dragmode: false,

    xaxis: {
      domain: [0, 1],
      automargin: true,
      title: {
        //standoff: 7,
        text: heatmapXAxisTitle,

        font: {
          size: 12, // Adjust this value to your desired font size
        },
      },
      showgrid: false,
      side: "top",
      showticklabels: false,
      ticks: "",
      rangeslider: {
        thickness: 0.05,
        visible: true,
        borderwidth: 2,
      },
      range,
    },

    yaxis: {
      showgrid: false,
      tickfont: { size: 10 },
      automargin: true,
      autorange: true,
    },

    yaxis2: {
      anchor: "x2",
      tickfont: { size: 10 },
      visible: true,
      fixedrange: true,
    },
    xaxis2: {
      domain: [0, 1],
      fixedrange: true,
      title: {
        standoff: 7,
        text: barcChartXAxisTitle,

        font: {
          size: 12,
        },
      },
    },

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
