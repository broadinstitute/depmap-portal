import React, { useContext, useEffect, useState } from "react";
import ReactSelect from "react-select";
import { ApiContext } from "@depmap/api";
import { fetchDatasetsByIndexType } from "../../api";
import {
  capitalize,
  sortDimensionTypes,
  getDimensionTypeLabel,
} from "../../utils/misc";
import styles from "../../styles/ContextManager.scss";

interface Props {
  value: string;
  onChange: (nextValue: string) => void;
  useContextBuilderV2: boolean;
}

function ContextTypeSelect({ value, onChange, useContextBuilderV2 }: Props) {
  const apiContext = useContext(ApiContext);
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    []
  );

  useEffect(() => {
    (async () => {
      try {
        if (useContextBuilderV2) {
          const dimensionTypes = await apiContext.getApi().getDimensionTypes();
          const sorted = sortDimensionTypes(
            dimensionTypes.map(({ name }) => name)
          );

          const opts = dimensionTypes
            .map((dt) => ({
              value: dt.name,
              label: capitalize(dt.display_name),
            }))
            .sort((a, b) => {
              const indexA = sorted.indexOf(a.value);
              const indexB = sorted.indexOf(b.value);
              return indexA - indexB;
            });

          setOptions(opts);
        } else {
          const datasetByIndexType = await fetchDatasetsByIndexType();
          const indexTypes = Object.keys(datasetByIndexType);

          const opts = sortDimensionTypes(indexTypes || [])
            .filter((index_type) => index_type !== "other")
            .map((index_type) => ({
              value: index_type,
              label: capitalize(getDimensionTypeLabel(index_type)),
            }));

          setOptions(opts);
        }
      } catch (e) {
        window.console.error(e);
      }
    })();
  }, [apiContext, useContextBuilderV2]);

  const selectedValue = options.find((option) => {
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
        onChange={(option) => {
          onChange(option!.value);
        }}
        isLoading={options.length === 0}
      />
    </div>
  );
}

export default ContextTypeSelect;