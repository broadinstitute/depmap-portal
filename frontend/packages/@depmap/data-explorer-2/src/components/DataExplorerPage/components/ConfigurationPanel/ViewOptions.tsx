import React, { useRef } from "react";
import { Button } from "react-bootstrap";
import qs from "qs";
import {
  ContextPath,
  FilterKey,
  DataExplorerContextV2,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import {
  DEFAULT_EXPANSION_LIMIT,
  PlotConfigReducerAction,
} from "../../reducers/plotConfigReducer";
import { canSwapColorAndFacet } from "../../utils";
import { getExpansionAxis } from "../../../../utils/misc";
import HelpTip from "../HelpTip";
import Section from "../Section";
import {
  ShowIdentityLineCheckbox,
  ShowPointsCheckbox,
  UseClusteringCheckbox,
} from "./selectors";
import FilterViewOptions from "./FilterViewOptions";
import ColorByViewOptions from "./ColorByViewOptions";
import FacetByViewOptions from "./FacetByViewOptions";
import MaxToShowSelect from "./MaxToShowSelect";
import styles from "../../styles/ConfigurationPanel.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
  canShowIdentityLine: boolean;
  onClickCreateContext: (pathToCreate: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContextV2,
    pathToSave: ContextPath
  ) => void;
}

function ViewOptions({
  plot,
  dispatch,
  canShowIdentityLine,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  let filterKeys: FilterKey[] = [];

  if (plot.plot_type !== "correlation_heatmap" && plot.index_type !== "other") {
    filterKeys = ["visible"];
  }

  const params = qs.parse(window.location.search.substr(1));
  const defaultOpen = !params.task;

  const expansionAxis = getExpansionAxis(plot);
  const currentExpandBy = plot.expand_by?.[0];

  return (
    <Section
      title="View Options"
      defaultOpen={defaultOpen}
      innerRef={ref}
      onOpen={() => {
        setTimeout(() => {
          ref.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      }}
    >
      <ShowPointsCheckbox
        show={plot.plot_type === "density_1d"}
        value={!plot.hide_points}
        onChange={(show_points: boolean) => {
          dispatch({
            type: "select_hide_points",
            payload: !show_points,
          });
        }}
      />
      <ShowIdentityLineCheckbox
        show={canShowIdentityLine}
        value={!plot.hide_identity_line}
        onChange={(showIdentityLine: boolean) => {
          dispatch({
            type: "select_hide_identity_line",
            payload: !showIdentityLine,
          });
        }}
      />
      <UseClusteringCheckbox
        show={plot.plot_type === "correlation_heatmap"}
        value={Boolean(plot.use_clustering)}
        onChange={(use_clustering: boolean) => {
          dispatch({
            type: "select_use_clustering",
            payload: use_clustering,
          });
        }}
      />
      <div className={styles.filterAndMax}>
        <FilterViewOptions
          plot={plot}
          dispatch={dispatch}
          filterKeys={filterKeys}
          labels={[
            <span key={0}>
              Filter
              <HelpTip id="filter-help" />
            </span>,
          ]}
          onClickCreateContext={onClickCreateContext}
          onClickSaveAsContext={onClickSaveAsContext}
        />
        <MaxToShowSelect
          show={Boolean(currentExpandBy)}
          value={currentExpandBy?.limit ?? DEFAULT_EXPANSION_LIMIT}
          slice_type={currentExpandBy?.slice_type}
          onChange={(nextLimit) => {
            if (!currentExpandBy?.slice_type || !currentExpandBy?.context) {
              return;
            }

            dispatch({
              type: "select_expansion",
              payload: {
                key: expansionAxis,
                expand_by: {
                  slice_type: currentExpandBy.slice_type as string,
                  context: currentExpandBy.context as DataExplorerContextV2,
                  dataset_id: plot.dimensions?.[expansionAxis]
                    ?.dataset_id as string,
                  limit: nextLimit,
                  offset: 0,
                },
              },
            });
          }}
        />
      </div>
      {plot.plot_type !== "correlation_heatmap" && (
        <>
          <hr className={styles.hr} />
          <div className={styles.facetAndColor}>
            <FacetByViewOptions
              show
              plot={plot}
              dispatch={dispatch}
              onClickCreateContext={onClickCreateContext}
              onClickSaveAsContext={onClickSaveAsContext}
            />
            <div className={styles.swapColorFacetButtonContainer}>
              {canSwapColorAndFacet(plot) && (
                <Button
                  id="swap-color-and-facet"
                  className={styles.swapColorFacetButton}
                  onClick={() => dispatch({ type: "swap_color_and_facet" })}
                >
                  <span>swap</span>
                  <i className="glyphicon glyphicon-transfer" />
                </Button>
              )}
            </div>
            <ColorByViewOptions
              show
              plot={plot}
              dispatch={dispatch}
              onClickCreateContext={onClickCreateContext}
              onClickSaveAsContext={onClickSaveAsContext}
            />
          </div>
        </>
      )}
    </Section>
  );
}

export default ViewOptions;
