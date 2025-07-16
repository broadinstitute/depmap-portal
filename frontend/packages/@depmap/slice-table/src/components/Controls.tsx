import React from "react";
import { Button } from "react-bootstrap";
import styles from "../styles/SliceTable.scss";

interface Props {
  isLoading: boolean;
  hadError: boolean;
  onClickFilterButton: () => void;
  onClickDownload: () => void;
}

function Controls({
  isLoading,
  hadError,
  onClickFilterButton,
  onClickDownload,
}: Props) {
  return (
    <div className={styles.Controls}>
      <Button
        onClick={onClickFilterButton}
        bsSize="small"
        disabled={isLoading || hadError}
      >
        <i className="glyphicon glyphicon-filter" />
        <span> Filters</span>
      </Button>
      <Button
        onClick={onClickDownload}
        bsSize="small"
        disabled={isLoading || hadError}
      >
        <i className="glyphicon glyphicon-download-alt" />
        <span> Download data</span>
      </Button>
    </div>
  );
}

export default Controls;
