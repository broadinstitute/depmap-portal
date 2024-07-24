import { DownloadFile, DownloadTableData, Release } from "@depmap/data-slicer";
import { encodeParams } from "@depmap/utils";
import React from "react";
import styles from "src/dataPage/styles/DataPage.scss";
import { Tooltip } from "@depmap/common-components";
import { CollapsiblePanel } from "../../common/components/CollapsiblePanel";
import { DownloadGlyph } from "@depmap/downloads";

interface DataFilePanelProps {
  data: DownloadTableData;
  termsDefinitions: { [key: string]: string };
  release: Release;
  openPanelOnLoad?: boolean;
  keySuffix?: number;
}

interface SinglePanelHeaderProps {
  file: DownloadFile;
  termsDefinitions?: { [key: string]: string };
}

interface SinglePanelBodyProps {
  file: DownloadFile;
  release?: Release;
}

const stripHtmlTags = (htmlStr: string | null) => {
  if (!htmlStr) {
    return "";
  }
  return htmlStr.replace(/(<([^>]+)>)/gi, "");
};

const CollapsiblePanelHeader = ({
  file,
  termsDefinitions = undefined,
}: SinglePanelHeaderProps) => {
  const handleClickCopyUrlButton = (e: any, downloadFile: DownloadFile) => {
    const url = `${
      window.location.origin + window.location.pathname
    }?${encodeParams({
      tab: "allData",
      releasename: downloadFile.releaseName,
      filename: downloadFile.fileName,
    })}`;

    prompt("", url);

    // Keep the accordion from opening if the user only intended to copy the url.
    e.stopPropagation();
  };

  const description = stripHtmlTags(file.fileDescription);
  return (
    <span className={styles.accordionTitle}>
      <span className={styles.one}>{file.fileName}</span>
      <div className={styles.two}>{description}</div>
      {file.size && <span className={styles.three}>{file.size}</span>}
      <span className={styles.four}>
        <div className={styles.iconsContainer}>
          {" "}
          <Tooltip
            id="download-file-tooltip"
            content="Download file"
            placement="bottom"
          >
            <div style={{ gridColumn: "1" }}>
              <DownloadGlyph
                terms={file.terms}
                downloadUrl={file.downloadUrl ?? file.taigaUrl}
                termsDefinitions={termsDefinitions!}
                isDownloadModal
              />
            </div>
          </Tooltip>
          <div style={{ gridColumn: "2" }}>
            <Tooltip
              id="get-file-url-tooltip"
              content="Get file url"
              placement="bottom"
            >
              <button
                className="copy-url"
                onClick={(e) => handleClickCopyUrlButton(e, file)}
                type="button"
                style={{ border: "none", background: "none", fontSize: "20px" }}
              >
                {" "}
                <i className={`glyphicon glyphicon-copy`} />{" "}
              </button>
            </Tooltip>
          </div>
        </div>
      </span>
    </span>
  );
};

const CollapsiblePanelBody = ({
  file,
  release = undefined,
}: SinglePanelBodyProps) => {
  return (
    <div className={styles.accordionBodyContent}>
      <hr />
      <br />
      <div className={styles.releaseLabel}>{file.releaseName}</div>

      <br />
      <div className={styles.collapsiblePanelSubHeader}>Description</div>
      <div
        className={styles.collapsiblePanelBodySection}
        dangerouslySetInnerHTML={{
          __html: file.fileDescription || "",
        }}
      />
      {file.sources.length > 0 && (
        <>
          <div className={styles.collapsiblePanelSubHeader}>Sources</div>
          <div className={styles.collapsiblePanelBodySection}>
            {file.sources.map((source) => (
              <div key={source}>{source}</div>
            ))}
          </div>
        </>
      )}
      {release && release.citation && (
        <>
          <div className={styles.collapsiblePanelSubHeader}>
            Release Citation
          </div>
          <div
            className={styles.collapsiblePanelBodySection}
            dangerouslySetInnerHTML={{
              __html: release.citation || "",
            }}
          />
        </>
      )}
      {release && release.funding && (
        <>
          <div className={styles.collapsiblePanelSubHeader}>Funding</div>
          <div className={styles.collapsiblePanelBodySection}>
            {release.funding}
          </div>
        </>
      )}
    </div>
  );
};

const DataFilePanel = ({
  data,
  termsDefinitions,
  release,
  openPanelOnLoad = false,
  keySuffix = 1,
}: DataFilePanelProps) => {
  const primaryFiles = data.filter((dataFile) => dataFile.isMainFile === true);

  const supplementalFiles = data.filter(
    (dataFile) => dataFile.isMainFile === false
  );

  const primaryFilesHaveSize =
    primaryFiles.filter((dataFile) => dataFile.size).length > 0;

  const supplementalFilesHaveSize =
    supplementalFiles.filter((dataFile) => dataFile.size).length > 0;

  return (
    <div className={styles.DataFilePanel}>
      {primaryFiles.length > 0 && (
        <div className={styles.dataPanelSection}>
          <h3>Primary Files</h3>
          <div className={styles.filePanelHeader}>
            <div className={styles.headerColOne}>NAME</div>
            <div className={styles.headerColTwo}>DESCRIPTION</div>
            {primaryFilesHaveSize && (
              <div className={styles.headerColThree}>SIZE</div>
            )}
            <div className={styles.headerColFour}>ACTIONS</div>
          </div>
          <div className="collapsible-panel-list">
            {primaryFiles.map((file: DownloadFile) => (
              <CollapsiblePanel
                headerContent={
                  <CollapsiblePanelHeader
                    file={file}
                    termsDefinitions={termsDefinitions}
                  />
                }
                bodyContent={
                  <CollapsiblePanelBody file={file} release={release} />
                }
                key={file.releaseName + file.fileName}
                openPanelOnLoad={openPanelOnLoad}
                keyPrefix={file.releaseName + file.fileName}
                keySuffix={keySuffix}
              />
            ))}
          </div>
        </div>
      )}
      {supplementalFiles.length > 0 && (
        <div className={styles.dataPanelSection}>
          <h3>Supplemental Files</h3>
          <div className={styles.filePanelHeader}>
            <div className={styles.headerColOne}>NAME</div>
            <div className={styles.headerColTwo}>DESCRIPTION</div>
            {supplementalFilesHaveSize && (
              <div className={styles.headerColThree}>SIZE</div>
            )}
            <div className={styles.headerColFour}>ACTIONS</div>
          </div>
          <div>
            {supplementalFiles.map((file: DownloadFile) => (
              <CollapsiblePanel
                headerContent={
                  <CollapsiblePanelHeader
                    file={file}
                    termsDefinitions={termsDefinitions}
                  />
                }
                bodyContent={
                  <CollapsiblePanelBody file={file} release={release} />
                }
                key={file.releaseName + file.fileName}
                openPanelOnLoad={openPanelOnLoad}
                keyPrefix={file.releaseName + file.fileName}
                keySuffix={keySuffix}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataFilePanel;
