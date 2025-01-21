import React from "react";
import ContextNameForm from "../../ContextBuilder/ContextNameForm";
import { useContextBuilderState } from "../state/ContextBuilderState";

function NameInput() {
  const {
    name,
    onChangeName,
    onClickSave,
    shouldShowValidation,
  } = useContextBuilderState();

  return (
    <ContextNameForm
      value={name}
      onChange={onChangeName}
      onSubmit={onClickSave}
      shouldShowValidation={shouldShowValidation}
    />
  );
}

export default NameInput;
