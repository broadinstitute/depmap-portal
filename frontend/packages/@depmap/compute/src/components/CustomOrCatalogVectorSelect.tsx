import React from "react";
import { Radio } from "react-bootstrap";
import {
  convertDimensionToSliceId,
  DimensionSelect,
  DimensionSelectV2,
  isCompleteDimension,
} from "@depmap/data-explorer-2";
import { enabledFeatures } from "@depmap/globals";
import { Link } from "../models/legacy";
import {
  DataExplorerPlotConfigDimension,
  DataExplorerPlotConfigDimensionV2,
} from "@depmap/types";
import { UploadTask } from "@depmap/user-upload";
import { ApiContext } from "@depmap/api";
import { FileUpload } from "./FileUpload";
import uniqueId from "lodash.uniqueid";

import "../styles/CustomOrCatalogVectorSelect.scss";

type vectorSelectInputType = "catalog" | "custom";

interface CustomOrCatalogVectorSelectProps {
  onChange: (queryVectorId?: string, labels?: Link[]) => void;
}

interface CustomOrCatalogVectorSelectState {
  inputType: vectorSelectInputType;
  messageWarning: string;
  messageDetail: string;
  isLoading: boolean;
  selectedDimension: Partial<
    DataExplorerPlotConfigDimension | DataExplorerPlotConfigDimensionV2
  > | null;
}

export class CustomOrCatalogVectorSelect extends React.Component<
  CustomOrCatalogVectorSelectProps,
  CustomOrCatalogVectorSelectState
> {
  declare context: React.ContextType<typeof ApiContext>;

  static contextType = ApiContext;

  private radioName = `vectorSelectInputType-${uniqueId()}`;

  constructor(props: CustomOrCatalogVectorSelectProps) {
    super(props);

    this.state = {
      inputType: "catalog",
      messageWarning: "",
      messageDetail: "",
      isLoading: false,
      selectedDimension: null,
    };
  }

  renderVectorCatalog = () => {
    const onChangeDimension = (dimension: any) => {
      this.setState({ selectedDimension: dimension });

      if (isCompleteDimension(dimension)) {
        const sliceId = convertDimensionToSliceId(dimension);

        const simulatedVectorCatalogSelections = [
          dimension.slice_type,

          dimension.slice_type === "gene"
            ? dimension.context.name
            : dimension.dataset_id,

          dimension.slice_type === "gene"
            ? dimension.dataset_id
            : dimension.context.name,
        ].map((value) => ({ value, link: "", label: "" }));

        this.props.onChange(
          sliceId as string,
          simulatedVectorCatalogSelections
        );
      } else {
        this.props.onChange("");
      }
    };

    if (enabledFeatures.elara) {
      return (
        <DimensionSelectV2
          mode="entity-only"
          index_type="depmap_model"
          valueTypes={DimensionSelectV2.CONTINUOUS_ONLY}
          value={
            this.state.selectedDimension as DataExplorerPlotConfigDimensionV2
          }
          onChange={onChangeDimension}
        />
      );
    }

    return (
      <DimensionSelect
        mode="entity-only"
        index_type="depmap_model"
        valueTypes={DimensionSelect.CONTINUOUS_ONLY}
        value={this.state.selectedDimension as DataExplorerPlotConfigDimension}
        onChange={onChangeDimension}
      />
    );
  };

  renderCustomUpload = () => {
    const example = (
      <div style={{ marginBottom: "20px" }}>
        <div style={{ paddingRight: "10px" }}>
          Upload a csv with the format:
        </div>
        <table className="custom_csv_example_table">
          <tbody>
            <tr>
              <td>cell line 1</td>
              <td>0.5</td>
            </tr>
            <tr>
              <td>cell line 2</td>
              <td>0.5</td>
            </tr>
            <tr>
              <td>cell line 3</td>
              <td>0.5</td>
            </tr>
          </tbody>
        </table>
      </div>
    );

    const customUploadComponent = (
      <div>
        {example}
        <FileUpload onChange={this.customUploadOnChange} />
        {this.state.isLoading && <span className="Select-loading" />}

        <div className="has-error">{this.state.messageWarning}</div>
        <div>{this.state.messageDetail}</div>
      </div>
    );
    return customUploadComponent;
  };

  handleUploadResponse = (uploadTask: UploadTask) => {
    let messageWarning = "";

    if (uploadTask.state === "FAILURE") {
      messageWarning = `Error: ${uploadTask.message}`;

      this.props.onChange();
    } else if (uploadTask.state === "SUCCESS") {
      if (uploadTask.result.warnings.length > 0) {
        messageWarning = uploadTask.result.warnings.join("\n");
      }

      if (uploadTask.sliceId) {
        this.props.onChange(
          uploadTask.sliceId,
          // HACK: Even though this comes from a file upload, mimic the format
          // of a vector catalog selection. This is used to generate links to
          // Data Explorer 2.
          [
            { link: null, label: "", value: "custom" },
            { link: null, label: "", value: uploadTask.result.datasetId },
            { link: null, label: "", value: "custom data" },
          ]
        );
      } else {
        // Breadbox uses a more streamline approach for setting sliceId in the backend.
        // This means sliceId is present in uploadTask.result, rather than the uploadTask
        // itself. We leave the logic for uploadTask.sliceId, because this component is shared
        // by the legacy portal backend.

        this.props.onChange(uploadTask.result.sliceId);
      }
    }
    this.setState({
      messageWarning,
      messageDetail: "",
      isLoading: false,
    });
  };

  customUploadOnChange = (uploadFile: any) => {
    if (!uploadFile || uploadFile.filename === "") {
      this.props.onChange();
      this.setState({
        messageWarning: "",
        messageDetail: "",
      });
      return;
    }
    if (uploadFile.size > 10000000) {
      // front end size limit for vector
      // this is needed because oauth reads the entire request body into memory
      this.setState({
        messageWarning: "File is too large, max size is 10MB",
        messageDetail: "",
      });
      return;
    }
    /**
      "Clear" the selected vector, i.e. notify the parent that we're loading and there isn't a valid selection
      The FileUpload component is actually wired up to call this onChange function with an empty string whenever it is clicked
      Which is to say, given the current functionality of FileUpload, the if block above is fired on click, and thus the onChange(null) below is not necessary
      However, keeping the onChange below as a safeguard, in anticipation that one may change the behavior of FileUpload without realizing that it has consequences on this
    */
    this.props.onChange();
    this.setState({
      isLoading: true,
    });

    const { getApi } = this.context;

    getApi()
      .postCustomCsvOneRow({ uploadFile })
      .then(this.handleUploadResponse);
  };

  render() {
    return (
      <div>
        <div>
          <Radio
            name={this.radioName}
            checked={this.state.inputType === "catalog"}
            onChange={() => {
              this.props.onChange();
              this.setState({
                inputType: "catalog",
              });
            }}
          >
            Portal data
          </Radio>
          {this.state.inputType === "catalog" && (
            <div style={{ marginLeft: "20px" }}>
              {this.renderVectorCatalog()}
            </div>
          )}
          <Radio
            name={this.radioName}
            checked={this.state.inputType === "custom"}
            onChange={() => {
              this.props.onChange();
              this.setState({
                inputType: "custom",
                messageWarning: "",
                messageDetail: "",
              });
            }}
          >
            Custom upload
          </Radio>
          {this.state.inputType === "custom" && (
            <div style={{ marginLeft: "20px" }}>
              {this.renderCustomUpload()}
            </div>
          )}
        </div>
      </div>
    );
  }
}
