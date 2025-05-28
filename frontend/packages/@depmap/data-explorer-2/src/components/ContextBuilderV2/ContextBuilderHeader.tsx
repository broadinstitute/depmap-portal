import React from "react";
import { Modal } from "react-bootstrap";
import { DataExplorerContextV2 } from "@depmap/types";
import useDimensionType from "./hooks/useDimensionType";
import { capitalize } from "../../utils/misc";

interface Props {
  context: Partial<DataExplorerContextV2>;
  isExistingContext: boolean;
}

function ContextBuilderHeader({ context, isExistingContext }: Props) {
  const { dimensionType } = useDimensionType();

  const typeName = dimensionType ? capitalize(dimensionType.display_name) : "";
  let createEditOrSave = `Create ${/^[AEIOU]/.test(typeName) ? "an" : "a"}`;

  // FIXME: Find a better way to specify that we're not creating than by
  // checking for the preseence of `expr`
  if ("expr" in context) {
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
