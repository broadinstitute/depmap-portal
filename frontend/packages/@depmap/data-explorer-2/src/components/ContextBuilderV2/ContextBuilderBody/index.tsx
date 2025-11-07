import React from "react";
import { Modal } from "react-bootstrap";
import { Spinner } from "@depmap/common-components";
import { useContextBuilderState } from "../state/ContextBuilderState";
import NameInput from "./NameInput";
import Expression from "./Expression";
import DebugInfo from "./DebugInfo";
import ContextBuilderTableView from "./ContextBuilderTableView";
import styles from "../../../styles/ContextBuilderV2.scss";

function ContextBuilderBody() {
  const {
    isInitializing,
    mainExpr,
    showTableView,
    initializationError,
  } = useContextBuilderState();

  if (initializationError) {
    return <Modal.Body>⚠️ An unepxected error occurred.</Modal.Body>;
  }

  if (isInitializing) {
    return (
      <Modal.Body>
        <Spinner position="static" />
      </Modal.Body>
    );
  }

  return (
    <Modal.Body>
      <NameInput />
      <div className={styles.mainContent}>
        {showTableView ? (
          <ContextBuilderTableView />
        ) : (
          <Expression expr={mainExpr} path={[]} />
        )}
      </div>
      <DebugInfo />
    </Modal.Body>
  );
}

export default ContextBuilderBody;
