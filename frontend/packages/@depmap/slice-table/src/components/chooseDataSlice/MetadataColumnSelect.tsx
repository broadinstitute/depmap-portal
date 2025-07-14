import React, { useEffect, useMemo, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { PlotConfigSelect } from "@depmap/data-explorer-2";
import type { TabularDataset } from "@depmap/types";

// FIXME: ContextBuilderV2 has a very similar component.
// This should be refactored so they share logic.
function MetadataColumnSelect({ value, index_type_name, onChange }: any) {
  const [isLoading, setIsLoading] = useState(true);
  const [metadataDataset, setMetadataDataset] = useState<any>();
  const [metadataIdColumn, setMetadataIdColumn] = useState<any>();

  useEffect(() => {
    (async () => {
      const [types, datasets] = await Promise.all([
        cached(breadboxAPI).getDimensionTypes(),
        cached(breadboxAPI).getDatasets(),
      ]);

      const dimType = types.find((t) => t.name === index_type_name);

      const allTabularDatasets = datasets.filter(
        (d) =>
          d.format === "tabular_dataset" &&
          d.index_type_name === index_type_name
      ) as TabularDataset[];

      const mdDataset = allTabularDatasets.find((d) => {
        return (
          dimType?.metadata_dataset_id && d.id === dimType.metadata_dataset_id
        );
      });

      setMetadataDataset(mdDataset);
      setMetadataIdColumn(dimType?.id_column);
      setIsLoading(false);
    })();
  }, [index_type_name]);

  const options = useMemo(() => {
    if (!metadataDataset) {
      return [];
    }

    return Object.entries(metadataDataset.columns_metadata)
      .sort(([colA], [colB]) => {
        if (colA === metadataIdColumn) {
          return -1;
        }

        if (colB === metadataIdColumn) {
          return 1;
        }

        if (colA === "label") {
          return -1;
        }

        return 0;
      })
      .map(([column, metadata]) => ({
        label: column,
        value: column,
        col_type: (metadata as any).col_type,
      }));
  }, [metadataDataset, metadataIdColumn]);

  return (
    <PlotConfigSelect
      show
      enable={!isLoading}
      isLoading={isLoading}
      label="Property"
      value={value?.identifier || null}
      options={options}
      onChangeUsesWrappedValue
      onChange={(wrappedValue) => {
        const { value: identifier, col_type } = (wrappedValue as unknown) as {
          value: string;
          col_type: string;
        };

        if (col_type !== "text" && col_type !== "categorical") {
          window.console.warn(`Warning: unsupported col_type "${col_type}"`);
        }

        onChange({
          dataset_id: metadataDataset.id,
          identifier_type: "column",
          identifier,
        });
      }}
      placeholder="Choose property…"
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default MetadataColumnSelect;
