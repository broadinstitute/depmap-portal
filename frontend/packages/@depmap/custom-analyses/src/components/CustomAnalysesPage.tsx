import React from "react";
import { Button, Radio } from "react-bootstrap";
import { breadboxAPI, legacyPortalAPI } from "@depmap/api";
import { enabledFeatures } from "@depmap/globals";
import {
  AnalysisType,
  AssociationPearsonQuery,
  CommonQueryProps,
  ComputeResponse,
  ComputeResponseResult,
  QuerySelections,
  TwoClassQuery,
} from "@depmap/compute";
import { ProgressTracker } from "@depmap/common-components";
import { isBreadboxOnlyMode } from "@depmap/data-explorer-2";
import ResultsReadyModal from "./ResultsReadyModal";

import styles from "../styles/CustomAnalysis.scss";

// generic custom analysis modal that can be outfitted with different queries
// this component is concerned with the logic of having a modal, sending an analysis request, and handling it's progress/error messages

interface CustomAnalysesPageProps {
  fetchSimplifiedCellLineData: () => Promise<
    Map<string, { displayName: string }>
  >;
}

interface ResultsWrapper {
  customAnalysisResult: {
    result?: ComputeResponseResult;
    type?: AnalysisType;
  };
}

interface CustomAnalysesPageState {
  analysisType: AnalysisType;
  submissionResponse: Promise<ComputeResponse>;
  onSuccess: (
    response: ComputeResponse,
    onResultsComplete: (response: ComputeResponse) => void
  ) => void;
  analysisCurrentlyRunning: boolean;
  datasets: { label: string; value: string }[];
  cellLineData: Map<string, { displayName: string }>;
  customAnalysisResults: Partial<ResultsWrapper> | undefined;
}

export default class CustomAnalysesPage extends React.Component<
  CustomAnalysesPageProps,
  Partial<CustomAnalysesPageState>
> {
  private queryComponents: Partial<Record<AnalysisType, any>> = {};

  constructor(props: any, context: any) {
    super(props, context);

    this.state = {
      analysisType: undefined,
      submissionResponse: undefined,
      analysisCurrentlyRunning: false,
    };
  }

  clearPreviousRun = () => {
    // called on modal enter
    this.setState({
      submissionResponse: undefined,
    });
  };

  componentDidMount = () => {
    this.clearPreviousRun();

    // This used to use /partials/data_table/cell_line_selector_lines which was
    // part of Cell Line Selector's API. That endpoint is no longer supported
    // so we're approximating its response here.
    this.props.fetchSimplifiedCellLineData().then((cellLineData) => {
      this.setState({ cellLineData });
    });

    const getDatasets = isBreadboxOnlyMode
      ? () =>
          breadboxAPI.getDatasets().then((datasets) => {
            return datasets
              .filter((d) => {
                return (
                  d.format === "matrix_dataset" &&
                  d.sample_type_name === "depmap_model"
                );
              })
              .map(({ id, name }) => ({ value: id, label: name }));
          })
      : legacyPortalAPI.getCustomAnalysisDatasets;

    getDatasets().then((availableDatasets) => {
      this.setState({ datasets: availableDatasets });
    });
  };

  sendQueryGeneric = (
    runCustomAnalysis: () => Promise<ComputeResponse>,
    onSuccess: (
      response: ComputeResponse,
      onResultsComplete?: (response: ComputeResponse) => void
    ) => void
  ) => {
    const submissionResponse = runCustomAnalysis();
    this.setState({
      submissionResponse,
      onSuccess, // this changes because the analysis type might change
      analysisCurrentlyRunning: true,
    });
  };

  onSuccessGeneric = (
    response: ComputeResponse,
    onResultsComplete: (response: any) => void
  ): void => {
    onResultsComplete(response);
    this.setState({
      analysisCurrentlyRunning: false,
    });
    this.clearPreviousRun();
  };

  renderSelectAnalysis = () => {
    const { analysisType } = this.state;
    const selectAnalysisOnChange = (event: React.FormEvent<Radio>) => {
      const target = event.target as HTMLInputElement;
      this.setState({
        analysisType: target.value as AnalysisType,
      });
    };

    return (
      <div className="analysis-type-div">
        <strong>Select type of analysis to run</strong>
        <div data-selenium-id="analysis-type">
          <Radio
            name="selectAnalysis"
            value="pearson"
            checked={analysisType === "pearson"}
            onChange={selectAnalysisOnChange}
          >
            <strong>Pearson correlation</strong>
            <p>
              Computes Pearson correlation for each feature in the selected
              dataset along with corresponding q-value.
            </p>
          </Radio>
          {enabledFeatures.linear_association && (
            <Radio
              name="selectAnalysis"
              value="association"
              checked={analysisType === "association"}
              onChange={selectAnalysisOnChange}
            >
              <strong>Linear association</strong>
              <p>
                Regress a dependent variable on a independent variable and
                report a moderated regression coefficient along with its q-value
              </p>
            </Radio>
          )}
          <Radio
            name="selectAnalysis"
            value="two_class"
            checked={analysisType === "two_class"}
            onChange={selectAnalysisOnChange}
          >
            <strong>Two class comparison</strong>
            <p>
              Computes a moderated estimate of the difference between
              groups&apos; means for each feature along with the corresponding
              q-value.
            </p>
          </Radio>
        </div>
      </div>
    );
  };

  renderBody = (querySelections?: QuerySelections) => {
    if (querySelections === undefined) {
      // null when query not selected
      return (
        <div className={styles.queryContainer}>
          <div className={styles.customRow}>
            <div className={styles.customColumn}>
              {this.renderSelectAnalysis()}
            </div>
            <div className={styles.customColumn} />
          </div>
          <div className={styles.customRow}>
            <div className={styles.customColumn} />
            <div className={styles.customColumn} />
          </div>
        </div>
      );
    }

    return (
      <div className={styles.queryContainer}>
        <div className={styles.customRow}>
          <div className={styles.customColumn}>
            {this.renderSelectAnalysis()}
          </div>
          <div className={styles.customColumn}>{querySelections[1]}</div>
          {2 in querySelections && (
            <div className={styles.customColumn}>{querySelections[2]}</div>
          )}
        </div>
        <div className={styles.customRow}>
          <div className={styles.customColumn}>{querySelections[3]}</div>
          {4 in querySelections && (
            <div className={styles.customColumn}>{querySelections[4]}</div>
          )}
          {5 in querySelections && (
            <div className={styles.customColumn}>{querySelections[5]}</div>
          )}
        </div>
      </div>
    );
  };

  renderBodyFooter = (
    querySelections: QuerySelections | undefined,
    queryIsValid: boolean,
    sendQuery?: () => void
  ) => {
    const {
      analysisCurrentlyRunning,
      submissionResponse,
      onSuccess,
    } = this.state;
    return (
      <div>
        {/* enclosing div to return one react element */}
        <div>{this.renderBody(querySelections)}</div>
        <div>
          <div
            style={{
              display: "flex",
              flexDirection: "row-reverse",
              alignItems: "center",
            }}
          >
            <Button
              className="btn btn-primary run-btn cust-assoc-run-btn"
              data-selenium-id="cust-assoc-run-btn"
              disabled={!queryIsValid || analysisCurrentlyRunning} // queryIsValid is supplied by child
              onClick={sendQuery} // supplied by child, wraps sendQueryGeneric
            >
              Run
            </Button>
            <div style={{ marginRight: "10px" }}>
              {submissionResponse != null && (
                <ProgressTracker
                  submissionResponse={submissionResponse}
                  onSuccess={(response: any, onResultsComplete: any) =>
                    onSuccess?.(response, onResultsComplete)
                  }
                  onFailure={() => {
                    this.setState({
                      analysisCurrentlyRunning: false,
                    });
                  }}
                  getTaskStatus={
                    isBreadboxOnlyMode
                      ? breadboxAPI.getTaskStatus
                      : legacyPortalAPI.getTaskStatus
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  render() {
    const {
      analysisType,
      cellLineData,
      datasets,
      customAnalysisResults,
    } = this.state;

    let QueryComponentClass: React.ComponentClass<CommonQueryProps>;
    if (analysisType === "pearson" || analysisType === "association") {
      QueryComponentClass = AssociationPearsonQuery;
    } else {
      QueryComponentClass = TwoClassQuery;
    }
    return (
      <div className={styles.customAnalysisPage}>
        <header className={styles.header}>
          <h1>
            <span>Custom Analyses</span>
          </h1>
        </header>
        <div className={styles.queryComponent}>
          {analysisType == null ? (
            this.renderBodyFooter(undefined, false, undefined)
          ) : (
            <QueryComponentClass
              analysisType={analysisType} // only used for association and pearson
              renderBodyFooter={this.renderBodyFooter}
              sendQueryGeneric={this.sendQueryGeneric}
              onSuccessGeneric={this.onSuccessGeneric}
              queryInfo={{
                cellLineData: cellLineData || new Map(),
                datasets: datasets || [],
              }}
              onAssociationResultsComplete={(
                numCellLinesUsed: number,
                result: ComputeResponseResult,
                queryVectorId: string,
                overrideColorState: string,
                overrideFilterState: string,
                analysis: AnalysisType
              ) => {
                const resultsWrapper: Partial<ResultsWrapper> = {
                  customAnalysisResult:
                    {
                      result,
                      type: analysis,
                    } || undefined,
                };
                this.setState({
                  customAnalysisResults: resultsWrapper,
                });
              }}
              ref={(el) => {
                this.queryComponents[analysisType] = el;
              }}
            />
          )}
        </div>
        <ResultsReadyModal
          results={customAnalysisResults}
          analysisType={analysisType}
          queryComponents={this.queryComponents}
        />
      </div>
    );
  }
}
