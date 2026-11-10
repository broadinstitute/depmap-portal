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
