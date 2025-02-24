/* eslint-disable jsx-a11y/control-has-associated-label */
import * as React from "react";
import { FormControl, HelpBlock, ProgressBar } from "react-bootstrap";
import { useState } from "react";
import { UploadFileResponse } from "@depmap/types";
import * as SparkMD5 from "spark-md5";

import styles from "../styles/ChunkedFileUploader.scss";

interface ChunkedFileUploaderProps {
  uploadFile: (fileArgs: { file: File | Blob }) => Promise<UploadFileResponse>;
  forwardFileIdsAndHash: (fileIds: Array<string>, hash: string | null) => void;
}

export default function ChunkedFileUploader({
  uploadFile,
  forwardFileIdsAndHash,
}: ChunkedFileUploaderProps) {
  const [selectedFileUpload, setSelectedFileUpload] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [uploadSuccessful, setUploadSuccessful] = useState<boolean>(true);

  const FormattingHelp = () => {
    return (
      <div>
        <div>
          Upload a dataset CSV file with <i>samples</i> and/or <i>features</i>.
          See below examples for more details.
        </div>

        <details>
          <summary>Formatting Examples</summary>
          <div>
            <b>
              Matrix Dataset <i>(DEFAULT)</i>
            </b>
            <p>
              Samples (e.g. depmap models with &apos;depmap_id&apos; as their
              identifiers) are row headers and features (e.g. genes with
              &apos;entrez_id&apos; as their identifiers) are column headers
            </p>
          </div>
          <table className={styles.uploadExampleTable}>
            <thead>
              <tr>
                <th />
                <th>6663</th>
                <th>4893</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ACH-00001</td>
                <td>0.05</td>
                <td>0.34</td>
              </tr>
              <tr>
                <td>ACH-00002</td>
                <td>0.4</td>
                <td>NA</td>
              </tr>
            </tbody>
          </table>

          <div>Which in CSV format would be:</div>
          <pre>
            <div>,6663,4893</div>
            <div>ACH-00001,0.05,0.34</div>
            <div>ACH-00002,0.4,</div>
          </pre>

          <div>
            <b>Tabular Dataset</b>
            <p>
              Samples or features as row headers and additional metadata are
              columns.
            </p>
          </div>
          <table className={styles.uploadExampleTable}>
            <thead>
              <tr>
                <th>entrez_id</th>
                <th>symbol</th>
                <th>status</th>
                <th>other metadata</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>6663</td>
                <td>SOX10</td>
                <td>Yes</td>
                <td>NA</td>
              </tr>
              <tr>
                <td>4839</td>
                <td>NRAS</td>
                <td>No</td>
                <td>123</td>
              </tr>
            </tbody>
          </table>
          <pre>
            <div>entrez_id,symbol,status,other metadata</div>
            <div>6663,SOX10,Yes,</div>
            <div>4839,NRAS,No,123</div>
          </pre>
        </details>
      </div>
    );
  };

  const chunkedUpload = async (file: File) => {
    const chunkSize = 5 * 1024 * 1024; // Arbitrarily set to 5MB. Adjust if necessary
    const totalChunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    let newFileIds: Array<string> = [];
    // Initialize Spark MD5 Array Buffer to calculate hash
    const sparkBuffer = new SparkMD5.ArrayBuffer();

    // for each filechunk, append to sparkMd5 buffer to update hash and upload file chunk to breadbox
    for (currentChunk = 0; currentChunk < totalChunks; currentChunk++) {
      const start = currentChunk * chunkSize;
      const end =
        start + chunkSize >= file.size ? file.size : start + chunkSize;

      const fileChunk = file.slice(start, end);
      //  Run file upload and reading file chunk into buffer in parallel
      try {
        // eslint-disable-next-line no-await-in-loop
        const [fileChunkBuffer, fileResponse] = await Promise.all([
          fileChunk.arrayBuffer(),
          uploadFile({ file: fileChunk }),
        ]);
        sparkBuffer.append(fileChunkBuffer);
        newFileIds = newFileIds.concat(fileResponse.file_id);
      } catch (error) {
        console.error("File upload encountered an error: ", error);
        setUploadSuccessful(false);
        break; // break for loop if error uploading
      }

      setProgress(
        Math.min(Math.floor(((currentChunk + 1) / totalChunks) * 100), 100)
      ); // 100% max just incase
    }

    // Calculate the final checksum for the file
    const fileHash = sparkBuffer.end();
    forwardFileIdsAndHash(newFileIds, fileHash);
  };

  const handleFileChange = (
    e: React.FormEvent<HTMLInputElement & FormControl>
  ) => {
    setProgress(0);
    setUploadSuccessful(true);
    forwardFileIdsAndHash([], null);
    const target = e.target as HTMLInputElement;
    const fileTarget = target.files?.[0];
    setSelectedFileUpload(fileTarget);

    if (fileTarget) {
      chunkedUpload(fileTarget);
    }
  };

  const getProgressBarText = () => {
    if (progress !== 100) {
      if (uploadSuccessful) {
        return "Loading...";
      }
      return "";
    }
    return "Successful";
  };

  return (
    <div style={{ marginBottom: "10px" }}>
      <HelpBlock>{FormattingHelp()}</HelpBlock>
      <FormControl
        name="file_upload"
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        style={{ width: "100%" }}
      />
      {selectedFileUpload ? (
        <ProgressBar
          now={progress}
          label={`${progress}% ${getProgressBarText()}`}
          striped
          active={progress !== 100 && uploadSuccessful}
          bsStyle={uploadSuccessful ? "success" : "danger"}
          style={{ marginTop: "2px", textAlign: "center" }}
        >
          {!uploadSuccessful && progress === 0 ? "0% Failed!" : ""}
        </ProgressBar>
      ) : (
        <div style={{ paddingBottom: "20px" }} />
      )}
    </div>
  );
}
