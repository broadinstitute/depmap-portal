import React from "react";
import { useContextBuilderState } from "../state/ContextBuilderState";
import ContextNameForm from "./ContextNameForm";

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
