import React from "react";
import cx from "classnames";
import { isSampleType } from "@depmap/data-explorer-2";
import { DataExplorerDatasetDescriptor } from "@depmap/types";
import Stat from "src/secretDataViewer/components/Stats/Stat";
import {
  filterDatasets,
  getFeatureTypes,
  groupBy,
} from "src/secretDataViewer/components/Stats/utils";
import styles from "src/secretDataViewer/styles/DataViewer.scss";

interface Props {
  index_type: string;
  datasets: DataExplorerDatasetDescriptor[];
  selectedDataType: string | null;
  selectedEntityType: string | null;
}

function FeatureTypes({
  index_type,
  datasets,
  selectedDataType,
  selectedEntityType,
}: Props) {
  return (
    <div className={styles.types}>
      <h2>{isSampleType(index_type) ? "Feature" : "Sample"} Types</h2>
      {getFeatureTypes(datasets).map((featureType) => {
        const relevantDatasets = filterDatasets(datasets, { featureType });
        const groups = groupBy(relevantDatasets, "dataType");
        const viableDatasets = filterDatasets(relevantDatasets, {
          dataType: selectedDataType,
          featureType: selectedEntityType,
        });

        return (
          <Stat
            key={featureType}
            value={featureType}
            className={cx({ [styles.disabled]: viableDatasets.length === 0 })}
            tooltip={
              <div>
                <h3>Datasets by Data Type</h3>
                <ul>
                  {groups.map(([dataType, ds]) => (
                    <li
                      key={dataType}
                      className={cx({
                        [styles.disabled]:
                          viableDatasets.length === 0 ||
                          (selectedDataType && selectedDataType !== dataType),
                      })}
                    >
                      <b>{dataType}</b>
                      <ul>
                        {ds.map((d) => (
                          <li key={d.id}>{d.name}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
        );
      })}
    </div>
  );
}

export default FeatureTypes;
