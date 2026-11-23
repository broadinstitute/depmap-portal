import React from "react";
import { ReleaseVersion } from "@depmap/types";
import globalDataPageStyles from "src/dataPageV2/styles.scss";
import styles from "./ReleaseBody.scss";
import { Markdown } from "@depmap/common-components";

interface ReleaseBodyProps {
  version: ReleaseVersion;
  currentSelection: string;
  onViewVersion: (version: ReleaseVersion) => void;
}

const ReleaseBody: React.FC<ReleaseBodyProps> = ({
  version,
  currentSelection,
  onViewVersion,
}) => (
  <div className={styles.body}>
    {version.description ? (
      <Markdown
        className={`${globalDataPageStyles.collapsiblePanelBodySection} ${styles.description}`}
      >
        {version.description}
      </Markdown>
    ) : (
      <div className={styles.emptyDescription}>
        No description available for this release version.
      </div>
    )}

    <div className={styles.actionRow}>
      <div className={styles.versionActionGroup}>
        <button
          type="button"
          className={styles.viewVersionButton}
          onClick={() => onViewVersion(version)}
        >
          <span>{`See ${currentSelection}`}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  </div>
);

export default ReleaseBody;
