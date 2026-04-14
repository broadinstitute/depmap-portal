import React from "react";
import { AnnotationSelect } from "@depmap/selects";
import { SliceQuery } from "@depmap/types";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import styles from "../../../../../../styles/ContextBuilderV2.scss";

interface Props {
  varName: string;
  onInvalidateVariable: (nextVarName: string) => void;
}

function VariableAnnotationSelect({ varName, onInvalidateVariable }: Props) {
  const {
    dimension_type,
    vars,
    setVar,
    fullySpecifiedVars,
  } = useContextBuilderState();
  const variable = vars[varName] || null;

  const value = fullySpecifiedVars.has(varName)
    ? (variable as SliceQuery)
    : null;
  const initialDatasetId = value ? undefined : variable?.dataset_id;

  return (
    <AnnotationSelect
      className={styles.VariableAnnotationSelect}
      index_type={dimension_type}
      value={value}
      initialDatasetId={initialDatasetId}
      valueLabel={variable?.label || variable?.identifier}
      onChange={(slice, meta) => {
        if (slice === null) {
          onInvalidateVariable(varName);

          setVar(varName, {
            dataset_id: undefined,
            identifier_type: undefined,
            identifier: undefined,
            source: "property",
            slice_type: undefined,
          });
        } else {
          setVar(varName, {
            ...slice,
            ...meta,
            source: "property",
          });
        }
      }}
      menuPortalTarget={
        document.querySelector("#modal-container") as HTMLDivElement
      }
    />
  );
}

export default VariableAnnotationSelect;
