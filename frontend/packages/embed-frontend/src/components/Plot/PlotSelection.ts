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
}

// The correlation heatmap's own selection, from Data Explorer: clicking a cell
// selects the pair of entities (by id) it compares.
export interface HeatmapSelection {
  selectedLabels: Set<string>;
  onSelectLabels: (ids: string[]) => void;
}
