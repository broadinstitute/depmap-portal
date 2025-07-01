import * as React from "react";
import {
  Button,
  Checkbox,
  Radio,
  Modal,
  Popover,
  OverlayTrigger,
} from "react-bootstrap";
import update from "immutability-helper";

import { CellLineListsDropdown, CustomList } from "@depmap/cell-line-selector";

import {
  DatasetOptionsWithLabels,
  DatasetPicker,
  DownloadTracker,
  ExportDataQuery,
  ExportMergedDataQuery,
  FeatureValidationQuery,
  ValidationResult,
  ValidationTextbox,
} from "@depmap/data-slicer";
import styles from "src/pages/Downloads/styles.scss";
import { breadboxAPI } from "@depmap/api";

interface ElaraDataSlicerProps {
  exportData: (query: ExportDataQuery) => Promise<any>;
  exportDataForMerge: (query: ExportMergedDataQuery) => Promise<any>;
  getTaskStatus: (taskId: string) => Promise<any>;
  validateFeatures: (
    query: FeatureValidationQuery
  ) => Promise<ValidationResult>;
}

interface ElaraDataSlicerState {
  selectedDatasets: ReadonlyMap<string, string>; // map dataset id to dataset label (for downloads)
  entityLabels: ReadonlySet<string>;

  datasetOptions: Map<string, DatasetOptionsWithLabels[]>;

  useAllCellLines: boolean;
  selectedCellLineList: CustomList | null;
  useAllGenesCompounds: boolean;

  downloads: any[];

  dropEmpty: boolean;
  downloadMetadata: boolean;
  mergeDatasets: boolean;
  initialized: boolean;
}

export default class ElaraDataSlicer extends React.Component<
  ElaraDataSlicerProps,
  ElaraDataSlicerState
> {
  private validationTextbox: any = null;

  constructor(props: ElaraDataSlicerProps) {
    super(props);
    this.validationTextbox = React.createRef();
    this.state = {
      selectedDatasets: new Map<string, string>(),
      entityLabels: new Set<string>(),

      datasetOptions: new Map<string, DatasetOptionsWithLabels[]>(),

      useAllCellLines: true,
      selectedCellLineList: null,
      useAllGenesCompounds: true,

      downloads: [],

      dropEmpty: true,
      downloadMetadata: false,
      mergeDatasets: false,
      initialized: false,
    };
  }

  componentDidMount = () => {
    const datasetOptions: Map<string, DatasetOptionsWithLabels[]> = new Map();
    const selectedDatasets = new Map<string, string>();

    const urlParams = new URLSearchParams(window.location.search);
    const defaultSelectedStr = urlParams.get("default_selected") ?? "";
    const defaultSelectedSet = new Set(defaultSelectedStr.split(","));

    breadboxAPI.getDatasets().then((response) => {
      response.forEach((dataset) => {
        // group the datasets by their dataType
        const option: DatasetOptionsWithLabels = {
          id: dataset.id,
          label: dataset.name,
        };

        const dataType = dataset.data_type;
        if (dataType) {
          if (!datasetOptions.has(dataType)) {
            datasetOptions.set(dataType, [option]);
          } else {
            const newArray = datasetOptions.get(dataType);
            if (newArray) {
              newArray.push(option);
              datasetOptions.set(dataType, newArray);
            }
          }
        }

        if (defaultSelectedSet.has(dataset.id)) {
          selectedDatasets.set(dataset.id, dataset.name);
        }
      });

      this.setState({
        selectedDatasets,
        datasetOptions,
        initialized: true,
      });
    });
  };

  sendQuery = () => {
    const downloadTrackers: any[] = [];
    const entityLabels = this.state.useAllGenesCompounds
      ? undefined
      : Array.from(this.state.entityLabels);
    const cellLineIds =
      this.state.useAllCellLines || this.state.selectedCellLineList == null
        ? undefined
        : Array.from(this.state.selectedCellLineList.lines);

    if (this.state.mergeDatasets && this.state.selectedDatasets.size > 1) {
      const ids: string[] = [];
      const displayNames: string[] = [];

      this.state.selectedDatasets.forEach((displayName, id) => {
        ids.push(id);

        displayNames.push(displayName);
      });

      const query: ExportMergedDataQuery = {
        datasetIds: ids,
        featureLabels: entityLabels,
        cellLineIds,
        dropEmpty: this.state.dropEmpty,
        addCellLineMetadata: this.state.downloadMetadata,
      };

      const submissionResponse = this.props.exportDataForMerge(query);

      downloadTrackers.push(
        <div key={`download-${ids[0]}`}>
          <DownloadTracker
            submissionResponse={submissionResponse}
            citationUrls={[]}
            datasetDisplayNames={displayNames}
            getTaskStatus={this.props.getTaskStatus}
          />
        </div>
      );
    } else {
      this.state.selectedDatasets.forEach((displayName, id) => {
        const query: ExportDataQuery = {
          datasetId: id,
          featureLabels: entityLabels,
          cellLineIds,
          dropEmpty: this.state.dropEmpty,
          addCellLineMetadata: this.state.downloadMetadata,
        };
        const submissionResponse = this.props.exportData(query);
        downloadTrackers.push(
          <div key={`download-${id}`}>
            <DownloadTracker
              submissionResponse={submissionResponse}
              citationUrls={[]}
              datasetDisplayNames={[displayName]}
              getTaskStatus={this.props.getTaskStatus}
            />
          </div>
        );
      });
    }

    this.setState({
      downloads: downloadTrackers,
    });
  };

  updateDatasetSelection = (justClickedDataset: DatasetOptionsWithLabels) => {
    let newSelectedDatasets;
    if (this.state.selectedDatasets.has(justClickedDataset.id)) {
      newSelectedDatasets = update(this.state.selectedDatasets, {
        $remove: [justClickedDataset.id],
      });
    } else {
      newSelectedDatasets = update(this.state.selectedDatasets, {
        $add: [[justClickedDataset.id, justClickedDataset.label]],
      });
    }

    this.setState(
      {
        selectedDatasets: newSelectedDatasets,
      },
      () => {
        // TODO:  fix this hack (put in place to get a demo out for design review)
        if (
          this.validationTextbox != null &&
          !(
            Object.prototype.hasOwnProperty.call(
              this.validationTextbox,
              "current"
            ) && this.validationTextbox.current == null
          )
        ) {
          this.validationTextbox.validateTextFieldTriggeredByParent();
        }
      }
    );
  };

  areAllOptionsOfADatasetGroupChecked = (
    datasetGroup: DatasetOptionsWithLabels[]
  ) => {
    return (
      datasetGroup.length ===
      datasetGroup.filter((option) =>
        this.state.selectedDatasets.has(option.id)
      ).length
    );
  };

  selectUnselectAllDatasets = (datasetList: DatasetOptionsWithLabels[]) => {
    let newDatasetIds;
    if (this.areAllOptionsOfADatasetGroupChecked(datasetList)) {
      newDatasetIds = update(this.state.selectedDatasets, {
        $remove: datasetList.map(
          (option: DatasetOptionsWithLabels) => option.id
        ),
      });
    } else {
      newDatasetIds = update(this.state.selectedDatasets, {
        $add: datasetList.map((option: DatasetOptionsWithLabels) => [
          option.id,
          option.label,
        ]) as any,
      });
    }

    this.setState({
      selectedDatasets: newDatasetIds,
    });
  };

  validateQuery = (): boolean => {
    // at least one dataset selected
    if (this.state.selectedDatasets.size < 1) {
      return false;
    }
    // either all cell lines selected, or if custom cell line list option is selected, a valid list is selected
    if (
      !this.state.useAllCellLines &&
      this.state.selectedCellLineList == null
    ) {
      return false;
    }
    // either all entities selected, or if custom entitiy list option is selected, all inputs are valid
    if (!this.state.useAllGenesCompounds && this.state.entityLabels.size < 1) {
      return false;
    }
    return true;
  };

  renderDatasetCheckboxGroup = (datasets: DatasetOptionsWithLabels[]) => {
    const sortedDatasets = datasets;
    sortedDatasets.sort((a, b) => (a.label > b.label ? 1 : -1));
    return (
      <DatasetPicker
        datasets={sortedDatasets}
        highlightedDataset="" // TODO: Figure out if this can be dropped
        checked={new Set(this.state.selectedDatasets.keys())}
        onClick={(clicked: DatasetOptionsWithLabels) => {
          this.updateDatasetSelection(clicked);
        }}
        onMouseOver={() => {}}
      />
    );
  };

  renderDatasetSelection = (): any => {
    const numCols = 4;
    const dataTypeCounts: { dataType: string; numElements: number }[] = [];
    Array.from(this.state.datasetOptions.keys()).forEach((dataType: string) => {
      const dataTypeOptions = this.state.datasetOptions.get(dataType);
      const catOptionsLength = dataTypeOptions ? dataTypeOptions.length : 0;
      dataTypeCounts.push({
        dataType,
        numElements: catOptionsLength,
      });
    });

    dataTypeCounts.sort((a, b) => (a.numElements < b.numElements ? 1 : -1));

    const columns: string[][] = [];
    const runningCounts: number[] = [];
    for (let i = 0; i < numCols; i++) {
      columns.push([]);
      runningCounts.push(0);
    }

    dataTypeCounts.forEach(
      (dataTypeCount: { dataType: string; numElements: number }) => {
        const indexOfMinRunningCounts = runningCounts.indexOf(
          Math.min(...runningCounts)
        );
        columns[indexOfMinRunningCounts].push(dataTypeCount.dataType);
        runningCounts[indexOfMinRunningCounts] += dataTypeCount.numElements + 1;
      }
    );

    const cols: any[] = [];

    columns.forEach((column: string[], index: number) => {
      const colElements: any[] = [];
      column.forEach((dataType: string) => {
        const datasets = this.state.datasetOptions.get(dataType);

        if (datasets) {
          colElements.push(
            <div key={`select-${dataType}`} className={styles.dataTypeGroup}>
              <strong>
                {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
              </strong>
              {" | "}
              {/* eslint-disable-next-line
                  jsx-a11y/anchor-is-valid,
                  jsx-a11y/no-static-element-interactions,
                  jsx-a11y/click-events-have-key-events */}
              <a
                onClick={() => {
                  this.selectUnselectAllDatasets(datasets);
                }}
              >
                {this.areAllOptionsOfADatasetGroupChecked(datasets)
                  ? "Deselect all"
                  : "Select All"}
              </a>
              {this.renderDatasetCheckboxGroup(datasets)}
            </div>
          );
        }
      });
      cols.push(
        <div
          key={`datasets-col-${index}`}
          className={index !== numCols - 1 ? styles.notLastCol : ""}
          style={{}}
        >
          {colElements}
        </div>
      );
    });

    const display = this.state.initialized ? cols : "Loading...";

    return (
      <div>
        <h4>DATASETS</h4>
        <div className={styles.datasetGroupContainer}>{display}</div>
      </div>
    );
  };

  renderCellLineSelection = (): any => {
    const onCellLineLinkClick = () => {
      window.alert("TODO: launch context manager");
      // Need this click so that the tooltip doesn't stay open in front of the cell line modal
      document.body.click();
    };

    const cellLineSelectorPopover = (
      <Popover id="custom-cell-lines-popover">
        <p>
          Use the{" "}
          {/* eslint-disable-next-line
              jsx-a11y/anchor-is-valid,
              jsx-a11y/no-static-element-interactions,
              jsx-a11y/click-events-have-key-events */}
          <a style={{ cursor: "pointer" }} onClick={onCellLineLinkClick}>
            Cell Line Selector
          </a>{" "}
          to sort and filter cell lines to create and save custom collections
          that can be applied across tools and plots throughout the portal.
        </p>
      </Popover>
    );

    return (
      <div>
        <h4>{"CELL LINES "}</h4>
        <div>
          <Radio
            inline
            id="cellLinesAll"
            checked={this.state.useAllCellLines}
            onChange={() =>
              this.setState({
                useAllCellLines: true,
              })
            }
          >
            <label htmlFor="cellLinesAll" style={{ cursor: "pointer" }}>
              {" "}
              Use all cell lines
            </label>
          </Radio>
          <Radio
            inline
            id="cellLinesCustom"
            checked={!this.state.useAllCellLines}
            onChange={() =>
              this.setState({
                useAllCellLines: false,
              })
            }
          >
            <label htmlFor="cellLinesCustom" style={{ cursor: "pointer" }}>
              {" "}
              Use custom cell line list
            </label>
          </Radio>
          <OverlayTrigger
            trigger="click"
            placement="top"
            overlay={cellLineSelectorPopover}
            rootClose
          >
            <span
              className="glyphicon glyphicon-question-sign"
              style={{
                marginInlineEnd: 10,
                marginInlineStart: 10,
                color: "#9E599A",
              }}
            />
          </OverlayTrigger>
        </div>
        {!this.state.useAllCellLines && (
          <CellLineListsDropdown
            defaultNone
            onListSelect={(e: CustomList) => {
              this.setState({
                selectedCellLineList: e,
              });
            }}
          />
        )}
      </div>
    );
  };

  validateFeatures = (inputs: string[]): Promise<ValidationResult> => {
    if (inputs.length > 0) {
      const query: FeatureValidationQuery = {
        featureLabels: inputs,
      };
      return this.props.validateFeatures(query);
    }
    return Promise.resolve({
      valid: new Set([""]),
      invalid: new Set(inputs),
    });
  };

  renderFeatureSelection = (): any => {
    const featurePopover = (
      <Popover id="feature-popover">
        <p>
          {
            "Enter a space separated list of features into the textbox that appears when option is selected."
          }
        </p>
      </Popover>
    );
    return (
      <div>
        <h4>FEATURES</h4>
        <Radio
          inline
          id="geneCompoundAll"
          checked={this.state.useAllGenesCompounds}
          onChange={() =>
            this.setState({
              useAllGenesCompounds: true,
            })
          }
        >
          <label htmlFor="geneCompoundAll" style={{ cursor: "pointer" }}>
            {" "}
            Use all features
          </label>
        </Radio>

        <Radio
          inline
          id="geneCompoundCustom"
          checked={!this.state.useAllGenesCompounds}
          onChange={() =>
            this.setState({
              useAllGenesCompounds: false,
            })
          }
        >
          <label htmlFor="geneCompoundCustom" style={{ cursor: "pointer" }}>
            {" "}
            Use custom feature list
          </label>
        </Radio>
        <OverlayTrigger
          trigger={"click"}
          placement="top"
          overlay={featurePopover}
          rootClose
        >
          <span
            className="glyphicon glyphicon-question-sign"
            style={{
              marginInlineEnd: 10,
              marginInlineStart: 10,
              color: "#9E599A",
            }}
          />
        </OverlayTrigger>
        {!this.state.useAllGenesCompounds && (
          <div>
            <ValidationTextbox
              ref={(el) => {
                this.validationTextbox = el;
              }}
              placeholderText="Type your space-separated list here"
              validationFunction={this.validateFeatures}
              separator={" "}
              onAllInputsValidated={(validInputs: Set<string>) => {
                this.setState({
                  entityLabels: validInputs,
                });
              }}
              onInvalidInputsExist={() => {
                this.setState({
                  entityLabels: new Set<string>(),
                });
              }}
              textboxSizeRows={4}
            />
          </div>
        )}
      </div>
    );
  };

  renderDownloadModal = (): any => {
    return (
      <Modal
        backdrop="static"
        show
        onHide={() => {
          this.setState({
            downloads: [],
          });
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>File Downloads</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            If the file(s) do not download automatically, click the links below.
          </div>
          <hr />
          {this.state.downloads}
        </Modal.Body>
      </Modal>
    );
  };

  render() {
    return (
      <div id={styles.ElaraDataSlicer}>
        <div className={styles.parameters}>
          <div>
            <strong>Create your own dataset downloads</strong>
            <p>
              This tool will subset datasets by your selection of cell lines and
              features
            </p>
            <hr />
            <div className={styles.datasetGroupContainer}>
              <div>
                <Checkbox
                  checked={this.state.dropEmpty}
                  onChange={() => {
                    /* do nothing */
                  }}
                  onClick={() => {
                    this.setState((prevState) => ({
                      dropEmpty: !prevState.dropEmpty,
                    }));
                  }}
                >
                  <span>
                    Exclude columns and rows of NA from download files.
                  </span>
                </Checkbox>
                <Checkbox
                  checked={this.state.downloadMetadata}
                  onChange={() => {
                    /* do nothing */
                  }}
                  onClick={() => {
                    this.setState((prevState) => ({
                      downloadMetadata: !prevState.downloadMetadata,
                    }));
                  }}
                >
                  <span>Add cell line metadata to download</span>
                </Checkbox>
                <Checkbox
                  checked={this.state.mergeDatasets}
                  onChange={() => {
                    /* do nothing */
                  }}
                  onClick={() => {
                    this.setState((prevState) => ({
                      mergeDatasets: !prevState.mergeDatasets,
                    }));
                  }}
                >
                  <span>Merge into a single file</span>
                </Checkbox>
              </div>
            </div>
            <hr />
            {this.renderCellLineSelection()}
            <hr />
            {this.renderFeatureSelection()}
            <hr />
            {this.renderDatasetSelection()}
          </div>
          <div className={styles.downloadButtonContainer}>
            <Button
              bsStyle="primary"
              style={{ width: "100%", height: "60%" }}
              disabled={!this.validateQuery()}
              onClick={() => {
                this.sendQuery();
              }}
            >
              {this.state.selectedDatasets &&
              this.state.selectedDatasets.size > 1
                ? "Download Files"
                : "Download File"}
            </Button>
          </div>
        </div>

        <div className={styles.otherParametersWrapper}>
          {this.state.downloads.length > 0 && this.renderDownloadModal()}
        </div>
      </div>
    );
  }
}
