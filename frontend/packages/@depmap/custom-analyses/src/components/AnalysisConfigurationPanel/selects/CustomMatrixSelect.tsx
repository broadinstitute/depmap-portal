import React, { useEffect, useState } from "react";
import { Alert } from "react-bootstrap";
import { breadboxAPI, cached } from "@depmap/api";
import { FileUpload } from "@depmap/compute";
import {
  getDimensionTypeLabel,
  pluralize,
  uncapitalize,
} from "@depmap/data-explorer-2";
import { ErrorTypeError } from "@depmap/types";
import { UploadTask } from "@depmap/user-upload";
import styles from "../../../styles/CustomAnalysesPage.scss";

interface Props {
  format: "matrix" | "slice";
  index_type: string;
  value: string | undefined;
  onChange: (
    datasetId: string | undefined,
    filename: string | undefined
  ) => void;
  filename?: string;
}

function CustomMatrixSelect({
  format,
  index_type,
  value,
  onChange,
  filename = undefined,
}: Props) {
  const [uploadState, setUploadState] = useState({
    datasetId: "",
    messageWarning: "",
    messageDetail: "",
    isLoading: false,
  });

  const handleUploadResponse = (uploadTask: UploadTask) => {
    let datasetId = "";
    let messageWarning = "";
    const messageDetail = "";
    let datasetName;

    if (uploadTask.state === "SUCCESS") {
      const { result } = uploadTask;
      datasetId = result.datasetId;
      datasetName = result.dataset.name;

      if (result.warnings.length > 0) {
        messageWarning = result.warnings.join("\n");
      }
    } else if (uploadTask.state === "FAILURE") {
      messageWarning = `Error: ${uploadTask.message}`;
    }

    onChange(datasetId || undefined, datasetName);

    setUploadState({
      datasetId,
      messageWarning,
      messageDetail,
      isLoading: false,
    });
  };

  const handleFileChange = (uploadFile: File) => {
    if (!uploadFile || uploadFile.name === "") {
      setUploadState({
        datasetId: "",
        messageWarning: "",
        messageDetail: "",
        isLoading: false,
      });
      return;
    }

    if (uploadFile.size > 10000000) {
      setUploadState({
        datasetId: "",
        messageWarning: "File is too large, max size is 10MB",
        messageDetail: "",
        isLoading: false,
      });
      return;
    }

    setUploadState((prev) => ({ ...prev, isLoading: true }));

    if (format === "matrix") {
      breadboxAPI
        .postCustomCsv({
          uploadFile,
          displayName: uploadFile.name,
          units: "",
          transposed: true,
        })
        .then(handleUploadResponse);
    } else {
      breadboxAPI
        .postCustomCsvOneRow({ uploadFile })
        .then(handleUploadResponse);
    }
  };

  const [datasetDisplayName, setDatasetDisplayName] = useState("");
  const [isExpiredDataset, setIsExpiredDataset] = useState(false);
  const [otherError, setOtherError] = useState(false);

  useEffect(() => {
    (async () => {
      if (value) {
        try {
          const dataset = await cached(breadboxAPI).getDataset(value);
          setDatasetDisplayName(dataset.name);
        } catch (e) {
          if (
            e instanceof ErrorTypeError &&
            e.errorType === "DATASET_NOT_FOUND"
          ) {
            setIsExpiredDataset(true);
          } else {
            setOtherError(true);
          }
        }
      } else {
        setIsExpiredDataset(false);
        setOtherError(false);
        setDatasetDisplayName("");
      }
    })();
  }, [value]);

  if (otherError) {
    return <div>Error</div>;
  }

  if (value && !datasetDisplayName && !isExpiredDataset) {
    return <div>Loading...</div>;
  }

  if (datasetDisplayName) {
    return (
      <Alert
        className={styles.datasetDisplayName}
        onDismiss={() => onChange(undefined, undefined)}
        closeLabel="clear"
      >
        {datasetDisplayName}
      </Alert>
    );
  }

  const entity = getDimensionTypeLabel(index_type);
  const entities = uncapitalize(pluralize(entity));
  let callToAction = <p>Upload a matrix as a csv, where {entities} are rows</p>;

  if (format === "slice") {
    callToAction = (
      <div style={{ marginBottom: "20px" }}>
        <div style={{ paddingRight: "10px" }}>
          Upload a csv with the format:
        </div>
        <table className="custom_csv_example_table">
          <tbody>
            <tr>
              <td>{entity} 1</td>
              <td>0.5</td>
            </tr>
            <tr>
              <td>{entity} 2</td>
              <td>0.5</td>
            </tr>
            <tr>
              <td>{entity} 3</td>
              <td>0.5</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (isExpiredDataset) {
    callToAction = (
      <Alert bsStyle="warning">
        ⚠️ This analysis used a temporary uploaded dataset that is no longer
        available.
        <br />
        Please re-upload {filename ? <code>{filename}</code> : null} to
        continue.
      </Alert>
    );
  }

  return (
    <div>
      {callToAction}
      <FileUpload onChange={handleFileChange} />
      {uploadState.isLoading && <span className="Select-loading" />}
      <div className="has-error">{uploadState.messageWarning || ""}</div>
      <div>{uploadState.messageDetail || ""}</div>
    </div>
  );
}

export default CustomMatrixSelect;
