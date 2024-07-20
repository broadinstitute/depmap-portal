import { colorPalette } from "depmap-shared";

type PlotlyType = typeof import("plotly.js");

type HighlightFunction<T> = (
  cellLine: string,
  cellLinesToHighlight: Set<string>
) => T;
type GetHighlightArrayOrDefault<T> = (
  cellLines: Array<string>,
  cellLinesToHighlight: Set<string>,
  highlightFunction: HighlightFunction<T>,
  defaultValue: any
) => Array<T> | T;

export function getSelectedCellLineListName() {
  const selectedList = window.localStorage.getItem("selectedCellLineListName");

  if (selectedList === null) {
    window.localStorage.setItem("selectedCellLineListName", "None");
    return "None";
  }

  return selectedList;
}

export function setSelectedCellLineListName(listName: string) {
  window.localStorage.setItem("selectedCellLineListName", listName);
}

export const getHighlightLineColor = () => {
  return colorPalette.highlight_star_outline_color;
};
export const getDefaultColor = (entityType = "gene") => {
  if (entityType === "compound_experiment") {
    return colorPalette.compound_color;
  }
  return colorPalette.gene_color;
};

let categoryColor: d3.scale.Ordinal<string, string>;
export const getCategoryToColor = (
  Plotly: PlotlyType,
  category: number | string = ""
) => {
  categoryColor = categoryColor || Plotly.d3.scale.category10();
  return categoryColor(category.toString());
};

export const mutationNumToColor = (color_num: number, entityType = "gene") => {
  // it would be nice to be able to assert that `color_num in colorKey`.
  // otherwise, things tend to silently default to plotly default colors, which in combination with these specified colors can result in things like two orange colors in a row
  const colorKey: { [key: number]: string } = {
    0: getDefaultColor(entityType),
    1: colorPalette.other_conserving_color,
    2: colorPalette.other_non_conserving_color,
    3: colorPalette.damaging_color,
    4: colorPalette.hotspot_color,
  };
  return colorKey[color_num];
};
export const importanceNumToColor = (
  color_num: number,
  entityType = "gene"
) => {
  // it would be nice to be able to assert that `color_num in colorKey`.
  // otherwise, things tend to silently default to plotly default colors, which in combination with these specified colors can result in things like two orange colors in a row
  const colorKey: { [key: number]: string } = {
    0: getDefaultColor(entityType),
    1: colorPalette.interesting_color, // TDA uses 1
    2: colorPalette.interesting_color, // data explorer uses 2. this difference is not intentional and this is a hack
    // fixme
    4: colorPalette.selected_color,
  };
  return colorKey[color_num];
};

export const getHighlightArrayOrDefault: GetHighlightArrayOrDefault<
  number | string
> = (cellLines, cellLinesToHighlight, highlightFunction, defaultValue) => {
  let array;
  if (cellLinesToHighlight.size > 0) {
    array = cellLines.map((x: string) => {
      return highlightFunction(x, cellLinesToHighlight);
    });
  } else {
    array = defaultValue;
  }
  return array;
};

export const getHighlightOpacity = (
  cellLine: string,
  cellLinesToHighlight: Set<string>
) => {
  if (cellLinesToHighlight.has(cellLine)) {
    return 1;
  }
  return 0.5;
};

export const getHighlightLineWidth = (
  cellLine: any,
  cellLinesToHighlight: any
) => {
  if (cellLinesToHighlight.has(cellLine)) {
    return 1;
  }
  return 0;
};

export const getHighlightSymbol: HighlightFunction<string> = (
  cellLine: string,
  cellLinesToHighlight: Set<string>
) => {
  if (cellLinesToHighlight.has(cellLine)) {
    return "star";
  }
  return "circle";
};
