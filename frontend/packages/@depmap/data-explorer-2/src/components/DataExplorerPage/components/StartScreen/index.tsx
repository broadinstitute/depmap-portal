import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { breadboxAPI, legacyPortalAPI } from "@depmap/api";
import { isElara } from "@depmap/globals";
import { UploadFormat, UserUploadModal } from "@depmap/user-upload";
import StartScreenExamples from "./StartScreenExamples";
import styles from "../../styles/DataExplorer2.scss";

interface Props {
  tutorialLink: string;
}

function StartScreen({ tutorialLink }: Props) {
  const [showCsvUploadModal, setShowCsvUploadModal] = useState(false);

  return (
    <div id="dx2_start_screen" className={styles.plotEmptyState}>
      <h2>Welcome to Data Explorer 2.0</h2>
      <p>
        Data Explorer 2.0 is a new app that expands on the capabilities of the
        original Data Explorer. It’s focused on providing greater power in terms
        of what you can plot and how you can visualize relationships.{" "}
        <a href={tutorialLink} rel="noreferrer" target="_blank">
          View the tutorial
        </a>
      </p>
      <h3>Getting Started</h3>
      <p>Use these buttons to perform a Custom Analysis or plot from a CSV.</p>
      <div className={styles.startScreenActions}>
        <Button
          href={
            isElara ? "./custom_analysis" : "../interactive/custom_analysis"
          }
          bsStyle="primary"
          rel="noreferrer"
          target="_blank"
        >
          Custom Analysis
        </Button>
        <Button bsStyle="default" onClick={() => setShowCsvUploadModal(true)}>
          Plot from CSV
        </Button>
      </div>
      {!isElara && (
        <>
          <h3>Using Data Explorer 2.0</h3>
          <StartScreenExamples />
        </>
      )}
      <UserUploadModal
        key={`${showCsvUploadModal}`}
        show={showCsvUploadModal}
        onHide={() => setShowCsvUploadModal(false)}
        uploadFormat={UploadFormat.File}
        isPrivate={false}
        isTransient
        taskKickoffFunction={(args) => {
          if (isElara) {
            // There is an Asana ticket to fix this.
            // https://app.asana.com/1/9513920295503/project/1200435587978125/task/1210026345785485
            // Note that Elara API used to have an implementation of postCustomCsv but it looks
            // like it takes different arguments that the Legacy Portal version.
            // https://github.com/broadinstitute/depmap-portal/blob/d9751a1/frontend/packages/elara-frontend/src/api.ts#L563-L575
            throw new Error("Not implemented in Elara!");
          }

          return legacyPortalAPI.postCustomCsv({
            ...args,
            useDataExplorer2: true,
          });
        }}
        getTaskStatus={
          isElara ? breadboxAPI.getTaskStatus : legacyPortalAPI.getTaskStatus
        }
      />
    </div>
  );
}

export default StartScreen;
