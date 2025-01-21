import React, { useRef } from "react";
import { DataExplorerContextVariable } from "@depmap/types";
import PlotConfigSelect from "../../../../../PlotConfigSelect";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import useTabularDatasets from "../../../../hooks/useTabularDatasets";
import { scrollParentIntoView } from "../../../../utils/domUtils";

interface Props {
  expr: Record<"var", string> | null;
  path: (string | number)[];
}

function DataSourceSelect({ expr, path }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { dispatch, vars, setVar } = useContextBuilderState();
  const {
    metadataDataset,
    otherTabularDatasets,
    isLoadingTabularDatasets,
  } = useTabularDatasets();

  const varName = expr ? expr.var : null;
  const slice = varName ? vars[varName] : null;
  const source = slice?.source || null;

  const options = isLoadingTabularDatasets
    ? []
    : [
        {
          label: "Annotation",
          value: "metadata_column",
          isDisabled: !metadataDataset,
        },
        {
          label: "Tabular Dataset",
          value: "tabular_dataset",
          isDisabled: otherTabularDatasets.length === 0,
        },
        {
          label: "Matrix Dataset",
          value: "matrix_dataset",
        },
      ];

  return (
    <PlotConfigSelect
      show
      enable
      label="Data Source"
      innerRef={ref}
      value={source}
      options={options}
      isLoading={isLoadingTabularDatasets}
      onChange={(nextSource) => {
        let nextVarName = varName;

        // Create a var reference if one doesn't exist.
        if (!nextVarName) {
          nextVarName = crypto.randomUUID();

          dispatch({
            type: "update-value",
            payload: { path, value: { var: nextVarName } },
          });
        }

        // Update the var reference.
        setVar(nextVarName, {
          source: nextSource as DataExplorerContextVariable["source"],
        });

        scrollParentIntoView(ref.current);
      }}
      placeholder="Select data source…"
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default DataSourceSelect;
