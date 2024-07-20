import {
  DownloadTableData,
  ExportDataQuery,
  ExportMergedDataQuery,
  ExportMutationTableQuery,
  FeatureValidationQuery,
} from "@depmap/data-slicer";
import React from "react";
import { getDapi } from "src/common/utilities/context";
import DataSlicer from "src/dataSlicer/components/DataSlicer";

import styles from "src/dataPage/styles/DataPage.scss";

interface CustomDownloadsProps {
  allDownloads: DownloadTableData;
}
const CustomDownloads = ({ allDownloads }: CustomDownloadsProps) => {
  return (
    <div className={styles.customDownloads}>
      <DataSlicer
        getMorpheusUrl={(csvUrl: string) => getDapi().getMorpheusUrl(csvUrl)}
        getCitationUrl={(datasetId: string) => {
          return getDapi().getCitationUrl(datasetId);
        }}
        getMutationTableCitation={() => {
          return getDapi().getMutationTableCitation();
        }}
        getDatasetsList={() => getDapi().getDatasetsList()}
        exportMutationTable={(query: ExportMutationTableQuery) =>
          getDapi().exportMutationTable(query)
        }
        exportData={(query: ExportDataQuery) => getDapi().exportData(query)}
        exportDataForMerge={(query: ExportMergedDataQuery) =>
          getDapi().exportDataForMerge(query)
        }
        getTaskStatus={(taskId: string) => getDapi().getTaskStatus(taskId)}
        validateFeatures={(query: FeatureValidationQuery) =>
          getDapi().validateFeaturesInDataset(query)
        }
        fileInformation={allDownloads}
        dapi={getDapi()}
      />
    </div>
  );
};

export default CustomDownloads;
