import React from "react";
import { Button } from "react-bootstrap";
import styles from "../styles/SliceTable.scss";

interface Props {
  isLoading: boolean;
  hadError: boolean;
  onClickAddColumn: () => void;
  renderCustomActions: (state?: {
    isLoading: boolean;
    hadError: boolean;
  }) => React.ReactNode;
}

function Actions({
  isLoading,
  hadError,
  onClickAddColumn,
  renderCustomActions,
}: Props) {
  return (
    <div className={styles.Actions}>
      <Button
        onClick={onClickAddColumn}
        bsStyle="info"
        disabled={isLoading || hadError}
      >
        <i className="glyphicon glyphicon-plus" />
        <span> Add column</span>
      </Button>
      {renderCustomActions({ isLoading, hadError })}
    </div>
  );
}

export default Actions;
