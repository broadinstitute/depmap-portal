import { CeleryTask } from "./celery";

export type AssociationOrPearsonAnalysisType = "association" | "pearson";
export type AnalysisType = AssociationOrPearsonAnalysisType | "two_class";
export type VariableType = "dependent" | "independent";

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
