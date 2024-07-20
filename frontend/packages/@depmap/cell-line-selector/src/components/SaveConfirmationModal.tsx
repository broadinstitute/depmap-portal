import * as React from "react";
import { Modal, Button } from "react-bootstrap";

import "../styles/cell_line_selector.scss";

interface Props {
  show: boolean;
  onHide: () => void;
  linesSelected: ReadonlySet<string>;
  linesSelectedAndHidden: ReadonlySet<string>;
  formatCellLines: (cellLines: ReadonlySet<string>) => React.JSX.Element;
  onSaveButtonClick: () => void;
  onSaveFilteredLines: () => void;
}

function SaveConfirmationModal({
  show,
  onHide,
  linesSelected,
  linesSelectedAndHidden,
  formatCellLines,
  onSaveButtonClick,
  onSaveFilteredLines,
}: Props) {
  return (
    <Modal
      show={show}
      onHide={onHide}
      dialogClassName="message-on-save"
      backdrop={false}
    >
      <Modal.Body>
        <div className="save-modal-content">
          {linesSelected.size === 0 && (
            <div>
              <span style={{ color: "red" }}>ERROR! </span>
              <span>
                You have no cell lines selected. You cannot save this list.{" "}
              </span>
            </div>
          )}
          {linesSelectedAndHidden.size > 0 && (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span style={{ color: "orange" }}>WARNING! </span>
              <strong>
                You have the following checked cell lines hidden by filters:{" "}
              </strong>
              <div style={{ overflow: "auto" }}>
                {formatCellLines(linesSelectedAndHidden)}
              </div>
              <span>
                Would you like to include these cell lines in your list?
              </span>
            </div>
          )}
          <br />
        </div>
      </Modal.Body>
      <Modal.Footer>
        {linesSelected.size === 0 && (
          <Button bsSize="small" onClick={onHide}>
            Take me back to the list editor.
          </Button>
        )}

        {linesSelectedAndHidden.size > 0 && (
          <div>
            <Button
              bsSize="small"
              bsStyle="primary"
              onClick={() => {
                onHide();
                onSaveButtonClick();
              }}
            >
              Include these cell lines and save list
            </Button>
            <Button
              bsStyle="danger"
              bsSize="small"
              onClick={onSaveFilteredLines}
            >
              Remove these cell lines and save list
            </Button>
          </div>
        )}
      </Modal.Footer>
    </Modal>
  );
}

export default SaveConfirmationModal;
