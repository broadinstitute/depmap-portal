import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { useDeprecatedDataExplorerApi } from "../../contexts/DeprecatedDataExplorerApiContext";
import PlotConfigSelect from "../PlotConfigSelect";
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
  title?: string;
}

function ContextTypeSelect({
  value,
  onChange,
  useContextBuilderV2,
  title = "Context type",
}: Props) {
  const deprecatedApi = useDeprecatedDataExplorerApi();
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    []
  );

  useEffect(() => {
    (async () => {
      try {
        if (useContextBuilderV2) {
          const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
          const sorted = sortDimensionTypes(
            dimensionTypes.map(({ name }) => name)
          );

          const opts = dimensionTypes
            .map((dt) => ({
              value: dt.name,
              label: dt.display_name,
            }))
            .sort((a, b) => {
              const indexA = sorted.indexOf(a.value);
              const indexB = sorted.indexOf(b.value);
              return indexA - indexB;
            });

          setOptions(opts);
        } else {
          const datasetByIndexType = await deprecatedApi.fetchDatasetsByIndexType();
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
  }, [deprecatedApi, useContextBuilderV2]);

  return (
    <PlotConfigSelect
      show
      enable
      label={<div style={{ fontSize: 13 }}>{title}</div>}
      inlineLabel
      styles={{
        control: (base: any) => ({ ...base, fontSize: 14 }),
        menu: (base: any) => ({ ...base, fontSize: 14, width: 400 }),
      }}
      className={styles.ContextTypeSelect}
      options={options}
      value={value}
      onChange={onChange as (nextValue: string | null) => void}
      isLoading={options.length === 0}
    />
  );
}

export default ContextTypeSelect;
