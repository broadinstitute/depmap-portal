import React from "react";
import { Button, Radio } from "react-bootstrap";
import { Navigate, useLocation } from "react-router-dom";
import { enabledFeatures } from "@depmap/globals";
import {
  AnalysisType,
  AssociationPearsonQuery,
  CommonQueryProps,
  ComputeResponse,
  ComputeResponseResult,
  Dataset,
  QuerySelections,
  TwoClassQuery,
} from "@depmap/compute";
import {
  ControlledPlotApi,
  ControlledPlotState,
  DropdownState,
  formatPathToDropdown,
  getRootOptionsAsPath,
  OptionsInfoSelected,
} from "@depmap/interactive";
import {
  CellData,
  CellLineSelectorLines,
  loadCellLines,
} from "@depmap/cell-line-selector";
import { ProgressTracker } from "@depmap/common-components";
import { ApiContext } from "@depmap/api";
import ResultsReadyModal from "./ResultsReadyModal";

import styles from "../styles/CustomAnalysis.scss";

// generic custom analysis modal that can be outfitted with different queries
// this component is concerned with the logic of having a modal, sending an analysis request, and handling it's progress/error messages

interface CustomAnalysesPageProps {
  launchCellLineSelectorModal: () => void;
  updateReactLoadStatus?: () => void;
}

interface CustomAnalysesPageState {
  analysisType: AnalysisType;
  submissionResponse: Promise<ComputeResponse>;
  onSuccess: (
    response: ComputeResponse,
    onResultsComplete: (response: ComputeResponse) => void
  ) => void;
  analysisCurrentlyRunning: boolean;
  datasets: Dataset[];
  continuousRootDropdowns: DropdownState[];
  cellLineData: Map<string, CellData>;
  goToInteractive: boolean;
  customAnalysisResults: Partial<ControlledPlotState> | undefined;
}
// const TWO_CLASS_DESC = (<div>
//     <p>In this analysis, we regress the dependent variable on the independent variable and
//         report the regression coefficient along with its standard error. After repeating this
//         procedure for each column of the selected dataset (either as the dependent or independent
//         variable), we moderate the reported values using the adaptive shrinkage procedure described
//         in doi:10.1093/biostatistics/kxw041. This procedure consists of an empirical Bayes method that
//         aims to correct the selection bias due to the multiple models examined jointly. Finally,
//         we report the posterior means, the standard deviations, and the corresponding q-values as the results.</p>
//     <p>Please note, the significance of a linear association is identical to the significance of the
//         corresponding Pearson correlation, modulo the shrinkage step we included at the end. However,
//         the coefficients or effect sizes reported in these analyses should be interpreted slightly differently.
//         In particular, the regression coefficients are directional quantities and answer the question of
//         "How much would the dependent variable change if we increase the independent variable one unit
//         (assuming there are not any unobserved confounding variables)?" However, the correlation
//         coefficients are unitless and symmetric quantities that provided a scale-free measure of the concordance between two variables.</p>
// </div>);

function NavigateWithResults({
  results,
}: {
  results: Partial<ControlledPlotState>;
}) {
  const location = useLocation();

  if (enabledFeatures.data_explorer_2) {
    return null;
  }

  return <Navigate to={`${location.pathname}/..`} state={results} />;
}

export default class CustomAnalysesPage extends React.Component<
  CustomAnalysesPageProps,
  Partial<CustomAnalysesPageState>
> {
  declare context: React.ContextType<typeof ApiContext>;

  static defaultProps = {
    updateReactLoadStatus: () => {},
  };

  static contextType = ApiContext;

  private queryComponents: Partial<Record<AnalysisType, any>> = {};

  api: ControlledPlotApi;

  constructor(props: any, context: any) {
    super(props, context);

    this.api = context.getApi();
    this.state = {
      analysisType: undefined,
      submissionResponse: undefined,
      analysisCurrentlyRunning: false,
      goToInteractive: false,
    };
  }

  clearPreviousRun = () => {
    // called on modal enter
    this.setState({
      submissionResponse: undefined,
      goToInteractive: false,
    });
  };

  initDropdowns = () => {
    const { getVectorCatalogApi } = this.context;
    getRootOptionsAsPath("continuous", getVectorCatalogApi).then(
      (path: Array<OptionsInfoSelected>) => {
        const [dropdowns] = formatPathToDropdown(path);
        this.setState({
          continuousRootDropdowns: dropdowns,
        });
      }
    );
  };

  componentDidUpdate(props: CustomAnalysesPageProps) {
    if (props.updateReactLoadStatus) {
      props.updateReactLoadStatus();
    }
  }

  componentDidMount = () => {
    const { analysisType } = this.state;
    this.clearPreviousRun();
    if (analysisType && this.queryComponents[analysisType]) {
      // onEnter first fires with no query component rendered yet, just the analysis select
      this.queryComponents[analysisType].setStatesFromProps();
    }

    this.api
      .getCellLineSelectorLines()
      .then((cellLines: CellLineSelectorLines) => {
        this.setState({
          cellLineData: loadCellLines(cellLines),
        });
      })
      .then(() => this.initDropdowns())
      .then(() =>
        this.api.getDatasets().then((availableDatasets: Dataset[]) => {
          this.setState({
            datasets: availableDatasets,
          });
        })
      );
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
                  getTaskStatus={(taskId: string) =>
                    this.api.getTaskStatus(taskId)
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
    const { launchCellLineSelectorModal } = this.props;
    const {
      analysisType,
      cellLineData,
      datasets,
      continuousRootDropdowns,
      goToInteractive,
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
              launchCellLineSelectorModal={launchCellLineSelectorModal}
              analysisType={analysisType} // only used for association and pearson
              renderBodyFooter={this.renderBodyFooter}
              sendQueryGeneric={this.sendQueryGeneric}
              onSuccessGeneric={this.onSuccessGeneric}
              queryInfo={{
                cellLineData: cellLineData || new Map(),
                datasets: datasets || [],
                xDropdowns: continuousRootDropdowns,
                yDropdowns: continuousRootDropdowns,
              }}
              onAssociationResultsComplete={(
                numCellLinesUsed: number,
                result: ComputeResponseResult,
                queryVectorId: string,
                overrideColorState: string,
                overrideFilterState: string,
                analysis: AnalysisType
              ) => {
                const controlledPlotState: Partial<ControlledPlotState> = {
                  numCellLinesUsed,
                  showingCustomAnalysis: true,
                  queryVectorId,
                  customAnalysisResult:
                    {
                      result,
                      type: analysis,
                    } || undefined,
                  override: {
                    // get rid of any previous overrides, unless specified later
                    color: overrideColorState,
                    filter: overrideFilterState,
                  },
                  queryLimit: 1000,
                };
                this.setState({
                  customAnalysisResults: controlledPlotState,
                  goToInteractive: true,
                });
              }}
              customAnalysisVectorDefault={continuousRootDropdowns}
              ref={(el) => {
                this.queryComponents[analysisType] = el;
              }}
            />
          )}
          {goToInteractive && customAnalysisResults && (
            <NavigateWithResults results={customAnalysisResults} />
          )}
        </div>
        {enabledFeatures.data_explorer_2 && (
          <ResultsReadyModal
            results={customAnalysisResults}
            analysisType={analysisType}
            queryComponents={this.queryComponents}
          />
        )}
      </div>
    );
  }
}
