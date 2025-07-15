import React, { useEffect, useMemo, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { PlotConfigSelect } from "@depmap/data-explorer-2";
import type { SliceQuery, TabularDataset } from "@depmap/types";

interface Props {
  index_type_name: string;
  value: SliceQuery | null;
  onChange: (nextSlice: SliceQuery) => void;
}

// FIXME: ContextBuilderV2 has a very similar component.
// This should be refactored so they share logic.
function MetadataColumnSelect({ value, index_type_name, onChange }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [metadataDataset, setMetadataDataset] = useState<TabularDataset>();
  const [metadataIdColumn, setMetadataIdColumn] = useState<string>();
  const [warnings, setWarnings] = useState<string[]>([]);

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
        metadata,
      }));
  }, [metadataDataset, metadataIdColumn]);

  return (
    <>
      <PlotConfigSelect
        show
        enable={!isLoading}
        isLoading={isLoading}
        label="Property"
        value={value?.identifier || null}
        options={options}
        onChangeUsesWrappedValue
        onChange={(wrappedValue) => {
          const { value: identifier, metadata } = (wrappedValue as unknown) as {
            value: string;
            metadata: {
              col_type: string;
              units: string | null;
              references: string | string[] | null;
            };
          };

          const { col_type } = metadata;

          const nextWarnings = [];

          if (
            col_type !== "text" &&
            col_type !== "categorical" &&
            col_type !== "continuous"
          ) {
            nextWarnings.push(
              `Warning: unsupported \`col_type\` "${col_type}"`
            );
          }

          if (metadata.references) {
            nextWarnings.push(
              [
                "TODO: Allow mapping this column to referenced type(s): ",
                JSON.stringify(metadata.references),
              ].join("")
            );
          }

          setWarnings(nextWarnings);

          onChange({
            dataset_id: metadataDataset!.id,
            identifier_type: "column",
            identifier,
          });
        }}
        placeholder="Choose property…"
        menuPortalTarget={document.querySelector("#modal-container")}
      />
      {warnings.length > 0 && (
        <div style={{ maxWidth: 160 }}>
          {warnings.map((warning) => (
            <div key={warning} style={{ marginTop: 14 }}>
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default MetadataColumnSelect;
