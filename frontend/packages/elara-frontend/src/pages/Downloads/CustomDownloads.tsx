import React from "react";
import { breadboxAPI } from "@depmap/api";
import ElaraDataSlicer from "./ElaraDataSlicer";

export default function CustomDownloads() {
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
              exportData={breadboxAPI.exportData}
              exportDataForMerge={breadboxAPI.exportDataForMerge}
              getTaskStatus={breadboxAPI.getTaskStatus}
              validateFeatures={breadboxAPI.validateFeaturesInDataset}
            />
          </div>
          <br />
        </div>
      </div>
    </div>
  );
}
