import React from "react";
import ReactDOM from "react-dom";
import { Button, Modal } from "react-bootstrap";
import "../styles/modals.scss";

type ModalProps = React.ComponentProps<typeof Modal>;
type ModalPropsWithOptionalOnHide = Omit<ModalProps, "onHide"> & {
  onHide?: ModalProps["onHide"];
};

interface InfoModalOptions {
  title: string;
  content: React.ReactNode;
  modalProps?: ModalPropsWithOptionalOnHide;
}

export default function showInfoModal(options: InfoModalOptions) {
  const container = document.createElement("div");
  container.id = "confirmation-modal-container";
  document.body.append(container);

  const unmount = () => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  };

  ReactDOM.render(
    <Modal
      backdrop="static"
      {...options.modalProps}
      show
      onHide={() => {
        options.modalProps?.onHide?.();
        unmount();
      }}
    >
      <Modal.Header>
        <Modal.Title>{options.title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <section>{options.content}</section>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={unmount}>Close</Button>
      </Modal.Footer>
    </Modal>,

    container
  );
}
