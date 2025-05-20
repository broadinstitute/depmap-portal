import * as React from "react";
import { Button, Modal } from "react-bootstrap";
import { ReleaseCard, ReleaseModalProps } from "./ReleaseModal";

export interface ReleaseModal extends ReleaseModalProps {
  show: boolean;
  toggleShowReleaseModalHandler: () => void;
}

export const ReleaseCardModal = ({
  dataUsageUrl,
  file,
  release,
  show,
  termsDefinitions,
  toggleShowReleaseModalHandler,
}: ReleaseModal) => {
  return (
    <div className="card-modal">
      {show && (
        <Modal
          show={show}
          onHide={toggleShowReleaseModalHandler}
          dialogClassName="dataset_modal"
        >
          <Modal.Body>
            <div>
              <Button
                style={{
                  display: "relative",
                  float: "right",
                  fontSize: "14pt",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={toggleShowReleaseModalHandler}
              >
                <strong>X</strong>
              </Button>
            </div>
            <ReleaseCard
              termsDefinitions={termsDefinitions}
              file={file}
              dataUsageUrl={dataUsageUrl}
              release={release}
            />
          </Modal.Body>
        </Modal>
      )}
    </div>
  );
};
