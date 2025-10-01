import React from "react";
import { Button, Modal } from "react-bootstrap";
import styles from "../styles/GeneTea.scss";
import renderConditionally from "@depmap/data-explorer-2/src/utils/render-conditionally";

interface Props {
  geneSymbolList: string[];
  show: boolean;
  onClose: () => void;
}

function NullTermsModal({ onClose, show, geneSymbolList }: Props) {
  console.log(geneSymbolList);
  return (
    <Modal show={show} bsSize="large" onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>No Enriched Terms Found</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.GeneTeaModal} />
      <Modal.Footer>
        <Button onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default renderConditionally(NullTermsModal);
