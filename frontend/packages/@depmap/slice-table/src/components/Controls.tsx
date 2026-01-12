import React from "react";
import { Button } from "react-bootstrap";
import styles from "../styles/SliceTable.scss";

interface Props {
  isLoading: boolean;
  hadError: boolean;
  onClickFilterButton: () => void;
  onClickDownload: () => void;
  renderCustomControls: () => React.ReactNode;
  numFiltersApplied: number;
}

function Controls({
  isLoading,
  hadError,
  onClickFilterButton,
  onClickDownload,
  renderCustomControls,
  numFiltersApplied,
}: Props) {
  return (
    <div className={styles.Controls}>
      <div>{renderCustomControls()}</div>
      <div>
        <Button
          onClick={onClickFilterButton}
          bsSize="small"
          disabled={isLoading || hadError}
        >
          <i className="glyphicon glyphicon-filter" />
          <span> Filters</span>
          {numFiltersApplied > 0 && (
            <span className={styles.filterBadge}>{numFiltersApplied}</span>
          )}
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
    </div>
  );
}

export default Controls;
