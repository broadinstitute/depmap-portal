import type { AnnotationTail } from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/plotUtils";

// Selection state owned by the caller, from Data Explorer's own useSelection
// hook. When omitted a plot is display-only, as it always was.
export interface PlotSelection {
  selectedPoints: Set<number>;
  pointsToAnnotate: Set<number>;
  selectionCount: number;
  onClickPoint: (pointIndex: number, ctrlKey: boolean) => void;
  onMultiselect: (pointIndices: number[]) => void;
  onClickResetSelection: () => void;
  // Keep Plotly's own box and lasso buttons and follow them.
  modebarSelectionTools: boolean;
  // Where the plot keeps the positions of dragged annotation tails. Owned by
  // the caller so they survive the plot being unmounted and remounted.
  annotationTailsRef?: { current: Record<string, AnnotationTail> };
}

// The correlation heatmap's own selection, from Data Explorer: clicking a cell
// selects the pair of entities (by id) it compares.
export interface HeatmapSelection {
  selectedLabels: Set<string>;
  onSelectLabels: (ids: string[]) => void;
}
