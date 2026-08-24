import React, { useRef } from "react";
import { Button } from "react-bootstrap";
import qs from "qs";
import {
  ContextPath,
  FilterKey,
  DataExplorerContextV2,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import { ColorFacetSwapMode, getColorFacetSwapMode } from "../../utils";
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
import ExpansionMembersControl from "./ExpansionMembersControl";
import { resolveColorMode } from "../plot/prototype/plotUtils";
import styles from "../../styles/ConfigurationPanel.scss";

// Only the two-way exchange is a swap, so only it gets the word and the
// transfer icon — that icon reads as "these two trade places", which is exactly
// what the other two don't do. The one-way cases name the axes they leave
// populated instead of the action they perform, because the action ("move this
// selection to the other axis, then rewrite this one") is harder to state than
// the outcome:
//
//   - promote: color's selection becomes facet's, and color_by is set to
//     "facet" so it defers back. Both axes then show the same partition.
//   - demote: facet's selection becomes color's, and facet_by is unset. Color
//     is all that's left.
const SWAP_BUTTON_LABELS: Record<ColorFacetSwapMode, string> = {
  swap: "swap",
  promote: "color & facet",
  demote: "color only",
};

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

  // Null when no exchange is well-defined, which is also what hides the button.
  const swapMode = getColorFacetSwapMode(plot);

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
      {/* Only when no panel is showing the members. The control belongs beside
          the list it edits, and the Legend or the Facets panel is that list
          whenever the expansion backs either of them. This is the leftover
          case — expand an axis, color by an annotation, don't facet — where
          the members appear nowhere and the control would otherwise be
          unreachable. Decidable from the config alone, which matters because
          this column has no plot response. What the control does here is closer
          to a cap on how many points the plot draws than to editing a list the
          user can see, since nothing on screen names the members. */}
      {plot.expand_by?.length &&
      resolveColorMode(plot).mode !== "expansion" &&
      plot.facet_by !== "expansion" ? (
        <ExpansionMembersControl
          plot={plot}
          onChangeMembers={(members) =>
            dispatch({ type: "select_expansion_members", payload: members })
          }
        />
      ) : null}
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
              {swapMode && (
                <Button
                  id="swap-color-and-facet"
                  className={
                    swapMode === "swap"
                      ? styles.swapColorFacetButton
                      : `${styles.swapColorFacetButton} ${styles.swapColorFacetButtonOneWay}`
                  }
                  onClick={() => dispatch({ type: "swap_color_and_facet" })}
                >
                  <span>{SWAP_BUTTON_LABELS[swapMode]}</span>
                  {swapMode === "swap" && (
                    <i className="glyphicon glyphicon-transfer" />
                  )}
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
