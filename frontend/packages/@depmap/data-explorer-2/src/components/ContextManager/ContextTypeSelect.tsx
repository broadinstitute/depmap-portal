import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { dataExplorerAPI } from "../../services/dataExplorerAPI";
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
  // Use this if you don't want to show types that there are no datasets for.
  hideUnpopulatedTypes?: boolean;
}

function ContextTypeSelect({
  value,
  onChange,
  useContextBuilderV2,
  title = "Context type",
  hideUnpopulatedTypes = false,
}: Props) {
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

          const populatedTypes = new Set<string>();

          if (hideUnpopulatedTypes) {
            const datasets = await cached(breadboxAPI).getDatasets();

            for (const d of datasets) {
              if (d.format === "matrix_dataset") {
                populatedTypes.add(d.sample_type_name);

                if (d.feature_type_name !== null) {
                  populatedTypes.add(d.feature_type_name);
                }
              } else if (
                d.given_id !== `${d.index_type_name}_metadata` &&
                d.id !==
                  dimensionTypes.find((dt) => dt.name === d.index_type_name)
                    ?.metadata_dataset_id
              ) {
                populatedTypes.add(d.index_type_name);
              }
            }
          }

          const opts = dimensionTypes
            .filter(
              (dt) => !hideUnpopulatedTypes || populatedTypes.has(dt.name)
            )
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
          const datasetByIndexType = await dataExplorerAPI.fetchDatasetsByIndexType();
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
  }, [hideUnpopulatedTypes, useContextBuilderV2]);

  const isLoading = options.length === 0;

  return (
    <PlotConfigSelect
      show
      enable={!isLoading}
      value={isLoading ? { value, label: "Loading..." } : value}
      options={options}
      onChange={onChange as (nextValue: string | null) => void}
      isLoading={isLoading}
      className={styles.ContextTypeSelect}
      inlineLabel
      label={<div style={{ fontSize: 13 }}>{title}</div>}
      styles={{
        control: (base: any) => ({ ...base, fontSize: 14 }),
        menu: (base: any) => ({ ...base, fontSize: 14, width: 400 }),
      }}
    />
  );
}

export default ContextTypeSelect;
