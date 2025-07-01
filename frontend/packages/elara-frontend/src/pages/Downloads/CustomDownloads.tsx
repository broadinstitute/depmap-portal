import React, { useEffect, useState, useContext } from "react";
import { Dataset } from "@depmap/types";

import { Spinner } from "@depmap/common-components";
import styles from "src/pages/Downloads/styles.scss";

import {
  ExportDataQuery,
  ExportMergedDataQuery,
  FeatureValidationQuery,
} from "@depmap/data-slicer";
import ElaraDataSlicer from "./ElaraDataSlicer";
import { ApiContext } from "@depmap/api";

export default function CustomDownloads() {
  const apiContext = useContext(ApiContext);
  const bbapi = apiContext.getApi();
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);

  const [initError, setInitError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fetchedDatasets = await bbapi.getBreadboxDatasets();
        setDatasets(fetchedDatasets);
      } catch (e) {
        window.console.error(e);
        setInitError(true);
      }
    })();
  }, [bbapi]);

  if (!datasets) {
    return initError ? (
      <div className={styles.container}>
        Sorry, there was an error fetching datasets for download.
      </div>
    ) : (
      <Spinner />
    );
  }

  const titleLabel = "Custom downloads";
  const headerStyle = {
    paddingBottom: "20px",
    margin: "0px",
  };
  const title = (
    <div className="title_div">
      <h1 className="inline-block" style={headerStyle}>
        {titleLabel}
      </h1>
      <p style={{ maxWidth: "75ch" }}>
        Only download what you need! Custom Downloads lets you create data files
        that subsets any of the available datasets in the Elara using your list
        of features or cell lines of interest.
      </p>
    </div>
  );

  return (
    <div
      style={{
        paddingLeft: "15px",
        paddingRight: "15px",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <div>
        <div>
          <br />
          {title}

          <br />
          <div>
            <ElaraDataSlicer
              getDatasetsList={() => bbapi.getDatasetsList()}
              exportData={(query: ExportDataQuery) => bbapi.exportData(query)}
              exportDataForMerge={(query: ExportMergedDataQuery) =>
                bbapi.exportDataForMerge(query)
              }
              getTaskStatus={(taskId: string) => bbapi.getTaskStatus(taskId)}
              validateFeatures={(query: FeatureValidationQuery) =>
                bbapi.validateFeaturesInDataset(query)
              }
            />
          </div>
          <br />
        </div>
      </div>
    </div>
  );
}
