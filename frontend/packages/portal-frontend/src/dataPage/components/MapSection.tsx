import { Accordion } from "@depmap/common-components";
import React from "react";
import { toStaticUrl } from "@depmap/globals";

import styles from "src/dataPage/styles/DataPage.scss";

const MapSection = () => {
  const mapImage = (
    <img
      style={{ maxWidth: "700px", width: "100%" }}
      src={toStaticUrl("img/data_page/mapping_guide_v2.png")}
      alt="Diagram of how to map data"
    />
  );

  return (
    <div id={"map-section"}>
      <Accordion
        key="mapping-section-accordion"
        openCloseSymbolStyle={{
          float: "left",
          marginRight: "20px",
          marginTop: "14px",
          position: "relative",
          lineHeight: "unset",
          fontSize: "24px",
        }}
        title={<h1>How can I map DepMap Release files?</h1>}
      >
        <div className={styles.mapBody}>
          <div className={styles.mapColumns}>
            <div className={styles.colParagraph}>
              Model.csv can be used to map cell line metadata (such as lineage),
              using Model ID (ACH-xxxxxx).
            </div>
            <div className={styles.colParagraph}>
              Growth condition metadata (such as growth media, drug, etc…) can
              be mapped using ModelCondition.csv in cases where a Model
              Condition ID (MC-xxxxxx-yyyy) is provided. All CRISPR data files
              with the prefix &quot;Screen&quot; are indexed by Screen ID
              (SC-xxxxxx-xxyy). Mappings from Screen ID to Model ID (ACH-xxxxxx)
              and Model Condition ID (MC-xxxxxx-yyyy) can be found in
              ScreenSequenceMap.csv.
            </div>

            <div className={styles.colParagraph}>
              Data files with the prefix &quot;CRISPR&quot; collapse screens
              performed in the same basal Model. To see which screens are
              combined in these files, refer to CRISPRSceenMap.csv.
            </div>
            <div className={styles.colParagraph}>
              Each omics data file contains the following ID columns: ModelID,
              ModelConditionID, IsDefaultEntryModel, and IsDefaultEntryMC. Each
              model and model condition have a representative sequencing output,
              identified by the flags &quot;IsDefaultEntryForModel&quot; and
              &quot;IsDefaultEntryForMC&quot;. SequencingID (CDS-) is an
              internal identifier, which is available to use if needed.
            </div>
            <div className={styles.colParagraph}>
              To identify which sequencing output represents each Model, filter
              the file by &quot;IsDefaultEntryForModel == Yes&quot;; To identify
              which sequencing output represents each ModelCondition, filter by
              &quot;IsDefaultEntryForMC == Yes&quot;. For a complete set of
              omics metadata and ID mappings, please refer to OmicsProfiles.csv.
            </div>
          </div>
          <div className={styles.imageContainer}>{mapImage}</div>
        </div>
      </Accordion>
    </div>
  );
};

export default MapSection;
