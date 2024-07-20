import React, { useCallback, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

const interactivePageHref = window.location.href.replace(
  "data_explorer_2",
  "interactive"
);

const CloseButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button type="button" className="close" onClick={onClick}>
      <span aria-hidden="true">&times;</span>
      <span className="sr-only">Close</span>
    </button>
  );
};

interface Props {
  isInitialPageLoad: boolean;
}

function NewVersionBanner({ isInitialPageLoad }: Props) {
  const [hidden, setHidden] = useState(!isInitialPageLoad);

  useEffect(() => {
    if (!isInitialPageLoad) {
      setHidden(true);
    }
  }, [isInitialPageLoad]);

  const handleClickOpenOriginal = useCallback(() => {
    window.open(interactivePageHref, "_self");
  }, []);

  if (hidden) {
    return null;
  }

  return (
    <div className={styles.NewVersionBanner}>
      <div />
      <div>
        <p>
          You’re viewing the new version of Data Explorer.
          <Button bsStyle="primary" onClick={handleClickOpenOriginal}>
            Go back to original
          </Button>
        </p>
      </div>
      <CloseButton onClick={() => setHidden(true)} />
    </div>
  );
}

export default NewVersionBanner;
