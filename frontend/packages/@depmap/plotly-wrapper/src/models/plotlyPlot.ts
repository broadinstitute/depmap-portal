export interface PlotHTMLElement extends Plotly.PlotlyHTMLElement {
  layout: any; // plotly layout object
}

export type PlotlyCallbacks = {
  plotly_click?: (event: Plotly.PlotMouseEvent) => void;
  plotly_hover?: (event: Plotly.PlotMouseEvent) => void;
  plotly_unhover?: (event: Plotly.PlotMouseEvent) => void;
  plotly_selecting?: (event: Plotly.PlotSelectionEvent) => void;
  plotly_selected?: (event: Plotly.PlotSelectionEvent) => void;
  plotly_restyle?: (data: Plotly.PlotRestyleEvent) => void;
  plotly_relayout?: (event: Plotly.PlotRelayoutEvent) => void;
  plotly_relayouting?: (event: Plotly.PlotRelayoutEvent) => void;
  plotly_clickannotation?: (event: Plotly.ClickAnnotationEvent) => void;
  plotly_animatingframe?: (event: Plotly.FrameAnimationEvent) => void;
  plotly_legendclick?: (event: Plotly.LegendClickEvent) => boolean;
  plotly_legenddoubleclick?: (event: Plotly.LegendClickEvent) => boolean;
  plotly_sliderchange?: (event: Plotly.SliderChangeEvent) => void;
  plotly_sliderend?: (event: Plotly.SliderEndEvent) => void;
  plotly_sliderstart?: (event: Plotly.SliderStartEvent) => void;
  plotly_event?: (data: any) => void;
  plotly_beforeplot?: (event: Plotly.BeforePlotEvent) => boolean;
  plotly_afterexport?: () => void;
  plotly_afterplot?: () => void;
  plotly_animated?: () => void;
  plotly_animationinterrupted?: () => void;
  plotly_autosize?: () => void;
  plotly_beforeexport?: () => void;
  plotly_deselect?: () => void;
  plotly_doubleclick?: () => void;
  plotly_framework?: () => void;
  plotly_redraw?: () => void;
  plotly_transitioning?: () => void;
  plotly_transitioninterrupted?: () => void;
};

export type PlotlyDragmode =
  | "zoom"
  | "pan"
  | "select"
  | "lasso"
  | "orbit"
  | "turntable"
  | false;

export interface PlotDataWithCustomdata extends Plotly.PlotData {
  customdata: any;
}
