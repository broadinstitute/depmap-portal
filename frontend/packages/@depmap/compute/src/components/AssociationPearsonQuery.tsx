/* eslint-disable */
import React from "react";
import { Radio } from "react-bootstrap";
import { assert } from "@depmap/utils";
import { Link } from "@depmap/interactive";
import { ApiContext } from "@depmap/api";
import { CellLineListsDropdown, CustomList } from "@depmap/cell-line-selector";
import {
  AssociationOrPearsonAnalysisType,
  QuerySelections,
  ComputeResponse,
  UnivariateAssociationsParams,
  VariableType,
  CommonQueryProps,
} from "../models/compute";
import { CustomOrCatalogVectorSelect } from "./CustomOrCatalogVectorSelect";
import { DatasetSelect } from "./DatasetSelect";

interface AssociationPearsonQueryProps extends CommonQueryProps {
  analysisType: AssociationOrPearsonAnalysisType;
}

interface AssociationPearsonQueryState {
  dataset: string;
  usingSubsetOfLines: boolean;
  selectedList: CustomList;
  queryVectorId: string;
  vectorVariableType: VariableType;
  vectorCatalogSelections: Link[];
}

export default class AssociationPearsonQuery extends React.Component<
  AssociationPearsonQueryProps,
  Partial<AssociationPearsonQueryState>
> {
  declare context: React.ContextType<typeof ApiContext>;
  static contextType = ApiContext;

  constructor(props: any) {
    super(props);

    this.state = {
      dataset: undefined, // the id of the selected dataset
      usingSubsetOfLines: false,
      selectedList: {
        name: "",
        lines: new Set(),
      },
      queryVectorId: undefined,
      vectorVariableType: undefined,
      vectorCatalogSelections: undefined,
    };
  }

  renderSelectVector = () => {
    const updateQueryVectorId = (
      queryVectorId?: string,
      vectorCatalogSelections?: Link[]
    ) => {
      this.setState({ queryVectorId, vectorCatalogSelections });
    };
    return (
      <div style={{ flex: 1 }}>
        <strong>1. Select a data slice:</strong>
        <CustomOrCatalogVectorSelect onChange={updateQueryVectorId} />
      </div>
    );
  };

  renderSelectDataset = () => {
    const { queryInfo } = this.props;

    return (
      <div style={{ flex: 1 }}>
        <DatasetSelect
          label="2. Select a dataset"
          datasets={queryInfo.datasets}
          onChange={(e) => {
            this.setState({
              dataset: e,
            });
          }}
        />
      </div>
    );
  };

  renderSelectCellLines = () => {
    const { analysisType, launchCellLineSelectorModal } = this.props;
    const { usingSubsetOfLines } = this.state;

    const stepNumber = analysisType === "pearson" ? "3" : "4";
    return (
      <div className="subset-search">
        <strong>{`${stepNumber}. Select cell lines to run on:`}</strong>
        <div>
          <Radio
            data-selenium-id="subset-no"
            name="subsetCellLines"
            checked={usingSubsetOfLines === false}
            onChange={() => {
              this.setState({
                usingSubsetOfLines: false,
                selectedList: {
                  // just clear it, for easier logic
                  name: "",
                  lines: new Set(),
                },
              });
            }}
          >
            Use all cell lines
          </Radio>
          <Radio
            data-selenium-id="subset-yes"
            name="subsetCellLines"
            checked={usingSubsetOfLines === true}
            onChange={() => this.setState({ usingSubsetOfLines: true })}
          >
            Select a subset of cell lines
          </Radio>
        </div>
        <div style={{ marginLeft: "20px" }}>
          {usingSubsetOfLines === true && (
            <CellLineListsDropdown
              defaultNone
              launchCellLineSelectorModal={launchCellLineSelectorModal}
              onListSelect={(cellLinelist: CustomList) => {
                this.setState({
                  selectedList: cellLinelist,
                });
              }}
            />
          )}
        </div>
      </div>
    );
  };

  renderSelectVectorVariableType = () => {
    const { vectorVariableType } = this.state;

    return (
      <div style={{ flex: 1 }}>
        <strong>3. This dataset is the:</strong>
        <Radio
          name="vectorVariableType"
          checked={
            vectorVariableType != null &&
            // NOTE THE INVERSION HERE
            // the variable is about the vector, to be as close to the endpoint code as possible
            // however, from a user standpoint, it might make sense to ask about the dataset
            // so the text asks about the vector, which is the __opposite__
            vectorVariableType === "independent"
          }
          onChange={() => {
            this.setState({
              vectorVariableType: "independent",
            });
          }}
        >
          {
            // this text says the dataset is dependent, so the __vector__ is independent
          }
          Dependent variable
        </Radio>
        <Radio
          name="vectorVariableType"
          checked={
            vectorVariableType != null &&
            // NOTE THE INVERSION HERE
            // the variable is about the vector, to be as close to the analysis code as possible
            // however, from a user standpoint, it might make sense to ask about the dataset
            // so the text asks about the vector, which is the __opposite__
            vectorVariableType === "dependent"
          }
          onChange={() => {
            this.setState({
              vectorVariableType: "dependent",
            });
          }}
        >
          {
            // this text says the dataset is independent, so the __vector__ is dependent
          }
          Independent variable
        </Radio>
      </div>
    );
  };

  getQueryIsValid = () => {
    const { analysisType } = this.props;
    const {
      queryVectorId,
      dataset,
      vectorVariableType,
      usingSubsetOfLines,
      selectedList,
    } = this.state;

    let selectQueryVectorIsValid = false;
    if (queryVectorId != null && queryVectorId !== "") {
      selectQueryVectorIsValid = true;
    }

    const selectDatasetIsValid: boolean = dataset != null && dataset !== "";

    let selectvectorVariableTypeIsValid = false;
    if (analysisType === "pearson" || vectorVariableType != null) {
      // this input is not used for person, is not sent
      selectvectorVariableTypeIsValid = true;
    }

    let selectLinesIsValid = false;
    if (!usingSubsetOfLines) {
      selectLinesIsValid = true;
    } else {
      selectLinesIsValid =
        selectedList?.name != null && selectedList.lines.size > 0;
    }

    return (
      selectQueryVectorIsValid &&
      selectDatasetIsValid &&
      selectvectorVariableTypeIsValid &&
      selectLinesIsValid
    );
  };

  sendQuery = () => {
    const { analysisType, sendQueryGeneric } = this.props;
    const {
      usingSubsetOfLines,
      selectedList,
      dataset,
      queryVectorId,
      vectorVariableType,
    } = this.state;

    const { getApi } = this.context;

    let queryCellLines = null; // remains null if subset is not defined
    if (usingSubsetOfLines && selectedList) {
      // is a set, need to convert to an array
      queryCellLines = Array.from(selectedList.lines);
    }

    const params: UnivariateAssociationsParams = {
      analysisType,
      datasetId: dataset || "",
      queryId: queryVectorId,
      queryCellLines,
    };
    if (analysisType === "association") {
      // pearson does not use vectorVariableType, only association
      params.vectorVariableType = vectorVariableType;
    }
    const runCustomAnalysis = () => {
      return getApi().computeUnivariateAssociations(params);
    };
    sendQueryGeneric(runCustomAnalysis, this.onSuccess);
  };

  onResultsComplete = (response: any) => {
    const { onAssociationResultsComplete } = this.props;
    const { queryVectorId } = this.state;

    // function for the child-specific handling of the result
    const { result } = response;
    assert(
      result != null,
      `Response: ${JSON.stringify(response)}, State: ${JSON.stringify(
        this.state
      )}`
    );

    onAssociationResultsComplete(
      result.numCellLinesUsed,
      result,
      queryVectorId || "",
      "", // no color used
      result.filterSliceId, // override filter state
      "association"
    );
  };

  onSuccess = (response: ComputeResponse) => {
    const { onSuccessGeneric } = this.props;

    return onSuccessGeneric(response, this.onResultsComplete);
  };

  render() {
    const { analysisType, renderBodyFooter } = this.props;

    const queryIsValid: boolean = this.getQueryIsValid();
    const querySelections: QuerySelections = {
      1: this.renderSelectVector(),
      // this deliberately leaves out 2. the numbers determine placement, and we want to keep the stuff with dataset (dataset selection and variable type) together
      // see type QuerySelections for positions
      3: this.renderSelectDataset(),
      5: this.renderSelectCellLines(),
    };
    if (analysisType === "association") {
      // variable type only applies to association, not pearson
      querySelections[4] = this.renderSelectVectorVariableType();
    }
    return renderBodyFooter(querySelections, queryIsValid, this.sendQuery);
  }
}
