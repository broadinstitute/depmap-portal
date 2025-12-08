import React, { useRef } from "react";
import { DataExplorerContextVariable } from "@depmap/types";
import PlotConfigSelect from "../../../../../PlotConfigSelect";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import { scrollParentIntoView } from "../../../../utils/domUtils";

interface Props {
  expr: Record<"var", string> | null;
  onInvalidateVariable: (nextVarName: string) => void;
}

function DataSourceSelect({ expr, onInvalidateVariable }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const {
    dimension_type,
    metadataDataset,
    vars,
    setVar,
  } = useContextBuilderState();

  const varName = expr ? expr.var : null;
  const slice = varName ? vars[varName] : null;
  const source = slice?.source || null;

  const options = [
    { label: "Annotation", value: "property" },
    { label: "Dataset", value: "custom" },
  ];

  return (
    <PlotConfigSelect
      show
      enable
      label="Data Source"
      innerRef={ref}
      value={source}
      options={options}
      onChange={(nextSource) => {
        if (nextSource === source) {
          return;
        }

        // The name "given_id" has special meaning and is reserved.
        let nextVarName = varName === "given_id" ? null : varName;

        // Create a var reference if one doesn't exist.
        if (!nextVarName) {
          nextVarName = crypto.randomUUID();
        }

        // The outer expression may no longer make sense, so make sure it gets
        // reset.
        onInvalidateVariable(nextVarName);

        // Update the var reference.
        setVar(nextVarName, {
          source: nextSource as DataExplorerContextVariable["source"],
          dataset_id:
            nextSource === "property"
              ? metadataDataset?.given_id || `${dimension_type}_metadata`
              : undefined,
          identifier_type: nextSource === "property" ? "column" : undefined,
        });

        scrollParentIntoView(ref.current);
      }}
      placeholder="Select data source…"
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default DataSourceSelect;
