/* eslint-disable */
export class Filter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  filterData(data: any[], colId: string) {
    return data;
  }

  getFilterParam(): any {
    return null;
  }
}

export class CharacterFilter extends Filter {
  private filterString: string;

  constructor(filterString: string) {
    super();
    this.filterString = filterString;
  }

  filterData(data: any[], colId: string) {
    return data.filter((row: any) =>
      (row[colId] || "")
        .toString()
        .toLowerCase()
        .includes(this.filterString.toLocaleLowerCase())
    );
  }

  getFilterParam() {
    return this.filterString;
  }
}

export class CategoricalFilter extends Filter {
  private filterCategories: Set<string>;

  constructor(filterCategories: Set<string>) {
    super();
    this.filterCategories = filterCategories;
  }

  filterData(data: any[], colId: string) {
    return data.filter(
      (row: any) => row && this.filterCategories.has(String(row[colId]))
    );
  }

  getFilterParam() {
    return this.filterCategories;
  }
}

export class ContinuousFilter extends Filter {
  private minVal: number;

  private maxVal: number;

  private excludeNAs: boolean;

  constructor(minVal: number, maxVal: number, exludeNAs = false) {
    super();
    this.minVal = minVal;
    this.maxVal = maxVal;
    this.excludeNAs = exludeNAs;
  }

  filterData(data: any[], colId: string) {
    return data.filter(
      (row: any) =>
        row != null &&
        ((this.excludeNAs == true && row[colId] != null) ||
          this.excludeNAs == false) &&
        row[colId] >= this.minVal &&
        row[colId] <= this.maxVal
    );
  }

  getFilterParam() {
    return [this.minVal, this.maxVal];
  }

  isExcludingNAs() {
    return this.excludeNAs;
  }
}

export interface LongTableData {
  id?: string;

  [key: string]: any;
}

export interface BaseTableColumn {
  cellRenderer?: any;
  dataKey: string;
  frozen?: boolean;
  key: string;
  maxWidth: number;
  resizable: boolean;
  sortable: boolean;
  title: any;
  width: number;
}

export interface isSelectedRowParam {
  columns: Array<BaseTableColumn>;
  rowData: LongTableData;
  rowIndex: number;
}

export interface BaseTableSortBy {
  column?: BaseTableColumn;
  key: string;
  order: string;
}

export interface onRowClickParam {
  event: any;
  rowData: LongTableData;
  rowIndex: number;
  rowKey: any;
}

// todo:  get Celligner colors from Andrew
export const LongTableColors = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
];

export type ColumnType = "character" | "categorical" | "continuous";

export const inferColumnType = (column: any[]): ColumnType => {
  const columnWithoutNulls = column.filter((el) => {
    return el != null && el != "";
  });
  const numUniques = Array.from(new Set(columnWithoutNulls)).length;
  if (
    typeof columnWithoutNulls[0] === "string" &&
    numUniques < columnWithoutNulls.length * 0.95
  ) {
    // the * 0.95 allows for a little leeway in case there is one or two dupes (like two cell lines sharing the same display name)
    // second condition is to account for 1 and 0 being used as binary categories
    return "categorical";
  }
  if (typeof columnWithoutNulls[0] === "number") {
    return "continuous";
  }
  return "character";
};
