import React from "react";
import cx from "classnames";
import { isSampleType } from "@depmap/data-explorer-2";
import { DataExplorerDatasetDescriptor } from "@depmap/types";
import Stat from "src/secretDataViewer/components/Stats/Stat";
import {
  filterDatasets,
  getDataTypes,
  groupBy,
} from "src/secretDataViewer/components/Stats/utils";
import styles from "src/secretDataViewer/styles/DataViewer.scss";

interface Props {
  index_type: string;
  datasets: DataExplorerDatasetDescriptor[];
  selectedDataType: string | null;
  selectedEntityType: string | null;
  contextDatasetIds: string[] | null;
}

function DataTypes({
  index_type,
  datasets,
  selectedDataType,
  selectedEntityType,
  contextDatasetIds,
}: Props) {
  return (
    <div className={styles.types}>
      <h2>Data Types</h2>
      {getDataTypes(datasets).map((dataType) => {
        const relevantDatasets = filterDatasets(datasets, { dataType });

        const viableDatasets = new Set(
          filterDatasets(relevantDatasets, {
            dataType: selectedDataType,
            featureType: selectedEntityType,
          })
            .filter((d) => {
              return (
                !contextDatasetIds || contextDatasetIds.includes(d.dataset_id)
              );
            })
            .map((d) => d.dataset_id)
        );

        return (
          <Stat
            key={dataType}
            value={dataType}
            className={cx({
              [styles.disabled]:
                (selectedDataType && dataType !== selectedDataType) ||
                relevantDatasets.every(
                  (d) => !viableDatasets.has(d.dataset_id)
                ),
            })}
            tooltip={
              <div>
                <h3>
                  Datasets by {isSampleType(index_type) ? "Feature" : "Sample"}{" "}
                  Type
                </h3>
                <ul>
                  {groupBy(relevantDatasets, "featureType").map(
                    ([featureType, ds]) => (
                      <li
                        key={featureType}
                        className={cx({
                          [styles.disabled]:
                            selectedEntityType &&
                            selectedEntityType !== featureType,
                        })}
                      >
                        <b>{featureType}</b>
                        <ul>
                          {ds.map((d) => (
                            <li key={d.dataset_id}>{d.label}</li>
                          ))}
                        </ul>
                      </li>
                    )
                  )}
                </ul>
              </div>
            }
          />
        );
      })}
    </div>
  );
}

export default DataTypes;
