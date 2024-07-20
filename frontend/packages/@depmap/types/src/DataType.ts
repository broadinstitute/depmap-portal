export default interface DataType {
  name: string;
}

export interface InvalidPrioritiesByDataType {
  [data_type: string]: number[];
}
