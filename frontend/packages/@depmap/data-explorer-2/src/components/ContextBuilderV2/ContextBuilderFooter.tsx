import React from "react";
import { Button, Modal } from "react-bootstrap";
import { useContextBuilderState } from "./state/ContextBuilderState";

interface Props {
  onClickCancel: () => void;
}

function ContextBuilderFooter({ onClickCancel }: Props) {
  const { onClickSave, isEmptyExpression } = useContextBuilderState();

  return (
    <Modal.Footer>
      <Button
        id="cancel-context-builder"
        onClick={onClickCancel}
        style={{ marginRight: 5 }}
      >
        Cancel
      </Button>
      <Button
        id="save-context-builder"
        bsStyle="primary"
        onClick={onClickSave}
        disabled={isEmptyExpression}
      >
        Save
      </Button>
    </Modal.Footer>
  );
}

export default ContextBuilderFooter;
