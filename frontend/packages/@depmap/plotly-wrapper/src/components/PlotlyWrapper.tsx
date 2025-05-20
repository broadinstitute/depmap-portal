/* eslint-disable */
import * as React from "react";
import { useEffect, useState } from "react";
import { ButtonGroup } from "react-bootstrap";
import { PlotlyDragmode } from "../models/plotlyPlot";
import { addPlotlyCallbacks } from "../utilities/plotly";
import { assert, useCombinedRefs } from "@depmap/utils";
import { DownloadIcon } from "./DownloadIcon";
import { DragmodeWidget } from "./DragmodeWidget";
import { SelectToLabel } from "./SelectToLabel";

import {
  PlotlyWrapperProps,
  PlotlyParamsDatum,
  PlotlyParams,
  SelectToLabelWidgetProps,
} from "../models/plotlyWrapper";
import * as utils from "../utilities/plotlyWrapperUtils";
import * as selectToLabelUtils from "../utilities/selectToLabelUtils";
import * as dragmodeWidgetUtils from "../utilities/dragmodeWidgetUtils";
import useDeepCompareEffect from "use-deep-compare-effect";
import cloneDeep from "lodash.clonedeep";

// This component doesn't emit any DOM. It only exists to conditionally perform
// some assertions for debugging purposes.
const DevAssertions = (props: {
  dragmodeWidgetOptions: PlotlyDragmode[];
  selectToLabelWidgetProps?: SelectToLabelWidgetProps;
  plotlyParams: PlotlyParams;
}): null => {
  /**
   * This is assuming we need to provide at least one dragmode option
   */
  assert(
    props.dragmodeWidgetOptions.length,
    "Must have at least one dragmode option"
  );

  /* If the SelectToLabel prop is provided
    check if at least one annotation has the toggle key
    check if at least one point has customdata with the toggle key */
  useDeepCompareEffect(() => {
    if (props.selectToLabelWidgetProps) {
      const haveAtLeastOneAnnotation = () => {
        if (props.plotlyParams.layout?.annotations) {
          for (const a of props.plotlyParams.layout.annotations) {
            if ("selectToLabelAnnotationKey" in a) {
              return true;
            }
          }
          return false;
        }
        return false;
      };
      const haveCustomDataDefined = () => {
        for (const d of props.plotlyParams.data as PlotlyParamsDatum[]) {
          for (const c of d.customdata) {
            if ("selectToLabelAnnotationKey" in c) {
              return true;
            }
          }
        }
        return false;
      };
      assert(
        haveAtLeastOneAnnotation(),
        "Expected annotations field in layout."
      );
      assert(
        haveCustomDataDefined(),
        `Expected customdata field in data with key ${"selectToLabelAnnotationKey"}.`
      );
    }
  }, [props.selectToLabelWidgetProps, props.plotlyParams]);

  return null;
};

const PlotlyWrapper = React.forwardRef((props: PlotlyWrapperProps, ref) => {
  const innerRef = React.useRef(null);
  const plotlyRef = useCombinedRefs(ref, innerRef);

  /**
   * In this state is used to notify the toolbar and any widgets that the plot has been rebuilt, so those things don't have to include a bunch  of if blocks to check if plotlyRef.current is defined)
   * This could likely be reworked to a better setup
   */
  const [plotlyRefInitialized, setPlotlyRefInitialized] = useState(false);
  /**
   * plotlyRefInitialized
   */
  useEffect(() => {
    setPlotlyRefInitialized(true);
  }, []);

  /**
   * Set default dragmode options if not passed as props
   */
  let { dragmodeWidgetOptions } = props;
  if (dragmodeWidgetOptions == null) {
    dragmodeWidgetOptions = ["zoom", "pan", "select", "lasso"];
  }
  /**
   * Set dragmode to the first item in list
   */
  const [selectedDragmode, setSelectedDragmode] = useState<PlotlyDragmode>(
    dragmodeWidgetOptions[0]
  );
  const setDragmodeZoom = () => {
    setSelectedDragmode("zoom");
  };
  const setDragmodePan = () => {
    setSelectedDragmode("pan");
  };
  const setDragmodeBoxSelect = () => setSelectedDragmode("select");
  const setDragmodeLassoSelect = () => setSelectedDragmode("lasso");

  /**
   * Set of labels that are currently visible
   */
  const [visibleLabels, setVisibleLabels] = useState<Set<string>>(new Set());

  /**
   * The last fired plotly selection event
   * As an issue of performance and memory usage, we are holding the entire plotly event in state, as opposed to some processed form or new object
   *   We can imagine multiple toolbar widgets and components wanting to know what points have been selected
   *   If the user selects the entire plot, and every widget separately stores that, that might be a lot to hold and process
   *   So instead, we store the original event in state. This means that each widget is only storing a pointer.
   */
  const [plotlySelectedEvent, setPlotlySelectedEvent] = useState<
    Plotly.PlotSelectionEvent | undefined
  >(undefined);

  /**
    renderPlotlyParams
      When the underlying plotlyParams data changes, rebuild the plot
      
      THIS HAS TO BE THE FIRST USEEFFECT, at least before any other calls to Plotly functions
        - This the order of useEffect execution. useEffects execute in order within a component, and from child to parent. Thus this useEffect will be the first to trigger when props.plotlyParams changes

      Calling Plotly.react is disruptive. This resets the following, if they are not specified in plotlyParams:
        - Any zoom or pan previously applied by the user
        - Any changes previously applied by Plotly.restyle, Plotly.layout, etc. (These can be persisted by writing useEffects that re-apply when plotlyParams changes)
        - It is as if newPlot was called, but with better performance and without removing event handlers
      
      It is the responsibility of any toolbar widget writers to re-apply any effects that should persist across changes to plotlyParams
        - For instance, this component has a useEffect to reapply and thus persist the dragmode and visible labels previously selected by the user.
        - In the storybook example PlotlyWrapper.stories.tsx, the component has a useEffect to reapply and thus persist previously selected coloring
      
      This effect makes the contract that it will only be triggered when the plotlyParams props changes
        - Thus, toolbar widgets should reapply effects when the plotlyParams props to this component changes
        - This also relies on the order of useEffect execution as described above

    This is a deep comparison because
      1) Performance, to only call Plotly.react when necessary
      2) We need to synchronize with the useEffects for toolbar widgets that want to persist effects by re-applying them across calls to Plotly.react
        - The contract is that Plotly.react will only be called when props.plotlyParams changes
        - It is safe if toolbar widgets reapply their effects more often than necessary. It is unsafe they want to persis effects but fell to reapply when this updatePlotCore effect runs
        - Thus, to be conservative we do a deep comparison
  */
  useDeepCompareEffect(() => {
    let processedPlotlyParams = cloneDeep(props.plotlyParams);
    utils.assertSelectedPointsNotProvided(processedPlotlyParams);
    /**
      Apply baseline widget requirements that never change, to Plotly config
      In theory we might want to be able to opt out of them if the widgets are not used. I do not know how to handle this use case because there is no Plotly function to update the config object without calling Plotly.react (which would require triggering other toolbar widgets to reapply, based on a change to widget props and not just props.plotlyParams)
      
      DO NOT apply widget state here. Use a separate useEffect
      We guarantee to toolbar widgets that Plotly.react will only be called when props.plotlyParams changes (and will not be trigged by other changes, e.g. to other state)
    */
    processedPlotlyParams = selectToLabelUtils.modifyPlotlyParamsConfig(
      processedPlotlyParams
    );
    processedPlotlyParams = dragmodeWidgetUtils.modifyPlotlyParamsConfig(
      processedPlotlyParams
    );

    /**
      We call react instead of newPlot
      Other than performance concerns, Plotly.newPlot removes any event handlers that were previously attached.
    */
    props.Plotly.react(
      plotlyRef.current,
      processedPlotlyParams.data,
      processedPlotlyParams.layout,
      processedPlotlyParams.config
    );
  }, [props.plotlyParams]); // We guarantee that this dependency array only contains props.plotlyParams. see docstring.

  /**
   * renderCallbacks
   *   When props callbacks change, attach new callbacks and remove all old ones
   *
   *   All event hander attachments MUST go in this useEffect, and the nuclear clean up is to remove everything
   *   Parent components should not manually attach event handlers, and should use props.additionalPlotlyCallbacks instead
   *     This is because I don't know how to remove specific event handlers but not others from plotly (for instance, if there are multiple on_select handlers to only remove one)
   *
   *   Components that use PlotlyWrapper are highly recommended to improve performance by memoizing the props in this dependency array (by putting the function on the class instance, or using useCallback/useMemo for hooks)
   */
  useEffect(() => {
    console.debug("attaching plotly event handlers");

    // callbacks for selectToLabelUtils
    // it doesn't hurt to do this even when selectToLabelUtils is not used, and it saves us from having to deal with the dependency array when we only care about whether props.selectToLabelWidgetProps is set (we don't want to change every time its identity changes, yet we don't need a deep compare)
    // this might be improved with something like a line `let selectToLabelWidgetPropsUsed = props.selectToLabelWidgetProps ? true : false` above. haven't tried this
    addPlotlyCallbacks(
      plotlyRef.current,
      selectToLabelUtils.getPlotlyCallbacks(setPlotlySelectedEvent)
    );

    // wrapped to callback for point click props
    if (props.onPointClick) {
      addPlotlyCallbacks(
        plotlyRef.current,
        utils.formatPointClickCallbacks(plotlyRef.current, props.onPointClick)
      );
    }

    // any other callbacks from props
    if (props.additionalPlotlyCallbacks) {
      addPlotlyCallbacks(plotlyRef.current, props.additionalPlotlyCallbacks);
    }
    return () => {
      console.debug("removing all plotly event handlers");
      //  https://github.com/plotly/plotly.js/issues/107#issuecomment-279716312
      plotlyRef.current.removeAllListeners();
    };
  }, [plotlyRef, props.additionalPlotlyCallbacks, props.onPointClick]);

  /**
    renderDragmode
      When dragmode state changes, change it in plotly
      Or when the dragmode get reset by new props.plotlyParams, reapply it in plotly
        We want to persist the selected dragmode across changes to props.plotlyParams (and consequent calls to Plotly.react)
  */
  useDeepCompareEffect(() => {
    console.debug("changing dragmode");
    props.Plotly.relayout(plotlyRef.current, {
      dragmode: selectedDragmode,
    });
  }, [selectedDragmode, props.plotlyParams]);

  /**
    renderLabelVisibility
      Apply label visibility to the plot when the labels or plotlyParams changes
  */
  useDeepCompareEffect(() => {
    if (props.selectToLabelWidgetProps) {
      // if we are even using this widget
      console.debug("applying labels");
      const update = selectToLabelUtils.getPlotlyRestyleUpdate(
        visibleLabels,
        props.plotlyParams
      );
      if (update) {
        props.Plotly.relayout(plotlyRef.current, update);
      }
    }
  }, [visibleLabels, props.selectToLabelWidgetProps, props.plotlyParams]);

  /**
    invalidateVisibleLabels
      When plotly params or selectToLabelWidgetProps changes, update the state of visible labels to potentially invalidate labels that are no longer present
  */
  useDeepCompareEffect(() => {
    if (props.selectToLabelWidgetProps) {
      // if we are even using this widget
      // Using https://reactjs.org/docs/hooks-reference.html#functional-updates to avoid an infinite loop

      setVisibleLabels((prevState) =>
        selectToLabelUtils.getNewVisibleLabels(prevState, props.plotlyParams)
      );
    }
  }, [props.selectToLabelWidgetProps, props.plotlyParams]);

  /**
    renderDeselectAllPoints
      plotlySelectedEvent might be set to null by a user deselection, or from a widget via calling setPlotlySelectedEvent(null)
      When this happens, visually update the plot so that points no longer look selected
  */
  useEffect(() => {
    if (plotlySelectedEvent == null) {
      console.debug("deselecting points");
      props.Plotly.restyle(plotlyRef.current, { selectedpoints: null });
    }
  }, [plotlyRef, plotlySelectedEvent]);

  return (
    <div className="react-base-plot">
      {plotlyRefInitialized &&
        props.showWidgetOptions !== false &&
        props.idPrefixForUniqueness !== undefined && (
          <div className="react-base-plot-toolbar">
            <ButtonGroup>
              <DownloadIcon
                Plotly={props.Plotly}
                plotlyRef={plotlyRef}
                idPrefixForUniqueness={props.idPrefixForUniqueness}
                {...props.downloadIconWidgetProps}
              />
              <DragmodeWidget
                selectedDragmode={selectedDragmode}
                setDragmodeZoom={setDragmodeZoom}
                setDragmodePan={setDragmodePan}
                setDragmodeBoxSelect={setDragmodeBoxSelect}
                setDragmodeLassoSelect={setDragmodeLassoSelect}
                idPrefixForUniqueness={props.idPrefixForUniqueness}
                dragmodeWidgetOptions={dragmodeWidgetOptions}
              />
              {props.selectToLabelWidgetProps && (
                <SelectToLabel
                  visibleLabels={visibleLabels}
                  setVisibleLabels={setVisibleLabels}
                  plotlySelectedEvent={plotlySelectedEvent}
                  setPlotlySelectedEvent={setPlotlySelectedEvent}
                  idPrefixForUniqueness={props.idPrefixForUniqueness}
                  plotlyLayout={props.plotlyParams.layout}
                  plotlyConfig={props.plotlyParams.config}
                  setDragmodeBoxSelect={setDragmodeBoxSelect}
                  setDragmodeLassoSelect={setDragmodeLassoSelect}
                  {...props.selectToLabelWidgetProps}
                />
              )}
              {props.additionalToolbarWidgets
                ? props.additionalToolbarWidgets.map((element, i) => (
                    <React.Fragment key={i}>{element}</React.Fragment>
                  ))
                : null}
            </ButtonGroup>
          </div>
        )}
      <div ref={plotlyRef} />
      {process.env.NODE_ENV === "development" && (
        <DevAssertions
          dragmodeWidgetOptions={dragmodeWidgetOptions}
          selectToLabelWidgetProps={props.selectToLabelWidgetProps}
          plotlyParams={props.plotlyParams}
        />
      )}
    </div>
  );
});

PlotlyWrapper.displayName = "PlotlyWrapper";

export default PlotlyWrapper;
