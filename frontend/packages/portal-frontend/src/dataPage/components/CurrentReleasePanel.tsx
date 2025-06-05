import { DownloadTableData, Release } from "@depmap/data-slicer";
import React, { useCallback, useMemo, useState } from "react";
import styles from "src/dataPage/styles/DataPage.scss";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import DataAvailabilityPlot from "./DataAvailabilityPlot";
import { DownloadLink } from "@depmap/downloads";
import ReleaseTabs from "./ReleaseTabs";
import DataStructureSection from "./DataStructureSection";
import { de2PageHref, overviewTabHref } from "./utils";
import { DataAvailability } from "@depmap/types";
import MapSection from "./MapSection";
import HowDoICiteSection from "./HowDoICiteSection";

interface CurrentReleasePanelProps {
  currentReleaseData: DownloadTableData;
  release: Release;
  currentReleaseDataAvail: DataAvailability;
  termsDefinitions: { [key: string]: string };
  releaseNotesUrl: string | null;
}

function CurrentReleasePanel(props: CurrentReleasePanelProps) {
  const {
    currentReleaseData,
    release,
    currentReleaseDataAvail,
    termsDefinitions,
    releaseNotesUrl,
  } = props;

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  const readMeFile = useMemo(() => {
    return currentReleaseData.find(
      (file) => file.fileSubType.code === "read_me"
    );
  }, [currentReleaseData]);

  // Support linking directly to citation section from other pages.
  const [citationSectionIsOpen, setCitationSectionIsOpen] = useState<boolean>(
    false
  );
  const [citationSectionKeySuffix, setCitationSectionKeySuffix] = useState(0);
  const forceCitationSectionUpdate = () =>
    setCitationSectionKeySuffix((n) => n + 1);
  const scroll = useCallback(() => {
    if (window.location.hash === "#how-to-cite" && document) {
      const target = window.location.hash;
      const element = document.querySelector(target)!;

      setTimeout(() => {
        window.scrollTo({
          top: element.getBoundingClientRect().top,
          behavior: "smooth",
        });
      }, 0);
      setCitationSectionIsOpen(true);
      forceCitationSectionUpdate();
    }
  }, []);

  return (
    <div className={styles.CurrentReleasePanel}>
      <div className={styles.overview}>
        {currentReleaseData.length > 0 && (
          <div className={styles.overviewColumnLeft}>
            <div className={styles.smallTextMetadata}>
              {currentReleaseData[0].date}
            </div>
            <div className={styles.overColumnHeader}>
              {currentReleaseData[0].releaseName}
            </div>
            <div className={styles.overviewParagraph}>
              We are excited to continue to bring new data to the DepMap portal!
              In each release, we produce a number of data files for you to use
              in portal tools or download. These data files include:{" "}
              <b>
                Model and Model Condition metadata, CRISPR Screens, Drug
                Screens, Copy Number, Mutation, Expression, and Fusions.
              </b>
            </div>
            <br />
            <div className={styles.overviewParagraph}>
              Each of these files is updated with each new DepMap Release,
              meaning the data may change as we continue to improve upon our
              pipelines and data generation. For more information on release
              files and what is in each file, always refer to the{" "}
              {readMeFile ? (
                <DownloadLink
                  terms={readMeFile!.terms}
                  downloadUrl={readMeFile!.downloadUrl ?? readMeFile!.taigaUrl}
                  termsDefinitions={termsDefinitions}
                  buttonText={"README file."}
                />
              ) : (
                "README file."
              )}
            </div>
          </div>
        )}
        <div className={styles.overviewColumnRight}>
          <div className={styles.plotHeader}>DepMap Release Files</div>
          <div className={styles.plotSubHeader}>
            DepMap Release files are generated from source data (see{" "}
            <a className={styles.dataPageLink} href={overviewTabHref}>
              Overview
            </a>{" "}
            page) and are viewable in{" "}
            <a className={styles.dataPageLink} href={de2PageHref}>
              Data Explorer
            </a>
            .
          </div>

          <DataAvailabilityPlot
            dataAvail={currentReleaseDataAvail}
            handleSetPlotElement={(element: ExtendedPlotType | null) => {
              setPlotElement(element);
            }}
            plotElement={plotElement}
            isCurrentRelease
          />
        </div>
      </div>
      <div className={styles.collapsibleSection}>
        <DataStructureSection dataStructureAccordionIsOpen={false} />
      </div>
      <div className={styles.collapsibleSection2}>
        <MapSection />
      </div>
      <div className={styles.collapsibleSection2}>
        <HowDoICiteSection
          sectionIsOpen={citationSectionIsOpen}
          citationSectionKeySuffix={citationSectionKeySuffix}
          citation={release.citation}
          scroll={scroll}
        />
      </div>
      <div className={styles.releaseDataSection}>
        <h2 className={styles.releaseDataHeader}>Download Release Data</h2>
        <p className={styles.releaseDataSubHeader}>
          Primary and Supplemental files are organized by data type{" "}
        </p>
        <p className={styles.releaseDataSubSubHeader}>
          For more information about how this data is generated, view the{" "}
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
        </p>
        <ReleaseTabs
          currentReleaseData={currentReleaseData}
          release={release}
          termsDefinitions={termsDefinitions}
        />
      </div>
    </div>
  );
}

export default CurrentReleasePanel;
