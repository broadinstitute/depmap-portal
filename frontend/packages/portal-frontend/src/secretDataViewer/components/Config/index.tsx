import React, { useCallback } from "react";
import {
  DeprecatedDataExplorerApiProvider,
  PointsSelector,
  PlotConfigReducerAction,
} from "@depmap/data-explorer-2";
import {
  DataExplorerPlotConfigDimension,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import {
  evaluateLegacyContext,
  fetchDatasetDetails,
  fetchDatasetsByIndexType,
  fetchDatasetsMatchingContextIncludingEntities,
  fetchDimensionLabels,
  fetchDimensionLabelsOfDataset,
  fetchDimensionLabelsToDatasetsMapping,
} from "src/data-explorer-2/deprecated-api";
import HackedDimensionSelect from "src/secretDataViewer/components/Config/HackedDimensionSelect";
import styles from "src/secretDataViewer/styles/DataViewer.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
}

function Config({ plot, dispatch }: Props) {
  const slice_type = undefined;

  const mode = (() => {
    if (plot.plot_type === "correlation_heatmap") {
      return "context-only";
    }

    if (slice_type === "custom" || slice_type === "other") {
      return "entity-only";
    }

    return "entity-or-context";
  })();

  const onChange = useCallback(
    (dimension: Partial<DataExplorerPlotConfigDimension>) => {
      dispatch({
        type: "select_dimension",
        payload: {
          key: "x",
          // TODO: Allow this to be partial
          dimension: dimension as DataExplorerPlotConfigDimension,
        },
      });
    },
    [dispatch]
  );

  return (
    <DeprecatedDataExplorerApiProvider
      evaluateLegacyContext={evaluateLegacyContext}
      fetchDatasetDetails={fetchDatasetDetails}
      fetchDatasetsByIndexType={fetchDatasetsByIndexType}
      fetchDatasetsMatchingContextIncludingEntities={
        fetchDatasetsMatchingContextIncludingEntities
      }
      fetchDimensionLabels={fetchDimensionLabels}
      fetchDimensionLabelsOfDataset={fetchDimensionLabelsOfDataset}
      fetchDimensionLabelsToDatasetsMapping={
        fetchDimensionLabelsToDatasetsMapping
      }
    >
      <div className={styles.Config}>
        <PointsSelector
          show
          enable={plot.plot_type}
          value={plot.index_type}
          plot_type={plot.plot_type}
          onChange={(index_type: string) =>
            dispatch({
              type: "select_index_type",
              payload: index_type,
            })
          }
        />
        <HackedDimensionSelect
          className={styles.HackedDimensionSelect}
          mode={mode}
          onChange={onChange}
          index_type={plot.index_type || null}
          value={
            (plot.dimensions?.x as Partial<DataExplorerPlotConfigDimension>) ||
            null
          }
          includeAllInContextOptions
          onClickCreateContext={() => {}}
          onClickSaveAsContext={() => {}}
        />
      </div>
    </DeprecatedDataExplorerApiProvider>
  );
}

export default Config;
