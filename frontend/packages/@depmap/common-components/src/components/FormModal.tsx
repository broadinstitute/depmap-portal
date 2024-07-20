import * as React from "react";
import { Modal, Sizes } from "react-bootstrap";

interface FormModalProps {
  title: string;
  showModal: boolean;
  onHide: () => void;
  formComponent: React.ReactElement;
  bsSize?: Sizes;
}

function FormModal({
  title,
  showModal,
  onHide,
  formComponent,
  bsSize = undefined,
}: FormModalProps) {
  return (
    <Modal show={showModal} onHide={onHide} bsSize={bsSize || undefined}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{formComponent}</Modal.Body>
    </Modal>
  );
}

export default FormModal;
