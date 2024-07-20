import * as React from "react";
import { enabledFeatures } from "@depmap/globals";
import { titleCase } from "@depmap/utils";
import { DownloadFile, Release } from "@depmap/data-slicer";
import { DownloadGlyph } from "./DownloadGlyph";

export interface FileModalProps {
  file: DownloadFile;
  release: Release;
  termsDefinitions: { [key: string]: string };
}

export class FileCard extends React.Component<FileModalProps> {
  renderAsModalContent(
    fileDescriptionElement: React.ReactNode,
    retractionOverrideElement: React.ReactNode,
    countsElement: React.ReactNode,
    fileDownloadElement: React.ReactNode,
    versionSourceElement: React.ReactNode
  ) {
    const { release, file } = this.props;

    return (
      <div className="dataset_modal_content_container">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexBasis: 0,
            flexGrow: 2,
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          <div>
            <h5>
              From <span>{release.releaseName}</span>
            </h5>
          </div>
          {file.retractionOverride && <div>{retractionOverrideElement}</div>}
          {!file.retractionOverride && (
            <div>
              {file.fileDescription && (
                <div>
                  <div
                    style={{
                      marginBottom: "5px",
                    }}
                  >
                    {fileDescriptionElement}
                  </div>
                  <br />
                </div>
              )}
            </div>
          )}
          <br />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexBasis: 0,
            flexGrow: 1,
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          <div
            style={{
              marginTop: "55px",
              marginLeft: "15px",
              marginRight: "15px",
            }}
          >
            {!file.retractionOverride && file.summaryStats && (
              <strong>{countsElement}</strong>
            )}
            {
              fileDownloadElement
              // we keep this even when retracting because it is either the taiga link of RetractedUrl. The former is good to show skyros, and the latter is fine because it has no download.
            }
            {versionSourceElement}
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { file, termsDefinitions } = this.props;

    const countsElement: JSX.Element = (
      <div style={{ paddingTop: "10px" }}>
        {file.summaryStats &&
          file.summaryStats.map((stat) => (
            <div key={stat.label}>
              <span>{titleCase(stat.label)}: </span>
              <span style={{ float: "right", paddingLeft: "55px" }}>
                {stat.value}
              </span>
            </div>
          ))}
      </div>
    );

    const fileDescriptionElement: JSX.Element = (
      <div>
        {file.fileDescription && (
          <>
            <h2 style={{ color: "#337ab7" }}>
              {file.fileName}
              <span style={{ fontSize: 32 }}>
                {" "}
                {file.downloadUrl && (
                  <DownloadGlyph
                    terms={file.terms}
                    downloadUrl={file.downloadUrl}
                    termsDefinitions={termsDefinitions}
                    isDownloadModal
                  />
                )}
              </span>
            </h2>
            {/* eslint-disable-next-line react/no-danger */}
            <div dangerouslySetInnerHTML={{ __html: file.fileDescription }} />
          </>
        )}
      </div>
    );

    const fileDownloadElement: JSX.Element = (
      <div>
        {file.taigaUrl && enabledFeatures.use_taiga_urls_downloads_page && (
          <div>
            View in{" "}
            <a href={file.taigaUrl} target="_blank" rel="noreferrer">
              Taiga
            </a>
          </div>
        )}
      </div>
    );

    const retractionOverrideElement: JSX.Element = (
      <div>
        <div className="highlight-color card_subheading">
          <strong>Retracted Dataset</strong>
        </div>
        {/* eslint-disable-next-line react/no-danger */}
        <div dangerouslySetInnerHTML={{ __html: file.retractionOverride }} />
      </div>
    );

    const versionSourceElement: JSX.Element = (
      <div>
        {/* {this.props.version && <div>Version: {this.props.version} </div>}
          {this.props.nextRelease && (
            <div>Next Tentative Release: {this.props.nextRelease} </div>
          )} */}
        Source: <strong>{file.sources.join(", ")}</strong>
      </div>
    );

    return this.renderAsModalContent(
      fileDescriptionElement,
      retractionOverrideElement,
      countsElement,
      fileDownloadElement,
      versionSourceElement
    );
  }
}
