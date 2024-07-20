import PlotlyWrapper from "../components/PlotlyWrapper";
import * as Plotly from "plotly.js";
import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import useDeepCompareEffect from "use-deep-compare-effect";
import { getPlotlyParams } from "./plotlyWrapperData";
import { PlotlyDragmode } from "../models/plotlyPlot";

export default {
  title: "Components/Plot/PlotlyWrapper",
  component: PlotlyWrapper,
  // Add spacing so that we can see toolbar hovers. (Story: any) is the best typing I can come up with from looking at the docs and source code
  decorators: [
    (Story: any) => (
      <div style={{ margin: "30px" }}>
        <Story />
      </div>
    ),
  ],
};

export const Minimal = () => {
  const plotlyParams = {
    data: [
      {
        x: [0.67, -0.522, 0.4554, 0.409, -0.309, 0.1932, -0.148, 0.0379],
        y: [0.0338, 0.121, 0.1858, 0.239, 0.384, 0.592, 0.682, 0.922],
      },
    ],
    layout: {},
    config: {},
  };
  return (
    <PlotlyWrapper
      Plotly={Plotly}
      plotlyParams={plotlyParams}
      downloadIconWidgetProps={{
        downloadFilename: "example_minimal_plot",
      }}
      idPrefixForUniqueness="storybook-base-plot"
    />
  );
};

export const CustomDefaultDragmodeWidgets = () => {
  const plotlyParams = {
    data: [
      {
        x: [0.67, -0.522, 0.4554, 0.409, -0.309, 0.1932, -0.148, 0.0379],
        y: [0.0338, 0.121, 0.1858, 0.239, 0.384, 0.592, 0.682, 0.922],
      },
    ],
    layout: {},
    config: {},
  };
  const dragmodeWidgetOptions: Array<PlotlyDragmode> = ["pan"];
  return (
    <PlotlyWrapper
      Plotly={Plotly}
      plotlyParams={plotlyParams}
      downloadIconWidgetProps={{
        downloadFilename: "example_minimal_plot",
      }}
      dragmodeWidgetOptions={dragmodeWidgetOptions}
      idPrefixForUniqueness="storybook-base-plot"
    />
  );
};

/**
 * A simple template for story widgets
 */
class StoryButtonWidget extends React.Component<
  {
    onClick: () => void;
    children: React.ReactNode;
  },
  any
> {
  render() {
    return (
      <button
        type="button"
        onClick={this.props.onClick}
        className="btn btn-default btn-sm"
      >
        {this.props.children}
      </button>
    );
  }
}

export const AllFeatures = () => {
  const [dataToggle, setDataToggle] = useState(true); // two options, corresponding to true or false
  const [color, setColor] = useState("red");
  const [uselessState, setUselessState] = useState(true); // this is used to cause a re-render without actually doing anything, and in a real component would correspond to other unrelated state changes
  const plotlyRef = React.useRef(null);

  /**
   * This is an example of a widget that changes plotlyParams.
   * Applying changes by changing plotlyParams should be limited to when the underlying data is changed and there is a "conceptually new plot"
   * It should not be used to change styling of a given plot, for instance to color a clicked point
   *
   * This is because a change to plotlyParams will call Plotly.react
   * Plotly.react is disruptive because it resets
   *  - Any zoom or pan previously applied by the user
   *  - Any changes previously applied by Plotly.restyle, Plotly.layout, etc. that are not also reflected in plotlyParams
   *    - e.g., if you changed color with Plotly.restyle, but specify a different color in plotlyParams
   *    - These Plotly.restyle changes can be persisted by writing useEffects that re-apply when plotlyParams changes, see the color widget for an example)
   *
   * Thus, changes to styling should be done by calling Plotly.restyle instead of passing plotlyParams. See the color widget for an example.
   *
   * An exception can be made for refactoring existing components to use PlotlyWrapper
   * In these cases, it is often easier to pass everything (including e.g. color styling) through plotlyParams
   *  - Doing so will reset any zoom or pan. However, this is usually already the behavior of existing components
   *  - Changes previously applied by Plotly.restyle, Plotly.layout that are not re-applied will be lost. However, existing components usually don't have these
   */
  class ChangePlotlyParamsWidget extends React.Component<any, any> {
    render() {
      return (
        <StoryButtonWidget onClick={() => setDataToggle(!dataToggle)}>
          Toggle data: {dataToggle.toString()}
        </StoryButtonWidget>
      );
    }
  }

  // Note that this object has a different identity on every render
  const plotlyParams = getPlotlyParams(dataToggle);

  const getDownloadData = (data: Array<any>) => {
    const downloadData: any = [];
    data.forEach((trace) => {
      for (let i = 0; i < trace.x.length; i++) {
        const point = {
          x: trace.x[i],
          y: trace.y[i],
          label: trace.customdata[i].selectToLabelAnnotationKey,
        };
        downloadData.push({
          Label: point.label,
          Correlation: point.x,
          PValue: point.y,
        });
      }
    });
    return downloadData;
  };

  /**
   * This widget sets a state that triggers the renderPlotColor useEffect below
   */
  class ColorWidget extends React.Component<any, any> {
    render() {
      return (
        <StoryButtonWidget
          onClick={() => setColor(color == "red" ? "green" : "red")}
        >
          Toggle color: {color}
        </StoryButtonWidget>
      );
    }
  }

  /**
   * renderPlotColor
   *   When color changes or plotlyParams changes changes, recolor the plot
   *
   *   Use of Plotly.restyle instead of coloring by plotlyParams
   *     When applying styling or layout changes, it is preferable to call plotly functions such as restyle and relayout instead of passing different plotlyParams props
   *     Documentation for these functions: https://plotly.com/javascript/plotlyjs-function-reference/#plotlyrestyle
   *     See the docstring of ChangePlotlyParamsWidget for why passing different plotlyParams is disruptive
   *       An exception can be made for refactoring existing components, again see the docstring
   *
   *   Calling Plotly.restyle on the ref
   *     A ref to the plotly DOM element can be obtained as shown here; `plotlyRef.current` will give you the element
   *     There might be bugs about the ref being undefined on the initial render
   *       If so, the ref can be instead stored in a state, as in `const [plotlyRefState, setPlotlyRefState] = useState<PlotHTMLElement>();`
   *       That state can go in the dependency array of this useEffect, so that it can check whether the value is defined, and re-trigger when it changes
   *       The VolcanoPlot component does this
   *
   *   Persistence of coloring across new plotlyParams
   *     PlotlyWrapper will redraw the plot with Plotly.react when the deep equality of plotlyParams changes
   *     If toolbar widgets want to persist changes across new plotlyParams, it is the responsibility of the widget to reapply the change when plotlyParams changes
   *     This means that the useEffect for coloring should have a dependency array that includes plotlyParams
   *     To avoid unnecessary reapplying for performance reasons, useDeepCompareEffect should be used instead of useEffect when plotlyParams is in the array
   */
  useDeepCompareEffect(() => {
    if (plotlyRef.current) {
      console.debug("coloring");
      const update = {
        "marker.color": color,
      };
      Plotly.restyle(plotlyRef.current, update, [0]);
    }
  }, [color, plotlyParams]);

  class UselessStateWidget extends React.Component<any, any> {
    // this widget merely causes a re-render, and can be useful for testing behavior of this story
    render() {
      return (
        <StoryButtonWidget onClick={() => setUselessState(!uselessState)}>
          Useless state: {uselessState.toString()}
        </StoryButtonWidget>
      );
    }
  }

  // Assemble the array of widgets to pass to PlotlyWrapper
  // components must be rendered with a "key" prop for rendering sibling components
  const additionalToolbarWidgets: Array<JSX.Element> = [
    <ChangePlotlyParamsWidget key="changePlotlyParamsWidget" />,
    <ColorWidget key="colorWidget" />,
    <UselessStateWidget key="uselessStateWidget" />,
  ];

  /**
   * Note that this is memoized
   *   If this was not memoized, it would have a new identity on every render, and cause all event handlers to be removed and re-attached on every render
   *   In a class component, this can be done by putting the function as a static function on the class
   */
  const memoizedOnPointClick = useCallback(
    (point: unknown) => console.log(point),
    []
  );

  // To see the difference, turn on verbose console logging and switch to this commented, un-memoized version. You should see that event handlers are removed and re-attached on every re-render
  // const memoizedOnPointClick = (point) => console.log(point)

  // Similarly, this object is also memoized for the same reasons
  const memoizedAdditionalPlotlyCallbacks = useMemo(() => {
    return {
      plotly_click: () => console.log("clicked"),
    };
  }, []);

  return (
    <PlotlyWrapper
      Plotly={Plotly}
      ref={plotlyRef}
      plotlyParams={plotlyParams}
      onPointClick={memoizedOnPointClick}
      additionalPlotlyCallbacks={memoizedAdditionalPlotlyCallbacks}
      downloadIconWidgetProps={{
        downloadFilename: "story_NRAS_Avana_CERES_vs_PTEN_Expression",
        downloadDataUrl: "/story-csv",
        // downloadDataArray: getDownloadData(plotlyParams.data), // uncomment to see this other option, it's one or the other
      }}
      selectToLabelWidgetProps={{ useSelectToLabelWidget: true }}
      idPrefixForUniqueness="storybook-base-plot"
      additionalToolbarWidgets={additionalToolbarWidgets}
    />
  );
};
