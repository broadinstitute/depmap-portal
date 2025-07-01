import { CeleryTask } from "./celery";

export type AssociationOrPearsonAnalysisType = "association" | "pearson";
export type AnalysisType = AssociationOrPearsonAnalysisType | "two_class";
export type VariableType = "dependent" | "independent";

export type SelectNSOption = {
  label: string;
  value: string;
};

export type QuerySelections = {
  // these numbers refer to positions in the model grid
  //    1  2
  // 3  4  5

  1: React.ReactNode;
  2?: React.ReactNode;
  3: React.ReactNode;
  4?: React.ReactNode;
  5?: React.ReactNode;
};

export interface UnivariateAssociationsParams {
  analysisType: AnalysisType;
  datasetId: string;
  queryId?: string;
  vectorVariableType?: VariableType;
  queryCellLines: ReadonlyArray<string> | null; // technically optional on the back end if type is association, but the front end always has this property (even if the value may be null)
  queryValues?: ReadonlyArray<string | number>;
}

type UrlEncodedString = string;

export interface ComputeResponseResult {
  taskId: string;
  entityType: string;
  queryValues?: Array<number | string>; // not used in all analyses types
  queryCellLines?: Array<string>;
  numCellLinesUsed: number;
  colorSliceId?: UrlEncodedString; // not used in all analyses types
  filterSliceId: UrlEncodedString;
  data: Array<ComputeResponseRow>;
  totalRows: number;
  analysisType: AnalysisType;
}

export interface ComputeResponseRow {
  label: string;
  EffectSize?: number; // only used in association and two class
  Cor?: number; // only for pearson #
  PValue: number;
  QValue: number;
  numCellLines: number;
  vectorId: UrlEncodedString;
  annotatedTarget?: string;
}

export interface ComputeResponse extends CeleryTask {
  result: ComputeResponseResult; // not returned if the job failed
}

export interface CommonQueryProps {
  analysisType: AnalysisType; // only used for association and pearson
  renderBodyFooter: (
    querySelections: QuerySelections,
    queryIsValid: boolean,
    sendQuery: () => void
  ) => React.ReactNode;
  sendQueryGeneric: (
    runCustomAnalysis: () => Promise<ComputeResponse>,
    onSuccess: (
      response: ComputeResponse,
      onResultsComplete?: (response: ComputeResponse) => void
    ) => void
  ) => void;
  onSuccessGeneric: (
    response: ComputeResponse,
    onResultsComplete: (response: any) => void
  ) => void;
  queryInfo: {
    cellLineData: Map<string, { displayName: string }>; // map with key = depmapId
    datasets: Array<SelectNSOption>;
  };
  onAssociationResultsComplete: (
    numCellLinesUsed: number,
    result: ComputeResponseResult,
    queryVectorId: string,
    overrideColorState: string,
    overrideFilterState: string,
    analysisType: AnalysisType
  ) => void;
  launchCellLineSelectorModal: () => void;
}
