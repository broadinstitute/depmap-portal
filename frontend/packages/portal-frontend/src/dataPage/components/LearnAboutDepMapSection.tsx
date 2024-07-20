import { Accordion } from "@depmap/interactive";
import React from "react";
import styles from "src/dataPage/styles/DataPage.scss";
import { allDataTabHref } from "./utils";

interface LearnAboutDepMapSectionProps {
  releaseNotesUrl: string | null;
  forumUrl: string | null;
}

const LearnAboutDepMapSection = ({
  releaseNotesUrl,
  forumUrl,
}: LearnAboutDepMapSectionProps) => {
  return (
    <div id={"learn-about"}>
      <Accordion
        key="learn-accordion"
        openCloseSymbolStyle={{
          float: "left",
          marginRight: "20px",
          marginTop: "14px",
          position: "relative",
          lineHeight: "unset",
          fontSize: "24px",
        }}
        title={<h1>Where can I learn more about each DepMap Release?</h1>}
      >
        <div className={styles.learnAboutBody}>
          <div className={styles.col1}>
            <div className={styles.paragraphHeader}>Release Files</div>
            <div>
              To learn more about each data file in the DepMap release, or in
              addition to the release files, use the dropdown for each dataset
              on the{" "}
              <a className={styles.dataPageLink} href={allDataTabHref}>
                All Data
              </a>{" "}
              page to learn more. Here, you can find information on how the
              specific file is indexed, how to cite the file, who generated the
              data, and what columns or fields are contained in the file.
            </div>
            <br />
            <div className={styles.paragraphHeader}>Pipeline Updates</div>
            <div>
              DepMap is ever-improving our pipelines to generate the more useful
              data for the research community. To read about our current
              pipeline or updates we have previously made to our pipelines,
              visit our For more information about how this data is generated,
              view the{" "}
              {releaseNotesUrl ? (
                <a
                  className={styles.dataPageLink}
                  href={releaseNotesUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Release Notes
                </a>
              ) : (
                "Release Notes"
              )}
              .
            </div>
            <br />
          </div>
          <div className={styles.col2}>
            <div className={styles.paragraphHeader}>Resources</div>
            <div>
              DepMap is working to build a knowledgebase where you can find
              information on everything available to you in our Portal. At this
              time, head to our{" "}
              {forumUrl ? (
                <a
                  className={styles.dataPageLink}
                  href={forumUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Forum
                </a>
              ) : (
                "Forum"
              )}{" "}
              to ask or find team member answers to all of your questions.
            </div>
          </div>
        </div>
      </Accordion>
    </div>
  );
};

export default LearnAboutDepMapSection;
