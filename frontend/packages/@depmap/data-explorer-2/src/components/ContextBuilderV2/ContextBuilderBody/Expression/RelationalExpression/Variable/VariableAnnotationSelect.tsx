import React from "react";
import AnnotationSelect from "../../../../../AnnotationSelect";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";

interface Props {
  varName: string;
  onInvalidateVariable: (nextVarName: string) => void;
}

function VariableAnnotationSelect({ varName, onInvalidateVariable }: Props) {
  const { dimension_type, vars, setVar } = useContextBuilderState();
  const variable = vars[varName] || null;

  return (
    <AnnotationSelect
      dimension_type={dimension_type}
      dataset_id={variable?.dataset_id || null}
      identifier={variable?.identifier || null}
      identifierDisplayLabel={variable?.label || null}
      onChangeSourceDataset={(dataset_id, identifier_type) => {
        onInvalidateVariable(varName);

        setVar(varName, {
          dataset_id,
          identifier_type,
          identifier: undefined,
          source: "property",
          slice_type: undefined,
        });
      }}
      onChangeAnnotationSlice={(identifier: string, label: string) => {
        setVar(varName, {
          dataset_id: variable.dataset_id,
          identifier_type: variable.identifier_type,
          identifier,
          label,
          source: "property",
          slice_type: undefined,
        });
      }}
      menuPortalTarget={document.querySelector("#modal-container")}
      removeWrapperDiv
    />
  );
}

export default VariableAnnotationSelect;
