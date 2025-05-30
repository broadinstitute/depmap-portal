import React, { useMemo } from "react";
import PlotConfigSelect from "../../../../../PlotConfigSelect";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import useTabularDatasets from "../../../../hooks/useTabularDatasets";
import styles from "../../../../../../styles/ContextBuilderV2.scss";

interface Props {
  varName: string;
}

function MetadataColumnSelect({ varName }: Props) {
  const { vars, setVar } = useContextBuilderState();
  const variable = vars[varName] || null;
  const {
    isLoadingTabularDatasets,
    metadataDataset,
    metadataIdColumn,
  } = useTabularDatasets();

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
        col_type: metadata.col_type,
      }));
  }, [metadataDataset, metadataIdColumn]);

  return (
    <>
      <div className={styles.spacerWidth400} />
      <PlotConfigSelect
        show
        enable={!isLoadingTabularDatasets}
        isLoading={isLoadingTabularDatasets}
        label="Property"
        value={variable?.identifier || null}
        options={options}
        onChangeUsesWrappedValue
        onChange={(wrappedValue) => {
          const { value, col_type } = (wrappedValue as unknown) as {
            value: string;
            col_type: string;
          };

          if (col_type !== "text" && col_type !== "categorical") {
            window.console.warn(`Warning: unsupported col_type "${col_type}"`);
          }

          setVar(varName, {
            dataset_id: metadataDataset?.given_id || metadataDataset?.id,
            identifier_type: "column",
            identifier: value,
            source: "metadata_column",
            slice_type: undefined,
          });
        }}
        placeholder="Choose property…"
        menuPortalTarget={document.querySelector("#modal-container")}
      />
    </>
  );
}

export default MetadataColumnSelect;
