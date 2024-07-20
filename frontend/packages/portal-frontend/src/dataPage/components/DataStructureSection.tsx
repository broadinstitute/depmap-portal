import { Accordion } from "@depmap/interactive";
import React from "react";
import { getDapi } from "src/common/utilities/context";

import styles from "src/dataPage/styles/DataPage.scss";
import { currentReleaseTabHref, de2PageHref } from "./utils";

interface DatStructureSectionProps {
  dataStructureAccordionIsOpen: boolean;
  keySuffix?: number;
}

const DataStructureSection = ({
  dataStructureAccordionIsOpen,
  keySuffix = 1,
}: DatStructureSectionProps) => {
  const dataStructureImage = (
    <img
      style={{ maxWidth: "675px", width: "100%" }}
      src={getDapi()._getFileUrl(
        "/static/img/data_page/data_structure_final.png"
      )}
      alt="Diagram of DepMap data structure"
    />
  );

  return (
    <div id={"data-structure"}>
      <Accordion
        key={`data-structure-section${keySuffix}`}
        isOpen={dataStructureAccordionIsOpen}
        openCloseSymbolStyle={{
          float: "left",
          marginRight: "20px",
          marginTop: "14px",
          position: "relative",
          lineHeight: "unset",
          fontSize: "24px",
        }}
        title={<h1>How is DepMap data structured?</h1>}
      >
        <div className={styles.dataStructureBody}>
          <div className={styles.dataStructureColumns}>
            <div className={styles.colParagraph}>
              Depmap Releases utilize a multi-level data hierarchy to
              accommodate richer types of data. Each element in the hierarchy is
              indexed by a unique ID and defined by a set of tables in the data
              release.
            </div>

            <div className={styles.colParagraph}>
              {" "}
              Because there can be multiple conditions for each model,{" "}
              <a className={styles.dataPageLink} href={currentReleaseTabHref}>
                mapping files
              </a>{" "}
              are available to help you connect IDs and better understand which
              data are available across our portal tools.
            </div>

            <div className={styles.colParagraph}>
              You can now view data for any condition for DepMap Release data in{" "}
              <a
                className={styles.dataPageLink}
                href={de2PageHref}
                target="_blank"
                rel="noreferrer"
              >
                Data Explorer
              </a>
              . However, please note that we do set a default condition for data
              shown.
            </div>

            <div className={styles.colParagraph}>
              Some collaborator datasets may follow the same structure as DepMap
              Release data, but are considered independent. This data may be
              available to you in Data Explorer as additional files.
            </div>
          </div>
          <div className={styles.dataStructureColumns}>
            {" "}
            <div className={styles.sectionHeader}>DepMap Data Structure</div>
            <div className={styles.colParagraph}>
              At the top of the hierarchy is{" "}
              <span className={styles.patientColor}>Patient</span>.
            </div>
            <div className={styles.colParagraph}>
              <span className={styles.modelColor}>Models</span> are a collection
              of cells derived from a single biopsy of the{" "}
              <span className={styles.patientColor}>Patient</span>. Each{" "}
              <span className={styles.patientColor}>Patient</span> can have one
              or more derived <span className={styles.modelColor}>Models</span>.
            </div>
            <div className={styles.colParagraph}>
              CRISPR and sequencing data are generated from a{" "}
              <span className={styles.modelConditionColor}>
                Model Condition
              </span>
              . Each <span className={styles.screenColor}>CRISPR Screen</span>{" "}
              receives a Screen ID. Each sequencing datatype (e.g. wgs, rna,
              wes, etc.) receives an{" "}
              <span className={styles.profileColor}>Omics Profile</span> ID.
              Non-release Omics datasets (OLINK, ATAC-Seq) also receive an{" "}
              <span className={styles.profileColor}>Omics Profile</span> ID, but
              are not considered part of the bi-annual DepMap Release Dataset.
            </div>
            <div className={styles.colParagraph}>
              Although data is generated from{" "}
              <span className={styles.modelConditionColor}>
                Model Condition
              </span>
              , DepMap Release data are indexed at two principal levels:{" "}
              <span className={styles.modelColor}>Models</span> and{" "}
              <span className={styles.screenColor}>Screens</span>/
              <span className={styles.profileColor}>Profiles</span>.
            </div>
          </div>
          <div className={styles.imageContainer}>{dataStructureImage}</div>
        </div>
      </Accordion>
    </div>
  );
};

export default DataStructureSection;
