import React from "react";
import { Modal } from "react-bootstrap";
import { DataExplorerContextV2 } from "@depmap/types";
import { ContextBuilderStateProvider } from "./state/ContextBuilderState";
import ContextBuilderHeader from "./ContextBuilderHeader";
import ContextBuilderBody from "./ContextBuilderBody";
import ContextBuilderFooter from "./ContextBuilderFooter";
import styles from "../../styles/ContextBuilderV2.scss";

interface Props {
  backdrop: "static" | boolean;
  context: { dimension_type: string } | DataExplorerContextV2;
  isExistingContext: boolean;
  onClickSave: (newContext: DataExplorerContextV2) => void;
  onHide: () => void;
  show: boolean;
}

function ContextBuilderModal({
  backdrop,
  context,
  isExistingContext,
  onClickSave,
  onHide,
  show,
}: Props) {
  return (
    <ContextBuilderStateProvider
      contextToEdit={context}
      onChangeContext={onClickSave}
    >
      <Modal
        id="context-builder-modal"
        className={styles.ContextBuilder}
        backdrop={backdrop}
        show={show}
        onHide={onHide}
        bsSize="large"
        keyboard={false}
      >
        <ContextBuilderHeader
          context={context}
          isExistingContext={isExistingContext}
        />
        <ContextBuilderBody />
        <ContextBuilderFooter onClickCancel={onHide} />
      </Modal>
    </ContextBuilderStateProvider>
  );
}

export default ContextBuilderModal;
