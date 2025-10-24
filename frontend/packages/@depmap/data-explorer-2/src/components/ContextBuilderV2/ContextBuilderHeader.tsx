import React from "react";
import { Modal } from "react-bootstrap";
import useDimensionType from "./hooks/useDimensionType";
import { capitalize } from "../../utils/misc";

interface Props {
  hasExpr: boolean;
  isExistingContext: boolean;
}

function ContextBuilderHeader({ hasExpr, isExistingContext }: Props) {
  const { dimensionType } = useDimensionType();

  const typeName = dimensionType ? capitalize(dimensionType.display_name) : "";
  let createEditOrSave = `Create ${/^[AEIOU]/.test(typeName) ? "an" : "a"}`;

  if (hasExpr) {
    createEditOrSave = isExistingContext ? "Edit" : "Save as";
  }

  return (
    <Modal.Header closeButton>
      <Modal.Title>
        {createEditOrSave} {typeName} Context
      </Modal.Title>
    </Modal.Header>
  );
}

export default ContextBuilderHeader;
