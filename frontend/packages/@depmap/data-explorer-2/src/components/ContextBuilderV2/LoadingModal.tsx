import React from "react";
import { Button, Modal } from "react-bootstrap";
import { Spinner } from "@depmap/common-components";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import ContextNameForm from "../ContextBuilder/ContextNameForm";
import ContextBuilderHeader from "./ContextBuilderHeader";
import styles from "../../styles/ContextBuilderV2.scss";

interface Props {
  backdrop: "static" | boolean;
  context:
    | { context_type: string }
    | { dimension_type: string }
    | DataExplorerContext
    | DataExplorerContextV2;
  isExistingContext: boolean;
  onHide: () => void;
}

function LoadingModal({ backdrop, context, isExistingContext, onHide }: Props) {
  return (
    <Modal
      show
      id="context-builder-modal"
      className={styles.ContextBuilder}
      backdrop={backdrop}
      onHide={onHide}
      bsSize="large"
      keyboard={false}
    >
      <ContextBuilderHeader
        hasExpr={"expr" in context}
        isExistingContext={isExistingContext}
      />
      <Modal.Body>
        <ContextNameForm
          disabled
          value={"name" in context ? context.name : undefined}
          onChange={() => {}}
          onSubmit={() => {}}
          shouldShowValidation={false}
        />

        <Spinner position="static" />
      </Modal.Body>
      <Modal.Footer>
        <Button
          id="cancel-context-builder"
          onClick={onHide}
          style={{ marginRight: 5 }}
        >
          Cancel
        </Button>
        <Button
          id="save-context-builder"
          bsStyle="primary"
          onClick={() => {}}
          disabled
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default LoadingModal;
