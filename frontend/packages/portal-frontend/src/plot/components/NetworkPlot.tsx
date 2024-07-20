/* eslint-disable */
import React, { useEffect } from "react";
import * as Plotly from "plotly.js";
import {
  addPlotlyCallbacks,
  PlotlyCallbacks,
  PlotlyDragmode,
  PlotlyWrapper,
} from "@depmap/plotly-wrapper";
import { useCombinedRefs } from "@depmap/utils";

type Props = {
  nodes: Array<{
    id: string | number;
    x: number;
    y: number;
    [otherProp: string]: any;
  }>;
  edges: Array<{ from: string | number; to: string | number; weight: number }>;
  dataOptions?: Partial<Plotly.PlotData>;
  layoutOptions?: Partial<Plotly.Layout>;
  // selectedPoints?: Array<number>;  // this is old functionality from constellation, that needs to be reimplemented in a way that doesn't use selectedpoints. I suspect that the new implementation will prefer using an array of something other than numbers
  callbacks?: PlotlyCallbacks;
  onPointClick?: (point: Plotly.PlotDatum) => void;
  dragmodeWidgetOptions?: Array<PlotlyDragmode>;
};

export const NetworkPlot = React.forwardRef((props: Props, ref) => {
  // If ref not forwarded, create a ref for plot
  const innerRef = React.useRef(null);
  const networkPlotlyRef = useCombinedRefs(ref, innerRef);

  const m = new Map<string | number, any>();
  props.nodes.forEach((node) => {
    m.set(node.id, node);
  });

  useEffect(() => {
    if (props.callbacks) {
      addPlotlyCallbacks(networkPlotlyRef.current, props.callbacks);
    }
  });

  const formatPlotlyParams = () => {
    const data: any = [
      {
        type: "scatter",
        mode: "markers",
        marker: {
          size: 10,
        },
        x: props.nodes.map((node) => node.x),
        y: props.nodes.map((node) => node.y),
        hoverinfo: "text",
        ...props.dataOptions,
      },
    ];

    const layout: Partial<Plotly.Layout> = {
      xaxis: {
        showline: false,
        showgrid: false,
        showticklabels: false,
        zeroline: false,
      },
      yaxis: {
        showline: false,
        showgrid: false,
        showticklabels: false,
        zeroline: false,
      },
      hovermode: "closest",
      margin: {
        l: 0,
        r: 0,
        b: 0,
        t: 20,
      },
      shapes: props.edges.map((edge) => {
        const head = m.get(edge.from);
        const tail = m.get(edge.to);
        const l: Partial<Plotly.Shape> = {
          type: "line",
          layer: "below",
          x0: head.x,
          x1: tail.x,
          y0: head.y,
          y1: tail.y,
          opacity: 0.4,
          line: {
            width: Math.min(edge.weight, 3),
          },
        };
        return l;
      }),
      ...(props.layoutOptions || {}),
    };

    const config = { responsive: true };

    return {
      data,
      layout,
      config,
    };
  };

  if (props.nodes !== null) {
    return (
      <PlotlyWrapper
        Plotly={Plotly}
        ref={networkPlotlyRef}
        plotlyParams={formatPlotlyParams()}
        downloadIconWidgetProps={{
          downloadFilename: "networkPlot",
        }}
        onPointClick={props.onPointClick} // temp solution until plotlywrapper fixed
        idPrefixForUniqueness="network-plot"
        dragmodeWidgetOptions={props.dragmodeWidgetOptions}
      />
    );
  }

  return null;
});
