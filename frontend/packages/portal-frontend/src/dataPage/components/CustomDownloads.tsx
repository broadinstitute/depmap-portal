import { legacyPortalAPI } from "@depmap/api";
import { DownloadTableData } from "@depmap/data-slicer";
import React from "react";
import DataSlicer from "src/dataSlicer/components/DataSlicer";

import styles from "src/dataPage/styles/DataPage.scss";

interface CustomDownloadsProps {
  allDownloads: DownloadTableData;
}
const CustomDownloads = ({ allDownloads }: CustomDownloadsProps) => {
  return (
    <div className={styles.customDownloads}>
      <DataSlicer
        getMorpheusUrl={legacyPortalAPI.getMorpheusUrl}
        getCitationUrl={legacyPortalAPI.getCitationUrl}
        getMutationTableCitation={legacyPortalAPI.getMutationTableCitation}
        getDatasetsDownloadMetadata={
          legacyPortalAPI.getDatasetsDownloadMetadata
        }
        exportMutationTable={legacyPortalAPI.exportMutationTable}
        exportData={legacyPortalAPI.exportData}
        exportDataForMerge={legacyPortalAPI.exportDataForMerge}
        getTaskStatus={legacyPortalAPI.getTaskStatus}
        validateFeatures={legacyPortalAPI.validateFeaturesInDataset}
        fileInformation={allDownloads}
      />
    </div>
  );
};

export default CustomDownloads;
