/* eslint-disable */
import * as React from "react";
import Select from "react-select";
import { Radio } from "react-bootstrap";
import update from "immutability-helper";

import { SelectNSOption } from "../models/compute";
import { UploadTask } from "@depmap/user-upload";
import { FileUpload } from "@depmap/compute";
import { ApiContext } from "@depmap/api";

import "../styles/DatasetSelect.scss";

export interface Dataset {
  label: string;
  value: string;
}

type selectDatasetInputType = "dropdowns" | "upload";

class DatasetSelectProps {
  label?: string;

  datasets?: Array<Dataset>;

  onChange?: (newValue: string) => any;
}

interface DatasetSelectState {
  inputType: selectDatasetInputType;
  dropdownDataset: SelectNSOption;
  uploadDataset?: {
    datasetId: string;
    messageWarning: string;
    messageDetail: string;
    isLoading: boolean;
  };
}

export class DatasetSelect extends React.Component<
  DatasetSelectProps,
  DatasetSelectState
> {
  declare context: React.ContextType<typeof ApiContext>;
  static contextType = ApiContext;

  constructor(props: DatasetSelectProps) {
    super(props);

    this.state = {
      inputType: "dropdowns",
      dropdownDataset: {
        label: "",
        value: "",
      },
      uploadDataset: {
        datasetId: "",
        messageWarning: "",
        messageDetail: "",
        isLoading: false,
      },
    };
  }

  handleUploadResponse = (uploadTask: UploadTask) => {
    let datasetId = "";
    let messageWarning = "";
    const messageDetail = "";

    if (uploadTask.state == "SUCCESS") {
      const { result } = uploadTask;
      datasetId = result.datasetId;

      if (result.warnings.length > 0) {
        messageWarning = result.warnings.join("\n");
      }
      this.props.onChange?.(uploadTask.result.datasetId);
    } else if (uploadTask.state == "FAILURE") {
      messageWarning = `Error: ${uploadTask.message}`;
      this.props.onChange?.("");
    }

    this.setState({
      uploadDataset: update(this.state.uploadDataset, {
        datasetId: { $set: datasetId },
        messageWarning: {
          $set: messageWarning,
        },
        messageDetail: { $set: messageDetail },
        isLoading: { $set: false },
      }),
    });
  };

  uploadOnChange = (uploadFile: File) => {
    if (!uploadFile || uploadFile.name == "") {
      this.setState({
        uploadDataset: update(this.state.uploadDataset, {
          datasetId: { $set: "" },
          messageWarning: { $set: "" },
          messageDetail: { $set: "" },
        }),
      });
      this.props.onChange?.("");
      return;
    }
    if (uploadFile.size > 10000000) {
      // front end size limit for vector
      // this is needed because oauth reads the entire request body into memory
      this.setState({
        uploadDataset: update(this.state.uploadDataset, {
          datasetId: { $set: "" },
          messageWarning: { $set: "File is too large, max size is 10MB" },
          messageDetail: { $set: "" },
        }),
      });
      return;
    }

    const { getApi } = this.context;

    this.setState(
      {
        uploadDataset: update(this.state.uploadDataset, {
          isLoading: { $set: true },
        }),
      },
      () =>
        getApi()
          .postCustomCsv({
            uploadFile,
            displayName: uploadFile.name,
            units: "",
            transposed: true,
          })
          .then(this.handleUploadResponse)
    );
  };

  render() {
    const example = "Upload a matrix as a csv, where cell lines are rows";
    return (
      <div>
        <strong>{this.props.label}</strong>
        <div>
          <Radio
            name="selectDatasetInputType"
            checked={this.state.inputType === "dropdowns"}
            onChange={() => {
              this.setState({ inputType: "dropdowns" });
              this.props.onChange?.(this.state.dropdownDataset.value);
            }}
          >
            Portal data
          </Radio>
          {this.state.inputType == "dropdowns" && (
            <div style={{ marginLeft: "20px" }}>
              <Select
                name="selected-state"
                value={
                  this.state.dropdownDataset.value
                    ? this.state.dropdownDataset
                    : null /* this prop is type SelectNSOption. it seems to work if its just value, but select react types wants it as SelectNSOption */
                }
                options={this.props.datasets}
                onChange={(newValue: any) => {
                  this.setState({ dropdownDataset: newValue });
                  this.props.onChange?.(newValue.value);
                }}
                placeholder="Select dataset..."
              />
            </div>
          )}
          <Radio
            name="selectDatasetInputType"
            checked={this.state.inputType === "upload"}
            onChange={() => {
              this.setState({ inputType: "upload" });
              if (this.state.uploadDataset) {
                this.props.onChange?.(this.state.uploadDataset.datasetId);
              }
            }}
          >
            Custom upload
          </Radio>
        </div>
        {this.state.inputType == "upload" && (
          <div style={{ marginLeft: "20px" }}>
            <div>
              {example}
              <FileUpload onChange={this.uploadOnChange} />
              {this.state.uploadDataset?.isLoading && (
                <span className="Select-loading" />
              )}

              <div className="has-error">
                {this.state.uploadDataset?.messageWarning || ""}
              </div>
              <div>{this.state.uploadDataset?.messageDetail || ""}</div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
