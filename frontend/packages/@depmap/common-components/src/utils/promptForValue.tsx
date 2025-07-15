/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Button, Modal } from "react-bootstrap";
import "../styles/modals.scss";

export interface PromptComponentProps<T> {
  value: T;
  onChange: React.Dispatch<React.SetStateAction<T>>;
  updateAcceptText: (nextText: string) => void;
}

type ModalProps = React.ComponentProps<typeof Modal>;
type ModalPropsWithOptionalOnHide = Omit<ModalProps, "onHide"> & {
  onHide?: ModalProps["onHide"];
};

interface PromptOptions<T> {
  title: string | null;
  PromptComponent: React.ComponentType<PromptComponentProps<T>>;
  defaultValue?: any;
  acceptButtonText?: string | null;
  modalProps?: ModalPropsWithOptionalOnHide;
  secondaryAction?: {
    buttonText: string;
    bsStyle?: string | null | undefined;
    // This should return a Promise of `true` if the action has been
    // handled (and the modal should now close) and `false` otherwise.
    onClick: (value: T) => Promise<boolean>;
  };
}

function State<T>({
  initialValue,
  children,
}: {
  initialValue: T;
  children: (
    value: T,
    onChange: (nextValue: T) => void,
    acceptText: string | null,
    setAcceptText: (nextText: string) => void
  ) => React.ReactNode;
}) {
  const [value, onChange] = useState<T>(initialValue);
  const [acceptText, setAcceptText] = useState<string | null>(null);

  return children(value, onChange, acceptText, setAcceptText);
}

function launchModal<T>(
  options: PromptOptions<T>,
  resolve: (value: T | undefined) => void
) {
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
          backdrop="static"
          {...options.modalProps}
          show
          onHide={() => {
            resolve(undefined);
            options.modalProps?.onHide?.();
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
            {options.secondaryAction && (
              <Button
                bsStyle={options.secondaryAction.bsStyle || "info"}
                onClick={() => {
                  options.secondaryAction!.onClick(value).then((handled) => {
                    if (handled) {
                      resolve(undefined);
                      unmount();
                    }
                  });
                }}
              >
                {options.secondaryAction.buttonText}
              </Button>
            )}
            <Button
              disabled={value === null || value === undefined}
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
}

export default function promptForValue<T>(options: PromptOptions<T>) {
  return new Promise<T | undefined>((resolve) => {
    launchModal<T>(options, resolve);
  });
}
