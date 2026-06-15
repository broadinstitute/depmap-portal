import React, { useRef } from "react";
import {
  ContextPath,
  DataExplorerContextV2,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";
import HelpTip from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/HelpTip";
import Section from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/Section";
import {
  ShowIdentityLineCheckbox,
  ShowPointsCheckbox,
} from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/ConfigurationPanel/selectors";
import FilterViewOptions from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/ConfigurationPanel/FilterViewOptions";
import { DEFAULT_MAX_TRANSCRIPTS } from "../../utils";
import TranscriptMaxToShowSelect from "../TranscriptExpansionSelect/TranscriptMaxToShowSelect";
import { makeMaxToShowOnChangeHandler } from "../TranscriptExpansionSelect/actionCreators";
import TranscriptColorByViewOptions from "./TranscriptColorByViewOptions";
import TranscriptGroupByViewOptions from "./TranscriptGroupByViewOptions";
import styles from "../../../styles/TranscriptPlotConfig.scss";

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

function TranscriptViewOptions({
  plot,
  dispatch,
  canShowIdentityLine,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const expansionAxis =
    plot.dimensions?.y?.aggregation === "expansion" ? "y" : "x";
  const expansionDim = plot.dimensions?.[expansionAxis];
  const geneSymbol = expansionDim?.context?.name || null;
  const datasetId = expansionDim?.dataset_id || null;
  const maxToShow = plot.expand_by?.[0]?.limit ?? DEFAULT_MAX_TRANSCRIPTS;

  return (
    <Section
      title="View Options"
      defaultOpen
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
      <div className={styles.filterAndMax}>
        <FilterViewOptions
          plot={plot}
          dispatch={dispatch}
          filterKeys={["visible"]}
          labels={[
            <span key={0}>
              Filter
              <HelpTip id="filter-help" />
            </span>,
          ]}
          onClickCreateContext={onClickCreateContext}
          onClickSaveAsContext={onClickSaveAsContext}
        />
        <TranscriptMaxToShowSelect
          show={Boolean(geneSymbol)}
          value={maxToShow}
          onChange={makeMaxToShowOnChangeHandler(
            expansionAxis,
            geneSymbol,
            datasetId,
            dispatch
          )}
        />
      </div>
      <hr className={styles.hr} />
      <div className={styles.colorAndGroupBy}>
        <TranscriptColorByViewOptions
          show
          plot={plot}
          dispatch={dispatch}
          onClickCreateContext={onClickCreateContext}
          onClickSaveAsContext={onClickSaveAsContext}
        />
        <TranscriptGroupByViewOptions
          show
          plot={plot}
          dispatch={dispatch}
          onClickCreateContext={onClickCreateContext}
          onClickSaveAsContext={onClickSaveAsContext}
        />
      </div>
    </Section>
  );
}

export default TranscriptViewOptions;
