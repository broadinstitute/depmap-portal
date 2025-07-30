import React, { useEffect, useState } from "react";
import {
  DataExplorerDatasetDescriptor,
  DataExplorerPlotConfigDimension,
} from "@depmap/types";
import DataTypes from "src/secretDataViewer/components/Stats/DataTypes";
import FeatureTypes from "src/secretDataViewer/components/Stats/FeatureTypes";
import Datasets from "src/secretDataViewer/components/Stats/Datasets";
import { useContextFilteredDatasetIds } from "src/secretDataViewer/components/Stats/utils";
import { fetchDatasetsByIndexType } from "src/secretDataViewer/deprecated-api";
import styles from "src/secretDataViewer/styles/DataViewer.scss";

interface Props {
  index_type: string;
  dimension: Partial<DataExplorerPlotConfigDimension>;
}

type DatasetsByIndexType = Record<string, DataExplorerDatasetDescriptor[]>;

function Stats({ index_type, dimension }: Props) {
  const { context, dataset_id, slice_type } = dimension;
  const [dataType, setDataType] = useState<string | null>(null);

  useEffect(() => {
    const onDataTypeChange = (e: unknown) => {
      setDataType((e as { detail: string }).detail);
    };

    window.addEventListener("data_type_changed", onDataTypeChange);
    return () =>
      window.removeEventListener("data_type_changed", onDataTypeChange);
  }, []);

  const {
    contextDatasetIds,
    isEvaluatingContext,
  } = useContextFilteredDatasetIds(context || null);
  const [updatedContextDatasetIds, setUpdatedContextDatasetIds] = useState<
    string[] | null
  >(null);

  useEffect(() => {
    if (!isEvaluatingContext) {
      setUpdatedContextDatasetIds(contextDatasetIds);
    }
  }, [contextDatasetIds, isEvaluatingContext]);

  const [
    datasetsByIndexType,
    setDatasetsByIndexType,
  ] = useState<DatasetsByIndexType | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchDatasetsByIndexType();
        setDatasetsByIndexType(data);
      } catch (e) {
        window.console.error(e);
      }
    })();
  }, []);

  const datasets = datasetsByIndexType?.[index_type] || [];

  return (
    <div className={styles.Stats}>
      <DataTypes
        index_type={index_type}
        datasets={datasets}
        selectedDataType={dataType || null}
        selectedEntityType={slice_type || null}
        contextDatasetIds={updatedContextDatasetIds}
      />
      <FeatureTypes
        index_type={index_type}
        datasets={datasets}
        selectedDataType={dataType || null}
        selectedEntityType={slice_type || null}
      />
      <Datasets
        datasets={datasets}
        selectedDataType={dataType || null}
        selectedEntityType={slice_type || null}
        contextDatasetIds={updatedContextDatasetIds}
        dataset_id={dataset_id || null}
      />
    </div>
  );
}

export default Stats;
