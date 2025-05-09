import React, { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import styles from "../../../../styles/LegacyPrecomputedAssociations.scss";

interface Props {
  show: boolean;
  onHide: () => void;
  associatedDatasets: string[];
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
    setHiddenDataset(new Set(associatedDatasets));
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
        {associatedDatasets.map((datasetName) => (
          <div key={datasetName}>
            <label>
              <input
                type="checkbox"
                checked={!hiddenDatasets.has(datasetName)}
                onChange={() => {
                  setHiddenDataset((prev) => {
                    const next = new Set(prev);

                    if (prev.has(datasetName)) {
                      next.delete(datasetName);
                    } else {
                      next.add(datasetName);
                    }

                    return next;
                  });
                }}
              />
              <span>{datasetName}</span>
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
