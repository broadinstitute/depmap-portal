import React from "react";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";
import {
  makeDatasetOnChangeHandler,
  makeGeneOnChangeHandler,
  makePaginationOnChangeHandler,
} from "./actionCreators";
import GeneSelect from "./GeneSelect";
import TranscriptDatasetSelect from "./TranscriptDatasetSelect";
import TranscriptPaginationSelect from "./TranscriptPaginationSelect";
import styles from "../../../styles/TranscriptPlotConfig.scss";

interface Props {
  geneSymbol: string | null;
  expansionAxis: "x" | "y";
  dimension: Partial<DataExplorerPlotConfigDimensionV2>;
  limit: number;
  offset: number;
  dispatch: (action: PlotConfigReducerAction) => void;
}

function TranscriptExpansionSelect({
  geneSymbol,
  expansionAxis,
  dimension,
  limit,
  offset,
  dispatch,
}: Props) {
  const datasetId = dimension.dataset_id || null;

  return (
    <div className={styles.TranscriptExpansionSelect}>
      <GeneSelect
        value={geneSymbol}
        onChange={makeGeneOnChangeHandler(
          expansionAxis,
          datasetId,
          limit,
          dispatch
        )}
      />
      <TranscriptDatasetSelect
        value={datasetId}
        onChange={makeDatasetOnChangeHandler(
          expansionAxis,
          geneSymbol,
          limit,
          dispatch
        )}
      />
      <TranscriptPaginationSelect
        context={dimension.context}
        offset={offset}
        pageSize={limit}
        onChange={makePaginationOnChangeHandler(
          expansionAxis,
          geneSymbol,
          datasetId,
          limit,
          dispatch
        )}
      />
    </div>
  );
}

export default TranscriptExpansionSelect;
