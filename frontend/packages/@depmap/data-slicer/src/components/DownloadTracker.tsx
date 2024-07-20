/* eslint-disable */
import React from "react";

import { CeleryTask } from "@depmap/compute";
import { ProgressTracker } from "@depmap/common-components";

interface Props {
  getMorpheusUrl?: (downloadUrls: string) => Promise<string>;
  citationUrls: (string | null)[];
  datasetDisplayNames: string[];
  getTaskStatus: (taskId: string) => Promise<CeleryTask>;
  submissionResponse: Promise<CeleryTask>;
  isMorpheusEnabled: Boolean;
}
interface State {
  downloadUrl: string;
  morpheusUrl: string;
  citationUrls: string[];
}
interface DataSlicerResult {
  downloadUrl: string;
}

export default class DownloadTracker extends React.Component<
  Props,
  Partial<State>
> {
  static defaultProps: Partial<Props> = {
    getMorpheusUrl: undefined,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      downloadUrl: "",
      morpheusUrl: "",
      citationUrls: [""],
    };
  }

  onResultsComplete = (response: DataSlicerResult) => {
    let { downloadUrl } = response;
    const { getMorpheusUrl, citationUrls } = this.props;
    // if used in Elara behind Depmap proxy, assign url prefix
    if (window.location.pathname.includes("/breadbox/elara")) {
      const urlPrefix = window.location.pathname.replace(/\/elara\/.*$/, "");
      downloadUrl = urlPrefix.concat(downloadUrl);
    }
    window.location.assign(downloadUrl);
    const newState: any = {};
    newState.downloadUrl = downloadUrl;
    const promisesToKeep: Map<string, Promise<any>> = new Map<
      string,
      Promise<any>
    >();
    if (getMorpheusUrl) {
      promisesToKeep.set("morpheusUrl", getMorpheusUrl(downloadUrl));
    }
    if (citationUrls) {
      newState.citationUrls = citationUrls;
    }
    Promise.all(Array.from(promisesToKeep.values())).then((values) => {
      const keys = Array.from(promisesToKeep.keys());
      values.forEach((value, index) => {
        newState[keys[index]] = value;
      });
      this.setState(newState);
    });
  };

  render() {
    const { citationUrls, downloadUrl, morpheusUrl } = this.state;
    const mergedDatasetDownload = citationUrls && citationUrls.length > 1;

    const {
      submissionResponse,
      getTaskStatus,
      datasetDisplayNames,
      isMorpheusEnabled,
    } = this.props;
    return (
      <div style={{ display: "flex", alignItems: "center", marginTop: "5px" }}>
        <ProgressTracker
          submissionResponse={submissionResponse}
          onSuccess={(response) => {
            this.onResultsComplete(response.result);
          }}
          onFailure={() => {
            console.log("oops failure");
          }}
          getTaskStatus={getTaskStatus}
        />
        {downloadUrl && (
          <div>
            <div
              style={{
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: mergedDatasetDownload ? "nowrap" : "normal",
                paddingLeft: "20px",
              }}
            >
              <a href={downloadUrl} download>
                {mergedDatasetDownload
                  ? "Merged Download File"
                  : datasetDisplayNames[0]}
              </a>
            </div>
            {isMorpheusEnabled && morpheusUrl && (
              <a
                style={{ paddingLeft: "20px" }}
                href={morpheusUrl}
                target="_blank"
                rel="noreferrer"
              >
                View in Morpheus
              </a>
            )}
            {!mergedDatasetDownload &&
              citationUrls &&
              citationUrls.map((url) =>
                url ? (
                  <a
                    key={url}
                    style={{ paddingLeft: "20px" }}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Citation
                  </a>
                ) : null
              )}
            {mergedDatasetDownload &&
              citationUrls &&
              citationUrls.map((url, index) =>
                url ? (
                  <div
                    key={url}
                    style={{
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      paddingLeft: "20px",
                    }}
                  >
                    <a href={url} target="_blank" rel="noreferrer">
                      Citation: {datasetDisplayNames[index]}
                    </a>
                  </div>
                ) : null
              )}
          </div>
        )}
      </div>
    );
  }
}
