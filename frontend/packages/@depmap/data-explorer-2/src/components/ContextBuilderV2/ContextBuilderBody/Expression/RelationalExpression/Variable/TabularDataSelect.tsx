import React from "react";
import { AnnotationType } from "@depmap/types";
import PlotConfigSelect from "../../../../../PlotConfigSelect";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import useTabularDatasets from "../../../../hooks/useTabularDatasets";
import styles from "../../../../../../styles/ContextBuilderV2.scss";

interface Props {
  varName: string;
}

function TabularDataSelect({ varName }: Props) {
  const { vars, setVar } = useContextBuilderState();
  const {
    isLoadingTabularDatasets,
    otherTabularDatasets,
  } = useTabularDatasets();

  const variable = vars[varName] || null;

  const dataset = otherTabularDatasets.find((d) => {
    return (
      variable?.dataset_id && [d.id, d.given_id].includes(variable.dataset_id)
    );
  });

  const datasetOptions = otherTabularDatasets.map((td) => ({
    label: td.name,
    value: td.given_id || td.id,
  }));

  let isBadDataset = false;

  if (variable?.dataset_id) {
    isBadDataset = !datasetOptions.some(
      (opt) => opt.value === variable.dataset_id
    );

    if (isBadDataset) {
      datasetOptions.push({
        label: variable.dataset_id,
        value: variable.dataset_id,
      });
    }
  }

  const columnOptions = dataset
    ? Object.entries(dataset.columns_metadata)
        .filter(([, metadata]) =>
          // TODO: add support for type "list_strings"
          ["text", "categorical"].includes(metadata.col_type)
        )
        .map(([column, metadata]) => ({
          label: column,
          value: column,
          col_type: metadata.col_type,
        }))
    : [];

  let isBadColumn = false;

  if (variable?.identifier) {
    isBadColumn = !columnOptions.some(
      (opt) => opt.value === variable.identifier
    );

    if (isBadColumn) {
      columnOptions.push({
        label: variable.identifier,
        value: variable.identifier,
        col_type: AnnotationType.text,
      });
    }
  }

  return (
    <>
      <PlotConfigSelect
        show
        enable={!isLoadingTabularDatasets}
        label="Dataset"
        hasError={isBadDataset}
        isLoading={isLoadingTabularDatasets}
        value={variable?.dataset_id || null}
        options={datasetOptions}
        onChange={(dataset_id) => {
          setVar(varName, {
            dataset_id: dataset_id as string,
            source: "tabular_dataset",
            slice_type: undefined,
          });
        }}
        placeholder="Choose dataset…"
        menuPortalTarget={document.querySelector("#modal-container")}
      />
      <div className={styles.spacerWidth300} />
      <PlotConfigSelect
        show
        hasError={isBadColumn}
        enable={Boolean(variable?.dataset_id)}
        label="Column"
        value={variable?.identifier || null}
        options={columnOptions}
        onChangeUsesWrappedValue
        onChange={(wrappedValue) => {
          const { value, col_type } = (wrappedValue as unknown) as {
            value: string;
            col_type: AnnotationType;
          };

          if (col_type !== "text" && col_type !== "categorical") {
            window.console.warn(`Warning: unsupported col_type "${col_type}"`);
          }

          setVar(varName, {
            dataset_id: variable.dataset_id,
            identifier_type: "column",
            identifier: value,
            source: "tabular_dataset",
            slice_type: undefined,
          });
        }}
        placeholder="Choose column…"
        menuPortalTarget={document.querySelector("#modal-container")}
      />
    </>
  );
}

export default TabularDataSelect;
