import React, { useEffect } from "react";
import { Button, Modal } from "react-bootstrap";
import { setQueryStringsWithoutPageReload } from "@depmap/utils";
import { FileCard, FileModalProps } from "@depmap/downloads";

export interface FileModal extends FileModalProps {
  show: boolean;
  toggleShowFileModalHandler: () => void;
}

export const FileCardModal = ({
  show,
  toggleShowFileModalHandler,
  file,
  release,
  termsDefinitions,
}: FileModal) => {
  useEffect(() => {
    const releaseFileNameParams: [string, string][] =
      release?.releaseName !== undefined || file !== undefined
        ? [
            ["releasename", release.releaseName],
            ["filename", file.fileName],
          ]
        : [
            ["", ""],
            ["", ""],
          ];

    if (releaseFileNameParams) {
      setQueryStringsWithoutPageReload(releaseFileNameParams);
    }
  }, [file, release]);

  return (
    <div className="card-modal">
      {show && (
        <Modal
          show={show}
          onHide={toggleShowFileModalHandler}
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
                onClick={toggleShowFileModalHandler}
              >
                <strong>X</strong>
              </Button>
            </div>
            <FileCard
              file={file}
              release={release}
              termsDefinitions={termsDefinitions}
            />
          </Modal.Body>
        </Modal>
      )}
    </div>
  );
};
