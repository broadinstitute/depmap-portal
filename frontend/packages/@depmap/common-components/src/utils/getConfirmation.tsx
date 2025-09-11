import React from "react";
import ReactDOM from "react-dom";
import { Button, Modal } from "react-bootstrap";
import "../styles/modals.scss";

interface ConfirmationOptions {
  title?: string | null;
  yesText?: string | null;
  noText?: string | null;
  message: React.ReactNode;
  showModalBackdrop?: boolean | null;
  yesButtonBsStyle?: string | null | undefined;
}

const launchModal = (
  options: ConfirmationOptions,
  resolve: (ok: boolean) => void
) => {
  const container = document.createElement("div");
  container.id = "confirmation-modal-container";
  document.body.append(container);

  const unmount = () => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  };

  ReactDOM.render(
    <Modal
      show
      backdrop={
        typeof options.showModalBackdrop === "boolean"
          ? options.showModalBackdrop
          : true
      }
      onHide={() => {
        resolve(false);
        unmount();
      }}
    >
      <Modal.Header>
        <Modal.Title>{options.title || "Are you sure?"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <section>{options.message}</section>
      </Modal.Body>
      <Modal.Footer>
        <Button
          onClick={() => {
            resolve(false);
            unmount();
          }}
        >
          {options.noText || "No"}
        </Button>
        <Button
          bsStyle={options.yesButtonBsStyle || "danger"}
          onClick={() => {
            resolve(true);
            unmount();
          }}
        >
          {options.yesText || "Yes"}
        </Button>
      </Modal.Footer>
    </Modal>,

    container
  );
};

export default function getConfirmation(options: ConfirmationOptions) {
  return new Promise<boolean>((resolve) => {
    launchModal(options, resolve);
  });
}
