/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Button, Modal } from "react-bootstrap";
import "../styles/modals.scss";

export interface PromptComponentProps {
  value: any;
  onChange: (nextValue: any) => void;
  updateAcceptText: (nextText: string) => void;
}

interface PromptOptions {
  title: string | null;
  PromptComponent: React.ComponentType<PromptComponentProps>;
  defaultValue?: any;
  acceptButtonText?: string | null;
  showModalBackdrop?: boolean | null;
}

function State({
  initialValue,
  children,
}: {
  initialValue: any;
  children: (
    value: any,
    onChange: (nextValue: any) => void,
    acceptText: string | null,
    setAcceptText: (nextText: string) => void
  ) => React.ReactNode;
}) {
  const [value, onChange] = useState<any>(initialValue);
  const [acceptText, setAcceptText] = useState<string | null>(null);

  return children(value, onChange, acceptText, setAcceptText);
}

const launchModal = (options: PromptOptions, resolve: (value: any) => void) => {
  const container = document.createElement("div");
  container.id = "prompt-modal-container";
  document.body.append(container);

  const unmount = () => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  };

  ReactDOM.render(
    <State initialValue={options.defaultValue}>
      {(value, onChange, acceptText, setAcceptText) => (
        <Modal
          show
          backdrop={
            typeof options.showModalBackdrop === "boolean"
              ? options.showModalBackdrop
              : true
          }
          onHide={() => {
            resolve(undefined);
            unmount();
          }}
        >
          <Modal.Header>
            <Modal.Title>{options.title || "Choose a value"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <section>
              <options.PromptComponent
                value={value}
                onChange={onChange}
                updateAcceptText={setAcceptText}
              />
            </section>
          </Modal.Body>
          <Modal.Footer>
            <Button
              onClick={() => {
                resolve(undefined);
                unmount();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={value === undefined || value === null}
              bsStyle="primary"
              onClick={() => {
                resolve(value);
                unmount();
              }}
            >
              {acceptText || options.acceptButtonText || "OK"}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </State>,
    container
  );
};

export default function promptForValue(options: PromptOptions) {
  return new Promise<any>((resolve) => {
    launchModal(options, resolve);
  });
}
