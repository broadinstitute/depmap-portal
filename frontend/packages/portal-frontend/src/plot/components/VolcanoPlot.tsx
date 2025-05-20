/* eslint-disable */
// converts y axis data to log10
import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { useCombinedRefs } from "@depmap/utils";

import * as Plotly from "plotly.js";
import {
  PlotHTMLElement,
  PlotlyCallbacks,
  PlotlyDragmode,
  PlotlyParams,
  PlotlyWrapper,
  addPlotlyCallbacks,
} from "@depmap/plotly-wrapper";

import * as models from "src/plot/models/volcanoPlotModels";
import * as utils from "src/plot/utilities/volcanoPlotUtils";

type VolcanoPlotProps = {
  xLabel: string;
  yLabel: string;
  data: Array<models.VolcanoData>;
  bounds?: { width: number | undefined; height: number };
  annotations?: Array<Partial<Plotly.Annotations>>;
  highlightedPoints?: Array<number>;
  // resizer: PlotResizer;
  onSelectedLabelChange?: models.OnSelectedLabelChange;
  // };
  onPointClick?: (point: Plotly.PlotDatum) => void;
  dragmodeWidgetOptions?: Array<PlotlyDragmode>;
} & Omit<
  React.ComponentProps<typeof PlotlyWrapper>,
  "plotlyParams" | "onPointClick"
>;
/**
 * Forward any additional PlotlyWrapper props, with the exception of:
 *  plotlyParams (which should be provided through data)
 *  onPointClick (which should be provided through onSelectedLabelChange). Anticipating that uses of VolcanoPlot will either want clicking to change the selected point (which is built into and encapsulated by this component), or will not want any onClick behavior
 */

export const VolcanoPlot = React.forwardRef((props: VolcanoPlotProps, ref) => {
  // store the ref on state, so that the callbacks (additionalPlotlyCallbacks and onPointClick) can get notified to updated with the actual ref after it is populated
  const [plotlyRefState, setPlotlyRefState] = useState<PlotHTMLElement>();
  const innerRef = useCallback((node: PlotHTMLElement) => {
    setPlotlyRefState(node);
  }, []);
  const refForPlotlyWrapper = useCombinedRefs(ref, innerRef);

  const memoizedAdditionalPlotlyCallbacks = useMemo(
    () => utils.getHoverCallbacks(plotlyRefState as PlotHTMLElement),
    [plotlyRefState]
  );

  function buildPlotlyWrapper(plotlyParams: PlotlyParams) {
    return (
      <PlotlyWrapper
        {...props}
        ref={refForPlotlyWrapper}
        plotlyParams={plotlyParams}
        downloadIconWidgetProps={props.downloadIconWidgetProps}
        additionalPlotlyCallbacks={memoizedAdditionalPlotlyCallbacks}
        onPointClick={props.onPointClick}
        idPrefixForUniqueness={props.idPrefixForUniqueness}
        dragmodeWidgetOptions={props.dragmodeWidgetOptions}
        showWidgetOptions={false}
      />
    );
  }

  return buildPlotlyWrapper({
    data: utils.formatTrace(props.data, props.highlightedPoints),
    layout: utils.formatLayout(
      props.xLabel,
      props.yLabel,
      props.bounds as any,
      props.annotations
    ),
    config: {},
  });
});
