import { SelectToLabelWidgetProps } from "./plotlyWrapper";

export interface SelectToLabelProps extends SelectToLabelWidgetProps {
  visibleLabels: Set<string>;
  setVisibleLabels: (visibleLabels: Set<string>) => void;
  plotlySelectedEvent?: Plotly.PlotSelectionEvent;
  setPlotlySelectedEvent: (
    plotlySelectedEvent: Plotly.PlotSelectionEvent
  ) => void;

  idPrefixForUniqueness: string;
  plotlyLayout: Partial<Plotly.Layout>;
  plotlyConfig: Partial<Plotly.Config>;
  setDragmodeBoxSelect: () => void;
  setDragmodeLassoSelect: () => void;
}
