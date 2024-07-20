/* eslint-disable */
import * as React from "react";
import { errorHandler } from "@depmap/globals";
import {
  CellData,
  CellLineListsDropdown,
  CustomList,
} from "@depmap/cell-line-selector";
import { Radio } from "react-bootstrap";

import {
  CommonQueryProps,
  ComputeResponse,
  Dataset,
  DatasetSelect,
  UnivariateAssociationsParams,
  VariableType,
} from "@depmap/compute";

import { assert } from "@depmap/utils";
import { ApiContext } from "@depmap/api";

interface TwoClassQueryProps extends CommonQueryProps {
  analysisType: "two_class";
}

interface TwoClassQueryState {
  useAllOtherLinesForOutGroup: boolean; // for the checkbox
  dataset: string;
  vectorVariableType: VariableType;
  inGroup: CustomList;
  outGroup: CustomList;
  defaultDataset: Dataset;
}

export class TwoClassQuery extends React.Component<
  TwoClassQueryProps,
  Partial<TwoClassQueryState>
> {
  declare context: React.ContextType<typeof ApiContext>;
  static contextType = ApiContext;

  constructor(props: any) {
    super(props);

    const { customAnalysisVectorDefault } = props;

    const defaultDataset =
      customAnalysisVectorDefault && customAnalysisVectorDefault.length > 1
        ? {
            label: customAnalysisVectorDefault[1].selected.label,
            value: customAnalysisVectorDefault[1].selected.optionValue,
          }
        : undefined;

    this.state = {
      useAllOtherLinesForOutGroup: undefined,
      dataset: defaultDataset?.value, // the selected dataset
      defaultDataset,
      vectorVariableType: "independent",
      inGroup: {
        name: "",
        lines: new Set(),
      },
      outGroup: {
        name: "",
        lines: new Set(),
      },
    };
  }

  componentDidMount = () => {
    this.setStatesFromProps(); // reuse this function
  };

  setStatesFromProps = () => {
    // doesn't do anything anymore. removed prepopoulate for dataset
  };

  renderSelectDataset = () => {
    const { queryInfo } = this.props;
    const { defaultDataset } = this.state;
    return (
      <div style={{ flex: 1 }}>
        <DatasetSelect
          label="1. Select a dataset:"
          datasets={queryInfo.datasets}
          defaultSelectedDataset={defaultDataset}
          onChange={(e) => {
            this.setState({
              dataset: e,
            });
          }}
        />
      </div>
    );
  };

  renderSelectInGroup = () => {
    return (
      <div>
        <strong>3. Select {'"in"'} group cell lines</strong>
        <div style={{ marginTop: "10px" }}>
          <CellLineListsDropdown
            launchCellLineSelectorModal={this.props.launchCellLineSelectorModal}
            id="in-group-selection-dropdown"
            defaultNone
            onListSelect={(e: CustomList) => {
              this.setState({ inGroup: e });
            }}
          />
        </div>
      </div>
    );
  };

  renderSelectOutGroup = () => {
    return (
      <div>
        <strong>4. Select {'"out"'} group cell lines</strong>
        <div>
          <Radio
            name="subsetOutGroup"
            checked={this.state.useAllOtherLinesForOutGroup === true}
            onChange={() => {
              this.setState({
                useAllOtherLinesForOutGroup: true,
                outGroup: {
                  name: "",
                  lines: new Set(),
                },
              });
            }}
          >
            Use all other cell lines
          </Radio>
          <Radio
            name="subsetOutGroup"
            checked={this.state.useAllOtherLinesForOutGroup === false}
            onChange={() =>
              this.setState({
                useAllOtherLinesForOutGroup: false,
              })
            }
          >
            Select a subset of cell lines
          </Radio>
        </div>
        <div style={{ marginLeft: "20px" }}>
          {this.state.useAllOtherLinesForOutGroup == false &&
            this.props.queryInfo.cellLineData && (
              <CellLineListsDropdown
                launchCellLineSelectorModal={
                  this.props.launchCellLineSelectorModal
                }
                id="out-group-selection-dropdown"
                defaultNone
                onListSelect={(e: CustomList) => {
                  this.setState({ outGroup: e });
                }}
              />
            )}
        </div>
        {this.state.inGroup && this.state.outGroup ? (
          <OverlappingLines
            inGroup={this.state.inGroup}
            outGroup={this.state.outGroup}
            cellLineData={this.props.queryInfo.cellLineData}
          />
        ) : null}
      </div>
    );
  };

  getQueryIsValid = () => {
    const datasetIsValid: boolean =
      this.state.dataset != null && this.state.dataset != "";

    const vectorVariableTypeIsValid: boolean =
      this.state.vectorVariableType != null;

    const inGroupIsValid: boolean = this.state.inGroup?.name != null;

    const outGroupIsValid: boolean =
      this.state.useAllOtherLinesForOutGroup ||
      (this.state.outGroup?.lines != null &&
        this.state.outGroup?.name != this.state.inGroup?.name &&
        this.state.outGroup.lines.size > 0);

    return (
      datasetIsValid &&
      vectorVariableTypeIsValid &&
      inGroupIsValid &&
      outGroupIsValid
    );
  };

  sendQuery = () => {
    const queryCellLines = [];
    const queryValues = [];

    // instead of two for loops, could just make e.g. arrays containing all "in", of the same length as the in group
    if (this.state.inGroup) {
      for (const line of this.state.inGroup.lines) {
        queryCellLines.push(line);
        queryValues.push("in");
      }
    }

    let outGroupCellLines;
    if (this.state.useAllOtherLinesForOutGroup) {
      outGroupCellLines = this.props.queryInfo.cellLineData.keys();
    } else {
      outGroupCellLines = this.state.outGroup?.lines || new Set<string>();
    }

    for (const line of outGroupCellLines) {
      if (!this.state.inGroup?.lines.has(line)) {
        queryCellLines.push(line);
        queryValues.push("out");
      }
    }

    if (queryCellLines.length != queryValues.length) {
      errorHandler.report("Two class query arrays dangerously out of sync");
    }

    const params: UnivariateAssociationsParams = {
      analysisType: "two_class",
      datasetId: this.state.dataset || "",
      vectorVariableType: this.state.vectorVariableType,
      queryCellLines,
      queryValues,
    };

    const { getApi } = this.context;

    const runCustomAnalysis = () => {
      return getApi().computeUnivariateAssociations(params);
    };
    this.props.sendQueryGeneric(runCustomAnalysis, this.onSuccess);
  };

  onResultsComplete = (response: any) => {
    // function for the child-specific handling of the result
    const { result } = response;
    assert(
      result != null,
      `Response: ${JSON.stringify(response)}, State: ${JSON.stringify(
        this.state
      )}`
    );
    this.props.onAssociationResultsComplete(
      result.numCellLinesUsed,
      result,
      result.data[0].vectorId,
      result.colorSliceId, // override color state
      result.filterSliceId, // override filter state
      "two_class"
    );
  };

  onSuccess = (response: ComputeResponse) => {
    return this.props.onSuccessGeneric(response, this.onResultsComplete);
  };

  render() {
    const queryIsValid: boolean = this.getQueryIsValid();

    // numbers here are positions, seee type QuerySelections
    return this.props.renderBodyFooter(
      {
        1: this.renderSelectDataset(),
        3: this.renderSelectInGroup(),
        4: this.renderSelectOutGroup(),
      },
      queryIsValid,
      this.sendQuery
    );
  }
}

interface OverlappingLinesProps {
  inGroup: CustomList;
  outGroup: CustomList;
  cellLineData: Map<string, CellData>;
}

export class OverlappingLines extends React.Component<
  OverlappingLinesProps,
  any
> {
  getInOutOverlap = (inGroup: CustomList, outGroup: CustomList) => {
    const overlappingLines: Array<string> = [];
    for (const line of outGroup.lines) {
      if (inGroup.lines.has(line)) {
        overlappingLines.push(line);
      }
    }
    return overlappingLines;
  };

  render() {
    if (this.props.inGroup.lines == null || this.props.outGroup.lines == null) {
      return null;
    }

    const overlappingLines: Array<string> = this.getInOutOverlap(
      this.props.inGroup,
      this.props.outGroup
    );

    let message = "";
    let showOverlappingLines = false;
    if (this.props.inGroup.name == this.props.outGroup.name) {
      message = "Out group cannot be the same as the in group.";
    } else if (overlappingLines.length == this.props.outGroup.lines.size) {
      message =
        "Warning: All out group cell lines are part of the in group. Please pick different cell lines.";
      showOverlappingLines = true;
    } else if (overlappingLines.length > 0) {
      message =
        "Warning: In and out groups have overlapping cell lines. Analysis will be run with overlapping lines removed from the out group.";
      showOverlappingLines = true;
    }

    if (overlappingLines.length > 0) {
      return (
        <div>
          <p>
            <span style={{ color: "red" }}>{message}</span>
          </p>
          {showOverlappingLines && (
            <p>
              {`Overlapping lines: ${overlappingLines
                .map((x) => this.props.cellLineData.get(x)?.displayName)
                .join(", ")}`}
            </p>
          )}
        </div>
      );
    }
    return null;
  }
}
