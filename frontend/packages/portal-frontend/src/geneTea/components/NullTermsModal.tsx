import React from "react";
import { Button, Modal } from "react-bootstrap";
import styles from "../styles/GeneTea.scss";

interface Props {
  geneSymbolList: string[];
  show: boolean;
  onClose: () => void;
}

function NullTermsModal({ onClose, show, geneSymbolList }: Props) {
  return (
    <Modal show={show} bsSize="small" onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>No Enriched Terms Found</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.GeneTeaModal} height={"50px"}>
        There were no enriched terms found for this gene list:{" "}
        {geneSymbolList.join(", ")}. Explore All Matching Terms, or try a new
        gene list.
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default NullTermsModal;
