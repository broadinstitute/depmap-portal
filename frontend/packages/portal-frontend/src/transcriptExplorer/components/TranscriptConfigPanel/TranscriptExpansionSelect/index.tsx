import React from "react";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";
import {
  makeDatasetOnChangeHandler,
  makeGeneOnChangeHandler,
} from "./actionCreators";
import GeneSelect from "./GeneSelect";
import TranscriptDatasetSelect from "./TranscriptDatasetSelect";
import styles from "../../../styles/TranscriptPlotConfig.scss";

interface Props {
  geneSymbol: string | null;
  expansionAxis: "x" | "y";
  dimension: Partial<DataExplorerPlotConfigDimensionV2>;
  dispatch: (action: PlotConfigReducerAction) => void;
}

function TranscriptExpansionSelect({
  geneSymbol,
  expansionAxis,
  dimension,
  dispatch,
}: Props) {
  const datasetId = dimension.dataset_id || null;

  return (
    <div className={styles.TranscriptExpansionSelect}>
      <GeneSelect
        value={geneSymbol}
        onChange={makeGeneOnChangeHandler(expansionAxis, datasetId, dispatch)}
      />
      <TranscriptDatasetSelect
        value={datasetId}
        onChange={makeDatasetOnChangeHandler(
          expansionAxis,
          geneSymbol,
          dispatch
        )}
      />
    </div>
  );
}

export default TranscriptExpansionSelect;
