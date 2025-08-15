import { Dispatch, SetStateAction, useRef } from "react";
import Plotly, { PlotlyHTMLElement, PlotMouseEvent } from "plotly.js";

import {
  CellignerSampleType,
  Alignments,
  Point,
} from "src/celligner/models/types";
import {
  PRIMARY_SITE_COLORS,
  PRIMARY_MET_COLORS,
  ALL_COLORS,
} from "src/celligner/utilities/colors";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

const MAX_POINTS_TO_ANNOTATE = 30;

const SKIP_LINEAGE_LABELS = new Set([
  "adrenal_cortex",
  "small_intestine",
  "embryo",
  "engineered_kidney",
  "engineered_lung",
  "engineered_prostate",
  "engineered_ovary",
  "engineered_breast",
  "engineered_central_nervous_system",
  "teratoma",
  "unknown",
  "pineal",
  "nasopharynx",
  "endocrine",
]);

export function getValidSelectedPoints(
  lassoOrBoxSelectedPoints: Set<number>,
  sidePanelSelectedPoints: Set<number>,
  selectedPoints: number[] // The indices of the colored points
) {
  let selectedPtsForContext = new Set([...lassoOrBoxSelectedPoints]);

  if (sidePanelSelectedPoints.size > 0 && lassoOrBoxSelectedPoints.size > 0) {
    const intersectionOfSelectionMethods = [
      ...sidePanelSelectedPoints,
    ].filter((value) => [...lassoOrBoxSelectedPoints].includes(value));

    selectedPtsForContext = new Set([...intersectionOfSelectionMethods]);
  }

  if (sidePanelSelectedPoints.size > 0 && lassoOrBoxSelectedPoints.size === 0) {
    selectedPtsForContext = new Set([...sidePanelSelectedPoints]);
  }

  const visibleSelectedPts =
    selectedPoints.length > 0
      ? [...selectedPtsForContext].filter((pt: number) =>
          selectedPoints.includes(pt)
        )
      : selectedPtsForContext;

  return new Set([...visibleSelectedPts]);
}

export function createFormattedAnnotatedPoints(
  annotatedPoints: Set<number>,
  alignments: Alignments
): any {
  const selectionAnnotations =
    annotatedPoints?.size <= MAX_POINTS_TO_ANNOTATE
      ? [...annotatedPoints]
          .filter(
            (pointIndex) =>
              typeof alignments.umap1[pointIndex] === "number" &&
              typeof alignments.umap2[pointIndex] === "number"
          )
          .map((pointIndex) => ({
            x: alignments.umap1[pointIndex],
            y: alignments.umap2[pointIndex],
            text:
              alignments.type[pointIndex] === CellignerSampleType.DEPMAP_MODEL
                ? `${alignments.displayName[pointIndex]}`
                : `${alignments.sampleId[pointIndex]}`,
            visible: true,
            xref: "x",
            yref: "y",
            arrowhead: 0,
            standoff: 4,
            arrowcolor: "#000",
            bordercolor: "#000",
            bgcolor: "#fff",
            pointIndex,
          }))
      : (() => {
          return annotatedPoints
            ? [
                {
                  text: `(${annotatedPoints.size} selected points)`,
                  arrowcolor: "transparent",
                  bordercolor: "#c7c7c7",
                  bgcolor: "#fff",
                },
              ]
            : null;
        })();

  return selectionAnnotations;
}

export function calculateLabelPositions(
  alignments: Alignments
): Array<Partial<Plotly.Annotations>> {
  const umapPositionsByPrimarySite = new Map<string, Array<Point>>();

  alignments.lineage.forEach((lineage, i) => {
    if (
      !lineage ||
      SKIP_LINEAGE_LABELS.has(lineage) ||
      alignments.subtype[i] === "osteosarcoma"
    ) {
      return;
    }
    if (!umapPositionsByPrimarySite.has(lineage)) {
      umapPositionsByPrimarySite.set(lineage, []);
    }
    umapPositionsByPrimarySite.get(lineage)?.push({
      x: alignments.umap1[i],
      y: alignments.umap2[i],
    });
  });

  const labelPositions: Array<Partial<Plotly.Annotations>> = [];
  umapPositionsByPrimarySite.forEach((coordinates, lineage) => {
    const medianIndex = Math.floor(coordinates.length / 2);
    labelPositions.push({
      x: coordinates.sort((a, b) => a.x - b.x)[medianIndex].x,
      y: coordinates.sort((a, b) => a.y - b.y)[medianIndex].y,
      text: lineage,
      showarrow: false,
    });
  });
  return labelPositions;
}

export function getGroupByColorPalette(
  alignments: Alignments
): Map<string, Array<Plotly.TransformStyle>> {
  const colorPalette = new Map<string, Array<Plotly.TransformStyle>>();
  colorPalette.set("lineage", PRIMARY_SITE_COLORS);
  colorPalette.set("primaryMet", PRIMARY_MET_COLORS);
  colorPalette.set("type", [
    { target: "depmap-model", value: { marker: { color: "#009acd" } } },
    { target: "met500-tumor", value: { marker: { color: "#f08080" } } },
    { target: "novartisPDX-model", value: { marker: { color: "#66cd00" } } },
    { target: "pediatricPDX-model", value: { marker: { color: "#ffd738" } } },
    { target: "tcgaplus-tumor", value: { marker: { color: "#9370db" } } },
  ]);

  const aFewDivergentColors = [
    "#009acd",
    "#f08080",
    "#66cd00",
    "#ffd738",
    "#9370db",
  ];

  const makeColorMap = (
    values: Array<string | number>,
    colorSet: Array<string>
  ) => {
    return Array.from(new Set(values))
      .sort()
      .map((value, i) => {
        return {
          target: value,
          value: { marker: { color: colorSet[i % colorSet.length] } },
        };
      });
  };

  const makeCellLineSetColorMap = (values: Array<string | number>) => {
    return Array.from(new Set(values))
      .sort()
      .map((value) => {
        return {
          target: value,
          value:
            value === "other"
              ? { marker: { color: "#ADD8E6", opacity: 0.1 } }
              : {
                  marker: {
                    color: "#FF0000",
                    opacity: 0.8,
                  },
                },
        };
      });
  };

  colorPalette.set("subtype", makeColorMap(alignments.subtype, ALL_COLORS));
  colorPalette.set("cluster", makeColorMap(alignments.cluster, ALL_COLORS));
  colorPalette.set(
    "growthPattern",
    makeColorMap(alignments.growthPattern, aFewDivergentColors)
  );
  colorPalette.set(
    "cellLineSet",
    makeCellLineSetColorMap(alignments.cellLineSet)
  );

  return colorPalette;
}

function formatHoverTexts(alignments: Alignments): Array<string> {
  const {
    modelConditionId,
    sampleId,
    displayName,
    type,
    lineage,
    subtype,
    primaryMet,
    // tcga_type,
    growthPattern,
    cluster,
  } = alignments;
  return modelConditionId.map((id, i: number) =>
    [
      `Model Condition ID: ${modelConditionId[i]}`,
      `${
        type[i] === CellignerSampleType.DEPMAP_MODEL ? "Depmap ID" : "Sample ID"
      }: ${sampleId[i]}`,
      type[i] === CellignerSampleType.DEPMAP_MODEL
        ? `Cell Line Name: ${displayName[i]}`
        : null,
      `Type: ${type[i]}`,
      `Lineage: ${lineage[i] || "N/A"}`,
      `Subtype: ${subtype[i] || "N/A"}`,
      `Origin: ${primaryMet[i] || "N/A"}`,
      `Growth Pattern: ${growthPattern[i] || "N/A"}`,
      // `TCGA Type: ${tcga_type[i] || "N/A"}`,
      `Cluster: ${cluster[i]}`,
    ]
      .filter((x) => x)
      .join("<br>")
  );
}

export function getSampleTypeTransform(
  alignments: Alignments,
  cellLinePointSize: number,
  tumorPointSize: number
): Partial<Plotly.Transform> {
  return {
    type: "groupby",
    groups: alignments.type,
    styles: [
      {
        target: CellignerSampleType.DEPMAP_MODEL,
        value: {
          marker: {
            size: cellLinePointSize,
            line: {
              width: 1,
            },
          },
        },
      },
      {
        target: CellignerSampleType.NOVARTIS_PDX_MODEL,
        value: {
          marker: {
            size: cellLinePointSize,
            line: {
              width: 1,
            },
            symbol: "diamond",
          },
        },
      },
      {
        target: CellignerSampleType.PEDIATRIC_PDX_MODEL,
        value: {
          marker: {
            size: cellLinePointSize,
            line: {
              width: 1,
            },
            symbol: "diamond",
          },
        },
      },
      {
        target: CellignerSampleType.MET500_TUMOR,
        value: {
          marker: {
            size: cellLinePointSize,
            symbol: "triangle-up",
          },
        },
      },
      {
        target: CellignerSampleType.TCGA_TUMOR,
        value: {
          marker: {
            size: tumorPointSize,
            symbol: "cross",
          },
        },
      },
    ],
  };
}

export function buildPlot(
  plotElement: ExtendedPlotType,
  alignments: Alignments,
  selectedPoints: Array<number>,
  annotatedPoints: Array<Partial<Plotly.Annotations>> | undefined,
  labelPositions: Array<Partial<Plotly.Annotations>>,
  categoryArr: Array<string> | Array<number>,
  colors: Array<Plotly.TransformStyle>,
  cellLinePointSize: number,
  tumorPointSize: number,
  unselectTableRows: () => void = () => {},
  onSelected: (pointIndexes: number[]) => void = () => {}
) {
  const plotlyData: Array<Partial<Plotly.ScatterData>> = [
    {
      type: "scattergl",
      mode: "markers",
      x: alignments.umap1,
      y: alignments.umap2,
      selectedpoints: selectedPoints,
      // @ts-expect-error https://github.com/plotly/plotly.js/blob/55dda47/src/traces/scatter/attributes.js#L555
      selected: {
        marker: {
          opacity: 0.7,
        },
      },
      unselected: {
        marker: {
          opacity: 0.2,
          color: "#ccc",
        },
      },
      text: formatHoverTexts(alignments),
      hoverinfo: "text",
      transforms: [
        getSampleTypeTransform(alignments, cellLinePointSize, tumorPointSize),
        {
          type: "groupby",
          groups: categoryArr,
          styles: colors,
        },
      ],
    },
  ];

  const annotations = annotatedPoints
    ? annotatedPoints.concat(labelPositions)
    : labelPositions;

  const layout: Partial<Plotly.Layout> = {
    xaxis: {
      showgrid: false,
      showline: false,
      showticklabels: false,
      zeroline: false,
    },
    yaxis: {
      showgrid: false,
      showline: false,
      showticklabels: false,
      zeroline: false,
    },
    hovermode: "closest",
    showlegend: false,
    annotations,
    margin: {
      l: 0,
      r: 0,
      b: 0,
      t: 20,
    },
    colorway: ALL_COLORS,
  } as any;

  Plotly.plot(plotElement, plotlyData, layout, {
    responsive: true,
    edits: { annotationTail: true },
  });

  // Keep track of added listeners so we can easily remove them.
  const listeners: [string, (e: any) => void][] = [];

  const on = (eventName: string, callback: (e: any) => void) => {
    plotElement.on(
      eventName as Parameters<PlotlyHTMLElement["on"]>[0],
      callback as Parameters<PlotlyHTMLElement["on"]>[1]
    );
    listeners.push([eventName, callback]);
  };

  const getButton = (attr: string, val: string) =>
    plotElement.querySelector(
      `.modebar-btn[data-attr="${attr}"][data-val="${val}"]`
    ) as HTMLAnchorElement;

  const zoom = (val: "in" | "out" | "reset") => {
    getButton("zoom", val).click();

    Plotly.relayout(plotElement, {});
  };

  // Add a few non-standard methods to the plot for convenience.
  /* eslint-disable no-param-reassign */
  plotElement.setDragmode = (dragmode) => {
    setTimeout(() => {
      Plotly.update(plotElement, {}, { dragmode });
      // This redraw fixes a very strange bug where setting the drag mode to
      // select (or lasso) with a filter also applied causes all of the points
      // to disappear.
      Plotly.redraw(plotElement);
    }, 0);
  };

  plotElement.zoomIn = () => setTimeout(zoom, 0, "in");
  plotElement.zoomOut = () => setTimeout(zoom, 0, "out");
  plotElement.resetZoom = () => {
    const nextLayout = { ...plotElement.layout };
    (plotElement.layout.shapes as any) = undefined;
    zoom("reset");
    Plotly.react(plotElement, plotlyData, nextLayout, {
      responsive: true,
      edits: { annotationTail: true },
    });
  };

  plotElement.removeAnnotations = () => {
    const relayout: Partial<Plotly.Layout> = {};

    // When removing the annotations, maintain the cluster labels
    (relayout as any).annotations = labelPositions;
    unselectTableRows();

    Plotly.relayout(plotElement!, relayout);
  };

  on("plotly_selected", (e: PlotMouseEvent) => {
    const pointIndexes = e.points.map((point) => point.pointIndex);

    onSelected(pointIndexes);
  });

  // WORKAROUND: Double-click is supposed to reset the zoom but it only works
  // actually intermittently so we'll do it ourselves.
  on("plotly_doubleclick", () => {
    plotElement.resetZoom();
  });

  // https://github.com/plotly/plotly.js/blob/55dda47/src/lib/prepare_regl.js
  on("plotly_webglcontextlost", () => {
    // Fixes a bug where points disappear after the browser has been left
    // idle for some time.
    Plotly.redraw(plotElement);
  });

  return () => {
    listeners.forEach(([eventName, callback]) =>
      plotElement.removeListener(eventName, callback)
    );
  };
}

// When the plot legend is double-clicked, we want to either show or hide all
// of the items to mimic the behavior of Plotly's built-in legends.
export function useLegendCLickLogic(
  legendKeys: Array<string | number>,
  setHiddenLegendKeys: Dispatch<SetStateAction<Set<string | number>>>
) {
  const recentClickKey = useRef<string | number | null>(null);

  const handleClick = (key: string | number) => {
    if (recentClickKey.current === key) {
      setHiddenLegendKeys((prev) => {
        if (prev.has(key) && prev.size !== legendKeys.length) {
          const next = new Set(legendKeys);
          next.delete(key);
          return next;
        }

        return new Set();
      });
    } else {
      recentClickKey.current = key;

      setTimeout(() => {
        recentClickKey.current = null;
      }, 300);

      setHiddenLegendKeys((prev) => {
        const next = new Set(prev);

        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        return next;
      });
    }
  };

  return { handleClick };
}

export const sampleTypeToLabel: Map<CellignerSampleType, string> = new Map([
  [CellignerSampleType.DEPMAP_MODEL, "DepMap cell line"],
  [CellignerSampleType.MET500_TUMOR, "Met500 tumors"],
  [CellignerSampleType.NOVARTIS_PDX_MODEL, "Novartis PDX"],
  [CellignerSampleType.PEDIATRIC_PDX_MODEL, "Pediatric PDX"],
  [CellignerSampleType.TCGA_TUMOR, "TCGA+ Tumors"],
]);
