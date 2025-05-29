import React, { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import usePrecomputedAssocationData from "../../../hooks/usePrecomputedAssocationData";
import styles from "../../../styles/PrecomputedAssociations.scss";

interface Props {
  show: boolean;
  onHide: () => void;
  associatedDatasets: ReturnType<
    typeof usePrecomputedAssocationData
  >["associatedDatasets"];
  initialValue: Set<string>;
  onChange: (nextValue: Set<string>) => void;
}

function DatasetFilterModal({
  show,
  onHide,
  associatedDatasets,
  initialValue,
  onChange,
}: Props) {
  const [hiddenDatasets, setHiddenDataset] = useState(initialValue);

  const handleCLickSelectAll = () => {
    setHiddenDataset(new Set());
  };

  const handleCLickUnselectAll = () => {
    setHiddenDataset(new Set(associatedDatasets.map((d) => d.dataset_id)));
  };

  return (
    <Modal backdrop="static" show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Choose datasets to include</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.associatedDatasets}>
        <div>
          <button type="button" onClick={handleCLickSelectAll}>
            Select all
          </button>
          <span>|</span>
          <button type="button" onClick={handleCLickUnselectAll}>
            Unselect all
          </button>
        </div>
        {associatedDatasets.map(({ name, dataset_id }) => (
          <div key={name}>
            <label>
              <input
                type="checkbox"
                checked={!hiddenDatasets.has(dataset_id)}
                onChange={() => {
                  setHiddenDataset((prev) => {
                    const next = new Set(prev);

                    if (prev.has(dataset_id)) {
                      next.delete(dataset_id);
                    } else {
                      next.add(dataset_id);
                    }

                    return next;
                  });
                }}
              />
              <span>{name}</span>
            </label>
          </div>
        ))}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onHide}>Cancel</Button>
        <Button
          bsStyle="primary"
          disabled={hiddenDatasets.size === associatedDatasets.length}
          onClick={() => {
            onChange(hiddenDatasets);
            onHide();
          }}
        >
          OK
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default DatasetFilterModal;
