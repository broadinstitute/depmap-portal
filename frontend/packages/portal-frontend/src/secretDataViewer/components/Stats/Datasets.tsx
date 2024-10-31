import React from "react";
import cx from "classnames";
import { WordBreaker } from "@depmap/common-components";
import { DataExplorerDatasetDescriptor } from "@depmap/types";
import {
  filterDatasets,
  getDataType,
  getFeatureType,
} from "src/secretDataViewer/components/Stats/utils";
import Stat from "src/secretDataViewer/components/Stats/Stat";
import styles from "src/secretDataViewer/styles/DataViewer.scss";

interface Props {
  datasets: DataExplorerDatasetDescriptor[];
  selectedDataType: string | null;
  selectedEntityType: string | null;
  contextDatasetIds: string[] | null;
  dataset_id: string | null;
}

function isHighestPriorityOfDataType(
  datasets: DataExplorerDatasetDescriptor[],
  dataset: DataExplorerDatasetDescriptor,
  slice_type: string | null,
  dataType: string | null,
  contextDatasetIds: string[] | null
) {
  let best = Infinity;

  filterDatasets(datasets, { featureType: slice_type, dataType }).forEach(
    (d) => {
      if (
        d.priority !== null &&
        d.priority < best &&
        (!contextDatasetIds || contextDatasetIds.includes(d.dataset_id))
      ) {
        best = d.priority;
      }
    }
  );

  return dataset.priority === best;
}

function Datasets({
  datasets,
  selectedDataType,
  selectedEntityType,
  contextDatasetIds,
  dataset_id,
}: Props) {
  return (
    <div className={styles.datasets}>
      <h2>Datasets</h2>
      {datasets.map((d) => (
        <Stat
          className={cx({
            [styles.disabled]:
              (selectedDataType && d.data_type !== selectedDataType) ||
              (selectedEntityType && d.slice_type !== selectedEntityType) ||
              (contextDatasetIds && !contextDatasetIds.includes(d.dataset_id)),
            [styles.selected]: d.dataset_id === dataset_id,
          })}
          key={d.dataset_id}
          value={
            <span>
              {d.label}{" "}
              <span className={styles.star}>
                {isHighestPriorityOfDataType(
                  datasets,
                  d,
                  selectedEntityType,
                  selectedDataType,
                  contextDatasetIds
                )
                  ? "⭐"
                  : ""}
              </span>
            </span>
          }
          tooltip={
            <>
              <h3>Data Type</h3>
              <div
                className={cx({
                  [styles.disabled]:
                    selectedDataType && d.data_type !== selectedDataType,
                })}
              >
                {getDataType(datasets, d.dataset_id)}
              </div>
              <br />
              <h3>Feature Type</h3>
              <div
                className={cx({
                  [styles.disabled]:
                    selectedEntityType && d.slice_type !== selectedEntityType,
                })}
              >
                {getFeatureType(datasets, d.dataset_id)}
              </div>
              <br />
              <h3>Dataset ID</h3>
              <div>
                <WordBreaker text={d.dataset_id} />
              </div>
              <br />
              <h3>Priority</h3>
              <div>{JSON.stringify(d.priority)}</div>
            </>
          }
        />
      ))}
    </div>
  );
}

export default Datasets;
