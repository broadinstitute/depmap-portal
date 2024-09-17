import React, { useEffect } from "react";
import { Modal } from "react-bootstrap";
import { DataExplorerContext } from "@depmap/types";
import { capitalize, getDimensionTypeLabel } from "../../utils/misc";
import ModalContent from "./ModalContent";
import useCellLineSelectorModal from "./CellLineSelector/useCellLineSelectorModal";
import { ContextBuilderContextProvider } from "./ContextBuilderContext";
import styles from "../../styles/ContextBuilder.scss";

interface Props {
  show: boolean;
  context: DataExplorerContext | Partial<DataExplorerContext> | null;
  onClickSave: (newContext: DataExplorerContext) => void;
  onHide: () => void;
  backdrop?: "static" | boolean;
  isExistingContext?: boolean;
}

function ContextBuilderModal({
  show,
  context,
  onClickSave,
  onHide,
  backdrop = "static",
  isExistingContext = false,
}: Props) {
  useEffect(() => {
    let modal = document.querySelector("#modal-container") as HTMLElement;

    if (!modal) {
      modal = document.createElement("div");
      document.body.appendChild(modal);
    }

    modal.id = "modal-container";
    modal.style.zIndex = "1051";
    modal.style.position = "absolute";
    modal.style.top = "0";
  }, []);

  const contextTypeName = context
    ? capitalize(getDimensionTypeLabel(context.context_type as string))
    : "";

  const title = `${
    context && "expr" in context
      ? `${isExistingContext ? "Edit" : "Save as"}`
      : `Create ${/^[AEIOU]/.test(contextTypeName) ? "an" : "a"}`
  } ${contextTypeName} Context`;

  const {
    CellLineSelectorModal,
    isCellLineSelectorVisible,
    editInCellLineSelector,
  } = useCellLineSelectorModal();

  return (
    <ContextBuilderContextProvider dimension_type={context?.context_type}>
      <Modal
        className={styles.ContextBuilder}
        backdrop={backdrop}
        show={show}
        onHide={onHide}
        bsSize="large"
        keyboard={false}
        style={{
          visibility: isCellLineSelectorVisible ? "hidden" : "visible",
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body key={`${show}`}>
          <ModalContent
            context={context}
            onClickSave={onClickSave}
            onClickCancel={onHide}
            editInCellLineSelector={editInCellLineSelector}
          />
        </Modal.Body>
      </Modal>
      <CellLineSelectorModal />
    </ContextBuilderContextProvider>
  );
}

export default ContextBuilderModal;
