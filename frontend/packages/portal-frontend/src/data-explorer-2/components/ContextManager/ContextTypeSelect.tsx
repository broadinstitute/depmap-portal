import React, { useEffect, useState } from "react";
import ReactSelect from "react-windowed-select";
import { DataExplorerDatasetDescriptor } from "@depmap/types";
import {
  capitalize,
  sortDimensionTypes,
  fetchDatasetsByIndexType,
  getDimensionTypeLabel,
} from "@depmap/data-explorer-2";
import styles from "src/data-explorer-2/styles/ContextManager.scss";

interface Props {
  value: any;
  onChange: any;
}

type DatasetsByIndexType = Record<string, DataExplorerDatasetDescriptor[]>;

function ContextTypeSelect({ value, onChange }: Props) {
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

  const options = sortDimensionTypes(Object.keys(datasetsByIndexType || {}))
    .filter((index_type) => index_type !== "other")
    .map((index_type) => ({
      value: index_type,
      label: capitalize(getDimensionTypeLabel(index_type)),
    }));

  const selectedValue = options?.find((option: any) => {
    return option.value === value;
  });

  return (
    <div className={styles.ContextTypeSelect}>
      <div>
        <label htmlFor="context-type">Context type</label>
      </div>
      <ReactSelect
        id="context-type"
        options={options}
        value={selectedValue}
        onChange={(option: any) => {
          onChange(option.value);
        }}
        isLoading={!datasetsByIndexType}
      />
    </div>
  );
}

export default ContextTypeSelect;
