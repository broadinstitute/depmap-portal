import React from "react";
import { Modal } from "react-bootstrap";
import { useContextBuilderState } from "../state/ContextBuilderState";
import NameInput from "./NameInput";
import Expression from "./Expression";
import DebugInfo from "./DebugInfo";
import styles from "../../../styles/ContextBuilderV2.scss";

function ContextBuilderBody() {
  const { isInitializing, mainExpr } = useContextBuilderState();

  return (
    <Modal.Body>
      {isInitializing ? (
        <h2>Loading...</h2>
      ) : (
        <>
          <NameInput />
          <div className={styles.mainExpr}>
            <Expression expr={mainExpr} path={[]} />
          </div>
          <DebugInfo />
        </>
      )}
    </Modal.Body>
  );
}

export default ContextBuilderBody;
