import {
  PlotlyCallbacks,
  PlotDataWithCustomdata,
  PlotlyDragmode,
} from "./plotlyPlot";

type PlotlyType = typeof import("plotly.js");

export interface PlotlyWrapperProps {
  Plotly: PlotlyType;
  /**
   * This is the core data structure passed to plotly
   * Changing this props will call Plotly.react, which resets any zoom or pan previously applied by the user
   * To make changes that do not reset this, one should call Plotly.restyle or Plotly.relayout using a ref. See the storybook example for coloring
   */
  plotlyParams: PlotlyParams;
  /**
   * If onPointClick is provided, PlotlyWrapper will add cursor pointer on hover, and check that the point is a single point on a scatter plot before triggering the onPointClick
   * It is highly recommended to memoize this function for performance improvements, because this prop goes into the dependency array of a useEffect that detaches and re-attaches all event handlers. For hook components, this means using useCallback
   */
  onPointClick?: (point: Plotly.PlotDatum) => void;
  /**
   * All plotly callbacks should be attached by passing this props
   * This is because PlotlyWrapper handles event handler lifecycles, and will clean up by removing all event handlers
   * Manually attaching handlers without using these props runs the risk of the handlers getting removed
   *
   * It is highly recommended to memoize this prop for performance improvements, because this prop goes into the dependency array of a useEffect that detaches and re-attaches all handlers. For hook components, this means using useMemo
   * */
  additionalPlotlyCallbacks?: PlotlyCallbacks;
  downloadIconWidgetProps?: DownloadIconWidgetProps; // if showWidgetOptions is not false use this prop
  dragmodeWidgetOptions?: Array<PlotlyDragmode>;
  showWidgetOptions?: boolean;

  /**
   *  Using SelectToLabelWidget requires
   *  1) setting this to true
   *  2) annotations to be provided on plotlyParams.layout, with "selectToLabelAnnotationKey" as a property on the annotations
   *    Annotation visibility should be initially set to false for performance reasons
   *  3) customdata provided on the data points, with "selectToLabelAnnotationKey" as a property on customdata
   */
  selectToLabelWidgetProps?: SelectToLabelWidgetProps;
  /**
   * If more than one widget is provided, the widgets must be rendered with a "key" prop for rendering sibling components
   */
  additionalToolbarWidgets?: Array<JSX.Element>;
  idPrefixForUniqueness?: string; // if showWidgetOptions is not false use this prop
}

export type PlotlyWrapperScatterData = Omit<
  PlotDataWithCustomdata,
  "selectedpoints" | "selected" | "unselected"
>;

// see assertSelectedPointsNotProvided for and explanation of these omissions
export type PlotlyWrapperData =
  | Partial<PlotlyWrapperScatterData>
  | Partial<
      Omit<Plotly.BoxPlotData, "selectedpoints" | "selected" | "unselected">
    >
  | Partial<
      Omit<Plotly.ViolinData, "selectedpoints" | "selected" | "unselected">
    >;

export type PlotlyWrapperLayout = Omit<Plotly.Layout, "dragmode">;

export type PlotlyParamsDatum = Partial<PlotlyWrapperData> & {
  customdata: any[];
};

export interface PlotlyParams {
  data: Partial<PlotlyWrapperData>[];
  layout: Partial<PlotlyWrapperLayout>;
  config: Partial<Plotly.Config>;
}

interface DownloadIconWidgetBaseProps {
  /**
   * Name of file when an image of a plot is downloaded. Please provide an informative name that distinguishes from other plots that the user could make.
   */
  downloadFilename: string;
}

interface DownloadWidgetWithNoDataProps extends DownloadIconWidgetBaseProps {
  downloadDataUrl?: never; // one or the other, or none
  downloadDataArray?: never;
}

interface DownloadWidgetWithDataUrlProps extends DownloadIconWidgetBaseProps {
  downloadDataUrl: string; // one or the other, or none
  downloadDataArray?: never;
}

interface DownloadWidgetWithDataArrayProps extends DownloadIconWidgetBaseProps {
  downloadDataUrl?: never; // one or the other, or none
  downloadDataArray: any[] | (() => any[]);
}

export type DownloadIconWidgetProps =
  | DownloadWidgetWithNoDataProps // don't provide data download,
  | DownloadWidgetWithDataUrlProps // or provide a data download either as a url to hit,
  | DownloadWidgetWithDataArrayProps; // or an in-memory array structure to download as csv

/**
 *  Using SelectToLabelWidget requires
 *  1) setting this to true
 *  2) annotations to be provided on plotlyParams.layout, with "selectToLabelAnnotationKey" as a property on the annotations
 *    Annotation visibility should be initially set to false for performance reasons
 *  3) customdata provided on the data points, with "selectToLabelAnnotationKey" as a property on customdata
 */
export interface SelectToLabelWidgetProps {
  /**
   * This prop exists because the only other prop is optional, this must be set to true
   */
  useSelectToLabelWidget: true;
  /**
   * Controls whether the dropdown expands up or down, default is down
   */
  dropup?: boolean;
}
