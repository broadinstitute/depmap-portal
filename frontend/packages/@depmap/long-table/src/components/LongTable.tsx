/* eslint-disable */
import * as React from "react";
import BaseTable, {
  Column,
  SortOrder as SortOrderType,
  AutoResizer,
  ColumnShape,
} from "react-base-table";
import "react-base-table/styles.css";
import update from "immutability-helper";
import { Modal, Button, Popover, OverlayTrigger } from "react-bootstrap";
import * as ReactCSV from "react-csv";
import {
  CharacterFilter,
  CategoricalFilter,
  ContinuousFilter,
  BaseTableSortBy,
  BaseTableColumn,
  onRowClickParam,
  isSelectedRowParam,
  LongTableColors,
  ColumnType,
  LongTableData,
  inferColumnType,
} from "../models/longTable";
import {
  Histogram,
  Histoslider,
  StackedBar,
  StackedBarBar,
} from "@depmap/common-components";
import isEqual from "lodash.isequal";
import "../styles/LongTable.scss";

const SortOrder = {
  ASC: "asc",
  DESC: "desc",
};

export type CustomCellRendererInputs = {
  cellData: any;
  columns: Array<any>;
  column: any;
  columnIndex: number;
  rowData: any;
  rowIndex: number;
  container: any;
  isScrolling: boolean;
};

export interface LongTableColumn {
  key: string;

  displayName?: string;

  type?: ColumnType;

  width?: number;

  numberFormatFunction?: (num: number) => any; // only used if column is continuous

  colorMap?: Map<string, string>; // only used if column is categorical

  helperText?: React.ReactNode;

  cellRenderer?: (inputs: CustomCellRendererInputs) => React.ReactNode;
}

export interface LongTableProps {
  dataFromProps: LongTableData[];
  columns?: LongTableColumn[]; // the user can speficy the order of the columns in LongTable via ordering of LongTableColumn in this prop

  addCheckboxes?: boolean;
  onCheckboxClick?: (selectedCellLinse: Set<string>) => void; // should only be defined if addCheckboxes is true
  defaultChecked?: ReadonlySet<string>;

  onFilterChange?: (visibleRows: string[]) => void;
  idCol?: string; // needed if addCheckboxes is true or if onFilterChange is true

  onColumnDelete?: (key: string) => void;
  undeleteableCols?: string[]; // only used if onColumnDelete is defined
  frozenCols?: string[];
  hiddenCols?: string[];
  defaultSort?: { col: string; order: SortingOrder };
  disableDownload?: boolean;
  // If download is not disabled, download all columns (i.e. including hidden columns)
  downloadAllColumns?: boolean;
  disableFiltering?: boolean;
  downloadCsvName?: string;

  onRowClick?: (row: onRowClickParam) => any;
  // pass isSelectedRow to define what rows should have css indicating that they are selected. note the boolean return.
  isSelectedRow?: (row: isSelectedRowParam) => boolean;

  additionalComponents?: any;

  overrideOrAdditionalBaseTableProps?: Record<string, any>;
}

const longTableCheckboxColumnName = "LongTable-checkbox";
export type SortingOrder = "ASC" | "DESC";

export interface LongTableState {
  sortBy: BaseTableSortBy; // a BaseTable thing - indicates how the table should be sorted
  checkboxMap: ReadonlyMap<string, boolean>; // maps a row ID to a boolean representing whether or not the checkbox should be checked=
  filters: ReadonlyMap<
    string,
    CharacterFilter | CategoricalFilter | ContinuousFilter
  >; // maps column key to the filter applied to that column
  columnToFilter?: string; // which column is currently having a filter defined for it in the modal (categorical and continuous columns only)
  lastSelectedRow?: string;
  defaultCategoricalSelection?: string[];

  customSortOrder?: Map<string, number>; // this is to specify a custom sort order for the rows, map id to index.
  // It's currently set when the table is set to sort by checkbox status and the user clicks a checkbox, so customSortOrder contains a list of row id's to represent the order of rows at that moment
  // (this is done to prevent the rows from being re-sorted and shifted around when the user is sorting by checkbox status and clicks on a checkbox)
}

export class LongTable extends React.Component<LongTableProps, LongTableState> {
  private selectTable: any = null; // this is so that we can force the table to scroll horizontally to the left when a new column is added

  private textCanvas: any = null; // this is so that we can measure the pixel length of a string in order to resize column width appropriately

  constructor(props: LongTableProps) {
    super(props);
    this.selectTable = React.createRef();
    this.textCanvas = React.createRef();
    const defaultSort = this.getSortByFromPropsDefaultSort(props);

    const checkboxMap = this.props.addCheckboxes
      ? this.makeCheckboxMap(
          this.props.dataFromProps,
          this.props.defaultChecked
        )
      : new Map();

    this.state = {
      sortBy: defaultSort,
      checkboxMap,
      filters: new Map<
        string,
        CharacterFilter | CategoricalFilter | ContinuousFilter
      >(),
      columnToFilter: undefined,
      lastSelectedRow: undefined,
      customSortOrder: undefined,
      defaultCategoricalSelection: undefined,
    };
  }

  textInputs: { [key: string]: any } = {}; // refs for text input filters so that we can clear them when the user clicks the "remove all filters" button

  colorMap: Map<string, Map<string, string>> = new Map<
    string,
    Map<string, string>
  >();

  componentDidUpdate(prevProps: LongTableProps) {
    if (
      prevProps != this.props &&
      prevProps.dataFromProps[0] &&
      this.props.dataFromProps[0]
    ) {
      if (
        Object.keys(prevProps.dataFromProps[0]).length <
        Object.keys(this.props.dataFromProps[0]).length
      ) {
        this.selectTable.scrollToLeft(5000);
      }
    }
    if (prevProps.hiddenCols != this.props.hiddenCols) {
      this.props.hiddenCols?.forEach((col) => {
        if (this.state.filters.has(col)) {
          this.removeFilter(col);
        }
      });
    }
    if (!isEqual(prevProps.defaultSort, this.props.defaultSort)) {
      this.setState({
        sortBy: this.getSortByFromPropsDefaultSort(this.props),
      });
    }
  }

  getSortByFromPropsDefaultSort(props: LongTableProps) {
    return props.defaultSort
      ? {
          key:
            props.defaultSort.col == "checkbox"
              ? longTableCheckboxColumnName
              : props.defaultSort.col,
          order:
            props.defaultSort.order == "ASC" ? SortOrder.ASC : SortOrder.DESC,
        }
      : { key: "", order: SortOrder.ASC };
  }

  getHiddenCols() {
    // creating a new set isn't great if the component is pure
    // but hey, don't worry about performance
    const hiddenCols = new Set(this.props.hiddenCols);
    // "id" is needed by BaseTable only, so we should hide this column
    hiddenCols.add("id");
    return hiddenCols;
  }

  getundeleteableCols = () => {
    const undeleteableCols = new Set(this.props.undeleteableCols);
    undeleteableCols.add(longTableCheckboxColumnName);
    return undeleteableCols;
  };

  getFrozenCols = () => {
    const frozenCols = new Set(this.props.frozenCols);
    frozenCols.add(longTableCheckboxColumnName);
    return frozenCols;
  };

  makeCheckboxMap(data: LongTableData[], defaultChecked?: ReadonlySet<string>) {
    const checkboxMap = new Map<string, boolean>();
    if (this.props.idCol) {
      for (let i = 0; i < data.length; i++) {
        if (defaultChecked && defaultChecked.has(data[i][this.props.idCol])) {
          checkboxMap.set(data[i][this.props.idCol], true);
        } else {
          checkboxMap.set(data[i][this.props.idCol], false);
        }
      }
    }
    return checkboxMap;
  }

  getInfoForStackedBar = (columnKey: string, column: string[]) => {
    const valuesAndCounts: any = {};
    for (let i = 0; i < column.length; i++) {
      valuesAndCounts[column[i]] = 1 + (valuesAndCounts[column[i]] || 0);
    }
    const counts = Object.values(valuesAndCounts) as number[];
    const labels = Object.keys(valuesAndCounts);
    const barProps: StackedBarBar[] = [];
    for (let i = 0; i < labels.length; i++) {
      barProps.push({
        count: counts[i],
        label: labels[i],
        color: this.getColor(columnKey, labels[i]),
      });
    }
    return barProps;
  };

  getColor = (columnKey: string, category: string): string => {
    const colFromProps = this.props.columns?.find((col) => {
      return col.key == columnKey;
    });
    if (category.toLowerCase() == "unknown") {
      return "#dedede";
    }
    if (category == "" || category == null || category == "null") {
      return "#eeeeee";
    }
    if (
      colFromProps &&
      colFromProps.colorMap &&
      colFromProps.colorMap.has(category)
    ) {
      return colFromProps.colorMap.get(category) as string;
    }
    if (this.colorMap.has(columnKey)) {
      const colorMapForColumn = this.colorMap.get(columnKey);
      if (colorMapForColumn) {
        if (colorMapForColumn.has(category)) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return this.colorMap.get(columnKey)!.get(category) as string;
        }
        const color =
          LongTableColors[
            Array.from(colorMapForColumn.entries()).length %
              LongTableColors.length
          ];
        colorMapForColumn.set(category, color);
        return color;
      }
    }
    this.colorMap.set(
      columnKey,
      new Map<string, string>([[category, LongTableColors[0]]])
    );
    return LongTableColors[0];
  };

  get_text_width(str: string): number {
    const font = "13px lato, sans-serif";
    const canvas = this.textCanvas;
    if (canvas) {
      const context = canvas.getContext("2d");
      context.font = font;
      const metrics = context.measureText(str);
      return metrics.width;
    }
    return 150; // just in case canvas fails to render or something
  }

  getColumnWidth(
    // take either length of header text or the the 3rd quartile of cell lengths as the column length, whichever is longer
    columnKey: string,
    headerText: string,
    subsettedData: [] | ReadonlyArray<any>
  ): number {
    let headerWidth = this.get_text_width(headerText) + 50;
    const hasDeleteButton =
      this.props.onColumnDelete &&
      !this.getundeleteableCols().has(columnKey) &&
      this.props.idCol != columnKey;
    if (hasDeleteButton) {
      headerWidth += 20;
    }

    const numEntriesToUse = Math.floor(subsettedData.length / 4);
    if (numEntriesToUse > 0) {
      const cellWidths: number[] = [];
      // Get max length using size of string in pixels
      for (let i = 0; i < subsettedData.length; i++) {
        if (
          subsettedData[i] != undefined &&
          subsettedData[i][columnKey] != null
        ) {
          const str = subsettedData[i][columnKey];
          cellWidths.push(this.get_text_width(str));
        }
      }
      const sorted = cellWidths.sort((a, b) => {
        return b - a;
      });
      const quartile = sorted[numEntriesToUse];
      if (quartile) {
        return Math.max(quartile, headerWidth);
      }
    }
    return headerWidth;
  }

  processData = (rawData: LongTableData[]) => {
    const { checkboxMap } = this.state;
    const { addCheckboxes } = this.props;
    // append id and checkbox fields
    const { idCol } = this.props;
    return rawData.map((el: LongTableData, index: number) => {
      const appendedFields: any = {};
      appendedFields.id = idCol ? el[idCol] : index; // the "id" property is necessary for BaseTable, so we add it here

      if (addCheckboxes && idCol) {
        const value = checkboxMap.get(el[idCol])?.toString();
        if (value) {
          appendedFields[longTableCheckboxColumnName] = value;
        }
      }

      return Object.assign(appendedFields, el);
    });
  };

  getColType = (data: LongTableData[], colKey: string): ColumnType => {
    if (this.props.columns) {
      const colFromProps = this.props.columns.find((col) => {
        return col.key == colKey;
      });
      if (colFromProps && colFromProps.type) {
        return colFromProps.type;
      }
    }
    return inferColumnType(this.getColumn(data, colKey));
  };

  getFrozenRows = (
    processedAndSortedAndFilteredData: ReadonlyArray<LongTableData>
  ) => {
    const frozenRowFromData: any = {
      ...processedAndSortedAndFilteredData[0],
    };
    const columnKeys = Object.keys(processedAndSortedAndFilteredData[0]);
    for (let i = 0; i < columnKeys.length; i++) {
      // this basically determines if a column is a character column, a categorical column, or a continuous column and assigns the appropriate visualization/filter to it

      const columnData = processedAndSortedAndFilteredData.map((element) => {
        return element[columnKeys[i]];
      });
      const columnType = this.getColType(
        this.props.dataFromProps,
        columnKeys[i]
      );
      const filteredClass: string = this.state.filters.has(columnKeys[i])
        ? "filtered"
        : "";

      if (columnType == "categorical") {
        // if a column is categorical, we need a stacked bar plot, which will be added later

        frozenRowFromData[columnKeys[i]] = (
          <div
            key={`frozen-${columnKeys[i]}`}
            className={`baseTableHeaderVis stackedBarWrapper ${filteredClass}`}
          >
            <StackedBar
              bars={this.getInfoForStackedBar(
                columnKeys[i],
                this.getColumn(processedAndSortedAndFilteredData, columnKeys[i])
              )}
              onBarClick={(clickedBar: string) => {
                this.setState({
                  columnToFilter: columnKeys[i],
                  defaultCategoricalSelection: [clickedBar],
                });
              }}
            />
          </div>
        );
      } else if (columnType == "continuous") {
        frozenRowFromData[columnKeys[i]] = (
          <div
            className={`baseTableHeaderVis histogramWrapper ${filteredClass}`}
            onClick={() => {
              this.setState({ columnToFilter: columnKeys[i] });
            }}
          >
            <Histogram data={columnData.filter((x) => x) /* remove nulls */} />
          </div>
        );
      } else {
        // if neither categorical nor continuous, the column must be a character column
        const filter = this.state.filters.get(columnKeys[i]);
        frozenRowFromData[columnKeys[i]] = (
          <input
            ref={(el) => (this.textInputs[columnKeys[i]] = el)}
            type="text"
            defaultValue={
              filter instanceof CharacterFilter ? filter.getFilterParam() : ""
            }
            className="textFilterWrapper"
            onChange={(event: any) => {
              this.onFilterChange(
                columnKeys[i],
                new CharacterFilter(event.target.value)
              );
            }}
          />
        );
      }
    }
    // determine which columns to make hover
    frozenRowFromData.id = "frozenRow"; // todo: address this please
    return [frozenRowFromData];
  };

  getColumns = (
    processedAndSortedAndFilteredData: ReadonlyArray<LongTableData>,
    tableWidth: number
  ) => {
    let columnKeys = Object.keys(processedAndSortedAndFilteredData[0]);

    if (this.props.columns) {
      const colOrderFromProps = this.props.columns.map((col) => {
        return col.key;
      });
      const merged = colOrderFromProps.concat(columnKeys);
      if (this.props.addCheckboxes) {
        merged.unshift(longTableCheckboxColumnName);
      }
      columnKeys = merged.filter((item, pos) => merged.indexOf(item) === pos);
    }

    const columnsFromData: BaseTableColumn[] = [];

    for (let i = 0; i < columnKeys.length; i++) {
      if (!this.getHiddenCols().has(columnKeys[i])) {
        const columnType = this.getColType(
          this.props.dataFromProps,
          columnKeys[i]
        );

        let colFromProps: LongTableColumn | undefined;
        let columnTitle: string | null = columnKeys[i];
        if (this.props.columns) {
          colFromProps = this.props.columns.find((col) => {
            return col.key == columnKeys[i];
          });
          if (colFromProps && colFromProps.displayName) {
            columnTitle = colFromProps.displayName;
          }
        }
        let width: number | undefined;
        if (this.props.columns) {
          const col = this.props.columns.find((col) => {
            return col.key == columnKeys[i];
          });
          if (col && col.width) {
            width = col.width;
          }
        }
        if (width === undefined) {
          width = this.getColumnWidth(
            columnKeys[i],
            columnTitle,
            processedAndSortedAndFilteredData
          );
        }
        if (this.props.columns) {
          const col = this.props.columns.find((col) => {
            return col.key == columnKeys[i];
          });
          if (col && col.helperText) {
            width += 20;
          }
        }
        if (columnKeys[i] == longTableCheckboxColumnName) {
          width = 45;
          columnTitle = null;
        }
        let frozen;
        let cellRenderer = colFromProps && colFromProps.cellRenderer;
        if (this.getFrozenCols().has(columnKeys[i])) {
          frozen = Column.FrozenDirection.LEFT;
        }
        if (columnKeys[i] == longTableCheckboxColumnName) {
          cellRenderer = this.checkboxRenderer;
        } else if (columnType == "categorical") {
          cellRenderer = this.categoricalCellRenderer;
        } else if (columnType == "continuous") {
          const filteredColData = this.getColumn(
            processedAndSortedAndFilteredData,
            columnKeys[i]
          );

          const colWithoutNulls = filteredColData.filter((x) => {
            return x != null;
          });

          const absFilteredColData = colWithoutNulls.map((x) => {
            return Math.abs(x);
          });
          const absMin = Math.min(...absFilteredColData);
          const absMax = Math.max(...absFilteredColData);
          cellRenderer = (cell: any) =>
            this.continuousCellRenderer(cell, absMin, absMax, columnKeys[i]);
        }
        columnsFromData.push({
          dataKey: columnKeys[i],
          key: columnKeys[i],
          maxWidth: tableWidth,
          resizable: true,
          sortable: true,
          title: columnTitle,
          width,
          frozen: frozen as any,
          cellRenderer,
        });
      }
    }

    // adjust column widths to fill remaining space if needed
    const sumOfWidths = columnsFromData.reduce((a, b) => a + (b.width || 0), 0);
    if (sumOfWidths < tableWidth) {
      columnsFromData.forEach((column) => {
        if (column.key != longTableCheckboxColumnName) {
          column.width = (column.width / sumOfWidths) * tableWidth;
        }
      });
    }
    return columnsFromData;
  };

  addHeaderArrows(colKey: string) {
    let upArrowClass = "";
    let downArrowClass = "";
    if (this.state.sortBy.key == colKey) {
      if (this.state.sortBy.order == SortOrder.ASC) {
        upArrowClass = "sortArrowActive";
      } else {
        downArrowClass = "sortArrowActive";
      }
    }

    return (
      <div key={`sort-${colKey}`} className="sortIcon">
        <span className={`glyphicon glyphicon-triangle-top ${upArrowClass}`} />
        <span
          className={`glyphicon glyphicon-triangle-bottom ${downArrowClass}`}
        />
      </div>
    );
  }

  addHelperText(colKey: string) {
    if (!this.props.columns) {
      return null;
    }

    const col = this.props.columns.find((col) => col.key == colKey);
    if (!col || !col.helperText) {
      return null;
    }

    const helpPopover = (
      <Popover
        id={`popover-col-helper-text-${colKey}`}
        // title={columnTitle}
      >
        {col.helperText}
      </Popover>
    );

    return (
      <OverlayTrigger
        trigger={["hover", "focus"]}
        placement="top"
        delayHide={500}
        overlay={helpPopover}
      >
        <span
          className="glyphicon glyphicon-question-sign"
          style={{ marginInlineStart: 8 }}
        />
      </OverlayTrigger>
    );
  }

  renderTableHeaderCell = ({
    column,
  }: {
    className: string;
    column: BaseTableColumn;
  }) => {
    const columnKey = column.dataKey;
    const hasDeleteButton =
      this.props.onColumnDelete &&
      !this.getundeleteableCols().has(columnKey) &&
      this.props.idCol != columnKey;

    const extraButtonElements: any[] = [];

    if (hasDeleteButton) {
      extraButtonElements.push(
        <span
          key={`delete-${columnKey}`}
          className="glyphicon glyphicon-remove columnRemoveIcon"
          onClick={(event) => {
            event.stopPropagation();
            this.removeFilter(columnKey);
            this.props.onColumnDelete?.(columnKey);
          }}
        />
      );
    }

    if (columnKey != longTableCheckboxColumnName) {
      const className: string = this.state.filters.has(columnKey)
        ? "columnFilterIconActive"
        : "columnFilterIcon";
      extraButtonElements.unshift(
        <span
          key={`filter-${columnKey}`}
          className={`glyphicon glyphicon-filter ${className}`}
          onClick={(event) => {
            event.stopPropagation();
            if (this.state.filters.has(columnKey)) {
              this.removeFilter(columnKey);
            } else {
              this.setState({ columnToFilter: columnKey });
            }
          }}
        />
      );
    }

    extraButtonElements.unshift(this.addHeaderArrows(columnKey));
    const helperText = this.addHelperText(columnKey);
    const floatClass = extraButtonElements.length > 1 ? "floatRight" : "";
    return (
      <div className="longTableHeader">
        {column.title}
        {helperText}
        <div className={`columnControlsContainer ${floatClass}`}>
          {extraButtonElements}
        </div>
      </div>
    );
  };

  getColumn = (data: ReadonlyArray<any>, colId: string) => {
    return data.map((row) => row[colId]);
  };

  checkboxRenderer = (row: any) => {
    const proccessedAndSortedAndFilteredData = this.sortDatabyColumn(
      this.filterData(
        this.processData(this.props.dataFromProps),
        this.state.filters
      ),
      this.state.sortBy
    );
    if (row.rowData.id != null) {
      // this check is so that we don't render a checkbox when displaying the "no results found" message
      if (row.rowData.id == "frozenRow") {
        // this renders the "check all/uncheck all" checkbox
        return (
          <input
            style={{ cursor: "pointer" }}
            type="checkbox"
            checked={this.areAllChecked(proccessedAndSortedAndFilteredData)}
            onChange={() => undefined}
            onClick={() => {
              this.checkUncheckAll(proccessedAndSortedAndFilteredData);
            }}
          />
        );
      }
      // this renders the regular checkboxes you see on eZvery row
      return (
        <input
          type="checkbox"
          style={{ cursor: "pointer" }}
          checked={this.state.checkboxMap.get(row.rowData.id) == true}
          onChange={() => undefined}
          onClick={(e: any) => {
            this.onCheckboxClick(
              e,
              row.rowData.id,
              proccessedAndSortedAndFilteredData
            );
          }}
        />
      );
    }
    return null;
  };

  areAllChecked = (
    proccessedAndSortedAndFilteredData: ReadonlyArray<LongTableData>
  ) => {
    const valuesSansDuplicates: Set<boolean> = new Set();

    proccessedAndSortedAndFilteredData.forEach((row) => {
      if (
        this.props.idCol &&
        this.state.checkboxMap.has(row[this.props.idCol])
      ) {
        valuesSansDuplicates.add(
          this.state.checkboxMap.get(row[this.props.idCol]) as boolean
        );
      }
    });
    // let valuesSansDuplicates: Set<boolean> = new Set(this.state.checkboxMap.values());
    return valuesSansDuplicates.size == 1 && valuesSansDuplicates.has(true);
  };

  checkUncheckAll = (
    proccessedAndSortedAndFilteredData: ReadonlyArray<LongTableData>
  ) => {
    const areAllCurrentlyChecked = this.areAllChecked(
      proccessedAndSortedAndFilteredData
    );

    // get entries of map, which are of the form [checkboxKey, boolean]
    // only look at entries for visible rows in the table
    // find all keys where the boolean values == the state of the check/uncheck all box
    const visibleCellLineIds = new Set(
      proccessedAndSortedAndFilteredData.map(
        (row) => row[this.props.idCol as string]
      )
    );
    const rowKeysOfCheckBoxesThatNeedUpdate = [
      ...this.state.checkboxMap.entries(),
    ]
      .filter(({ 0: key }) => visibleCellLineIds.has(key))
      .filter(({ 1: boolVal }) => boolVal === areAllCurrentlyChecked)
      .map(([k]) => k);

    const checkboxUpdatedStates: [string, boolean][] = [];
    rowKeysOfCheckBoxesThatNeedUpdate.forEach((key: string) => {
      checkboxUpdatedStates.push([key, !areAllCurrentlyChecked]);
    });
    const newCheckboxMap = update(this.state.checkboxMap, {
      $add: checkboxUpdatedStates,
    });

    if (newCheckboxMap) {
      this.onCheckboxMapUpdate(newCheckboxMap);
      this.setState({
        checkboxMap: newCheckboxMap,
        // visibleData: newData
      });
    }
  };

  onCheckboxMapUpdate = (updatedCheckboxMap: ReadonlyMap<string, boolean>) => {
    if (this.props.onCheckboxClick) {
      this.props.onCheckboxClick(
        new Set(
          Array.from(updatedCheckboxMap.entries())
            .filter((pair) => {
              return pair[1] == true;
            })
            .map((item) => item[0])
        )
      );
    }
  };

  onCheckboxClick = (
    e: any,
    id: string,
    processedAndSortedAndFilteredData: ReadonlyArray<LongTableData>
  ) => {
    const newSelectionStatus = !this.state.checkboxMap.get(id);
    // let index = this.state.visibleData.findIndex(row => row.id == id);

    let sort: BaseTableSortBy;
    if (this.state.sortBy.key == longTableCheckboxColumnName) {
      sort = { key: "", order: "custom" };
      const map: Map<string, number> = new Map();
      processedAndSortedAndFilteredData.forEach((row, index) => {
        if (row.id) {
          map.set(row.id, index);
        }
      });
      this.setState({
        customSortOrder: map,
      });
    } else {
      sort = this.state.sortBy;
    }
    let valuesToUpdate = [id];
    // if this was a shift click, get all the lines between this click and the previous one
    // then, set the state to be the same as the checkbox you just clivked
    if (e.shiftKey && this.state.lastSelectedRow !== null) {
      const indexCurrentClick = processedAndSortedAndFilteredData.findIndex(
        (p: LongTableData) => p.id == id
      );
      const indexPreviousClick = processedAndSortedAndFilteredData.findIndex(
        (p: LongTableData) => p.id == this.state.lastSelectedRow
      );
      if (indexCurrentClick > -1 && indexPreviousClick > -1) {
        const selectedRows = processedAndSortedAndFilteredData.slice(
          Math.min(indexPreviousClick, indexCurrentClick),
          Math.max(indexPreviousClick, indexCurrentClick) + 1
        );
        const selectedRowIds = selectedRows.map((row: LongTableData) => row.id);
        valuesToUpdate = valuesToUpdate.concat(selectedRowIds as any);
      }
    }
    const newCheckboxMap = update(this.state.checkboxMap, {
      $add: valuesToUpdate.map((id: string) => [id, newSelectionStatus]) as any,
    });
    this.onCheckboxMapUpdate(newCheckboxMap);
    this.setState({
      checkboxMap: newCheckboxMap,
      lastSelectedRow: id,
      sortBy: sort,
    });
  };

  categoricalCellRenderer = (cell: any) => {
    const { cellData } = cell;
    if (typeof cellData === "string" || typeof cellData === "number") {
      if (cell.cellData == "" || cell.cellData == null) {
        return null;
      }
      const colKey = cell.column.dataKey;
      const color = this.getColor(colKey, cell.cellData.toString());
      return (
        <div
          className="categoricalCell"
          style={{
            borderLeftColor: color,
          }}
        >
          {cell.cellData}
        </div>
      );
    }
    return cellData === undefined ? "" : cellData;
  };

  continuousCellRenderer = (
    cell: any,
    absMin: number,
    absMax: number,
    colKey: string
  ) => {
    let numFormatFunction = (num: number) => {
      if (num.toString().length > 3) return num.toPrecision(3);

      return num;
    };
    if (this.props.columns) {
      const col = this.props.columns.find((col) => {
        return col.key == colKey;
      });
      if (col && col.numberFormatFunction) {
        numFormatFunction = col.numberFormatFunction;
      }
    }

    if (
      typeof cell.cellData === "string" ||
      typeof cell.cellData === "number"
    ) {
      const num = +cell.cellData;
      const proportion = (Math.abs(num) - absMin) / (absMax - absMin);

      const style: any =
        num > 0 // positive
          ? {
              width: `${proportion * 100}%`,
              backgroundColor: "#efcecb",
              left: 0,
            }
          : {
              // negative
              width: `${proportion * 100}%`,
              backgroundColor: "#dce5ff",
              right: 0,
            };

      return (
        <div className="continuousCellWrapper">
          <div className="continuousCellBar" style={style}>
            {" "}
          </div>
          <div className="continuousCellData">{numFormatFunction(num)}</div>
        </div>
      );
    }
    return cell.cellData === undefined ? "" : cell.cellData;
  };

  sortDatabyColumn = (
    data: ReadonlyArray<LongTableData>,
    sort: BaseTableSortBy
  ): ReadonlyArray<LongTableData> => {
    if (sort && sort.order != "custom") {
      return data.concat().sort((a, b) => {
        // equal items sort equally
        if (a[sort.key] === b[sort.key]) {
          return 0;
        }
        // nulls sort after anything else
        if (a[sort.key] === null || a[sort.key] == "") {
          return 1;
        }
        if (b[sort.key] === null || b[sort.key] == "") {
          return -1;
        }
        // otherwise, if we're ascending, lowest sorts first
        if (sort.order == SortOrder.ASC) {
          return a[sort.key] < b[sort.key] ? -1 : 1;
        }
        // if descending, highest sorts first

        return a[sort.key] < b[sort.key] ? 1 : -1;
      });
    }
    if (sort && sort.order == "custom") {
      const { customSortOrder } = this.state;
      if (customSortOrder) {
        return data.concat().sort((a, b) => {
          const indexA = a.id ? customSortOrder.get(a.id) : undefined;
          const indexB = b.id ? customSortOrder.get(b.id) : undefined;
          if (indexA === undefined) {
            return 1;
          }
          if (indexB === undefined) {
            return -1;
          }
          if (indexA < indexB) {
            return -1;
          }
          if (indexA > indexB) {
            return 1;
          }
          return 0;
        });
      }
    }
    return data;
  };

  onFilterChange = (
    colId: string,
    filterParam: CharacterFilter | CategoricalFilter | ContinuousFilter | null
  ) => {
    let newFilterMap: ReadonlyMap<
      string,
      CharacterFilter | CategoricalFilter | ContinuousFilter
    >;

    if (
      filterParam == null ||
      (filterParam instanceof CharacterFilter &&
        filterParam.getFilterParam() == "")
    ) {
      newFilterMap = update(this.state.filters, {
        $remove: [colId],
      });
      if (this.textInputs[colId]) {
        this.textInputs[colId].value = "";
      }
    } else {
      newFilterMap = update(this.state.filters, {
        $add: [[colId, filterParam]],
      });
    }

    if (this.props.onFilterChange && this.props.idCol) {
      const processedAndSortedAndFilteredData = this.sortDatabyColumn(
        this.filterData(
          this.processData(this.props.dataFromProps),
          newFilterMap
        ),
        this.state.sortBy
      );
      this.props.onFilterChange(
        this.getColumn(
          Array.from(processedAndSortedAndFilteredData),
          this.props.idCol
        )
      );
    }

    this.setState({
      filters: newFilterMap,
    });
  };

  removeFilter = (colId: string) => {
    this.onFilterChange(colId, null);
  };

  // filters processedRawData based on what is stored in the filter map
  filterData = (
    dataToFilter: ReadonlyArray<LongTableData>,
    filterMap: ReadonlyMap<
      string,
      CharacterFilter | CategoricalFilter | ContinuousFilter
    >
  ) => {
    const keys = filterMap.keys();

    let filteredData = dataToFilter.slice(0);
    for (const colId of keys) {
      filteredData =
        filterMap.get(colId)?.filterData(filteredData, colId) || [];
    }
    if (filteredData.length > 0) {
      return filteredData;
    }
    // if visible data gets filtered down to nothing, show this
    const objKeys =
      dataToFilter && dataToFilter[0] ? Object.keys(dataToFilter[0]) : [];
    const nullRow: any = { id: "nullRow" };
    for (const k of objKeys) {
      nullRow[k] = null;
    }
    return [nullRow];
  };

  scrollToRow(rowIndex: number, how = "start") {
    this.selectTable.scrollToRow(rowIndex, how);
  }

  onColumnSort = (sortBy: BaseTableSortBy) => {
    this.setState({
      sortBy,
    });
  };

  rowClassNameHighlightSelected = (row: {
    columns: LongTableData[];
    rowData: LongTableData;
    rowIndex: number;
  }) => {
    /*
      This is to highlight rows that have been selected
        Uses this.props.isSelectedRow if defined
        Else, selects checked rows
    */
    let shouldHighlight = false;
    if (this.props.isSelectedRow) {
      shouldHighlight = this.props.isSelectedRow(row as isSelectedRowParam);
    } else if (this.state.checkboxMap) {
      shouldHighlight = row.rowData.id
        ? this.state.checkboxMap.get(row.rowData.id) === true
        : false;
    }

    if (shouldHighlight) {
      return "selectedRow";
    }
    return "";
  };

  closeFilterModal = () => {
    this.setState({
      columnToFilter: undefined,
      defaultCategoricalSelection: undefined,
    });
  };

  renderCategoricalFilterModal = (
    columnKey: string,
    defaultSelected?: string[]
  ) => {
    const columnUnfiltered = this.props.dataFromProps.map((element) => {
      return element[columnKey];
    });
    const allCategoriesInColumn = Array.from(new Set<string>(columnUnfiltered));
    let defaultChecked: string[];
    const filter = this.state.filters.get(columnKey);
    if (defaultSelected) {
      defaultChecked = defaultSelected;
    } else if (filter && filter instanceof CategoricalFilter) {
      defaultChecked = Array.from(filter.getFilterParam());
    } else {
      defaultChecked = allCategoriesInColumn;
    }
    defaultChecked = defaultChecked.map(String);

    const valuesAndCounts: any = {};
    for (let i = 0; i < columnUnfiltered.length; i++) {
      valuesAndCounts[columnUnfiltered[i]] =
        1 + (valuesAndCounts[columnUnfiltered[i]] || 0);
    }
    const counts = Object.values(valuesAndCounts) as number[];
    const labels = Object.keys(valuesAndCounts);
    const categories: CategoricalValue[] = [];

    for (let i = 0; i < labels.length; i++) {
      const color = this.getColor(columnKey, labels[i]);
      categories.push({
        name: labels[i],
        occurrences: counts[i],
        color,
      });
    }

    return (
      <div>
        <Modal
          show={this.state.columnToFilter != null}
          onHide={this.closeFilterModal}
        >
          <Modal.Header closeButton>
            <Modal.Title>Filter column: {columnKey}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <CheckboxFilterComponent
              defaultChecked={defaultChecked}
              categories={categories}
              columnName={columnKey}
              onFiltersSave={(columnName: string, categories: string[]) => {
                categories.length == allCategoriesInColumn.length
                  ? this.removeFilter(columnName)
                  : this.onFilterChange(
                      columnName,
                      new CategoricalFilter(new Set<string>(categories))
                    );
                this.closeFilterModal();
              }}
            />
          </Modal.Body>
        </Modal>
      </div>
    );
  };

  renderContinuousFilterModal = (columnKey: string) => {
    const colData = this.getColumn(this.props.dataFromProps, columnKey);
    const colDataWithoutNulls = colData.filter((x) => x);
    let min: number = Math.min(...colDataWithoutNulls);
    let max: number = Math.max(...colDataWithoutNulls);
    let excludeNAs = false;

    const storedFilter = this.state.filters.get(columnKey);
    if (storedFilter && storedFilter instanceof ContinuousFilter) {
      min = storedFilter.getFilterParam()[0];
      max = storedFilter.getFilterParam()[1];
      excludeNAs = storedFilter.isExcludingNAs();
    }
    return (
      <div>
        <Modal
          show={this.state.columnToFilter != null}
          onHide={this.closeFilterModal}
        >
          <Modal.Header closeButton>
            <Modal.Title>Filter column: {columnKey}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div style={{ height: "150px", width: "100%" }}>
              <AutoResizer>
                {({ width, height }: { width: number; height: number }) => (
                  <Histoslider
                    width={width}
                    height={height}
                    rangeHandler={(a: number, b: number) => {
                      min = Math.min(a, b);
                      max = Math.max(a, b);
                    }}
                    defaultSelection={[min, max]}
                    rawNums={colData}
                  />
                )}
              </AutoResizer>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <label>
                <input
                  type="checkbox"
                  name="excludeNAs"
                  defaultChecked={excludeNAs}
                  onChange={() => undefined}
                  onClick={() => {
                    excludeNAs = !excludeNAs;
                  }}
                  style={{ marginRight: "5px", cursor: "pointer" }}
                />
                Exclude null values
              </label>
              <button
                type="button"
                disabled={false}
                onClick={() => {
                  // only add a filter if it actually has some sort of effect
                  const filter = new ContinuousFilter(min, max, excludeNAs);
                  filter.filterData(this.props.dataFromProps, columnKey)
                    .length == colData.length
                    ? this.removeFilter(columnKey)
                    : this.onFilterChange(columnKey, filter);
                  this.closeFilterModal();
                }}
                className="btn btn-default btn-sm"
              >
                Save
              </button>
            </div>
          </Modal.Footer>
        </Modal>
      </div>
    );
  };

  getCheckedShownAndHidden = (
    processedAndSortedAndFilteredData: ReadonlyArray<LongTableData>
  ) => {
    const checked = [...this.state.checkboxMap.entries()].filter(
      ({ 1: boolVal }) => boolVal === true
    );

    const allCheckedEntryIds = checked.map((entry) => {
      return entry[0];
    });
    const visibleCheckedEntries = processedAndSortedAndFilteredData
      .map((entry) => {
        return this.props.idCol ? entry[this.props.idCol] : undefined;
      })
      .filter((x) => allCheckedEntryIds.includes(x));
    const hiddenCheckedEntryIds = allCheckedEntryIds.filter((el) => {
      return visibleCheckedEntries.indexOf(el) < 0;
    });

    return {
      visible: visibleCheckedEntries,
      hidden: hiddenCheckedEntryIds,
    };
  };

  renderDownloadButton = (data: ReadonlyArray<any>) => {
    const filename = this.props.downloadCsvName
      ? this.props.downloadCsvName
      : "depmap_download.csv";

    const hiddenCols = Array.from(this.getHiddenCols());

    const dataToDownload = this.props.downloadAllColumns
      ? data
      : data.map((row) => {
          const copy = { ...row };
          hiddenCols.forEach((colKey) => {
            if (colKey != "depmapId") {
              delete copy[colKey];
            }
          });
          return copy;
        });

    return (
      <ReactCSV.CSVLink
        data={dataToDownload as any[]}
        filename={filename}
        className="glyphicon glyphicon-download-alt"
        target="_blank"
        style={{ paddingRight: "5px" }}
      />
    );
  };

  render() {
    const processedAndSortedAndFilteredData = this.sortDatabyColumn(
      this.filterData(
        this.processData(this.props.dataFromProps),
        this.state.filters
      ),
      this.state.sortBy
    );

    const frozenRowsFromData = this.getFrozenRows(
      processedAndSortedAndFilteredData
    );
    const TableHeaderCell = this.renderTableHeaderCell;
    const numTotalSelected = this.props.dataFromProps.length;
    const numShownSelected =
      processedAndSortedAndFilteredData.length != 1
        ? processedAndSortedAndFilteredData.length
        : processedAndSortedAndFilteredData[0].id == null
        ? 0
        : 1;
    const messageSelectedShown =
      numShownSelected < numTotalSelected
        ? `Showing ${numShownSelected}/${numTotalSelected} rows`
        : `${numTotalSelected} rows`;

    let messageCheckboxes = "";
    if (this.props.addCheckboxes) {
      const checkedShownAndHidden = this.getCheckedShownAndHidden(
        processedAndSortedAndFilteredData
      );
      const numCheckedShown = checkedShownAndHidden.visible.length;
      const numChecked =
        checkedShownAndHidden.visible.length +
        checkedShownAndHidden.hidden.length;
      messageCheckboxes =
        numCheckedShown < numChecked
          ? `(${numCheckedShown}/${numChecked} selected)`
          : `(${numChecked} selected)`;
    }

    let filterToShow: ColumnType | undefined;
    if (this.state.columnToFilter) {
      const colType = this.getColType(
        this.props.dataFromProps,
        this.state.columnToFilter
      );
      if (colType == "categorical") {
        filterToShow = "categorical";
      } else if (colType == "continuous") {
        filterToShow = "continuous";
      }
    }
    const downloadButton =
      this.props.disableDownload == true
        ? null
        : this.renderDownloadButton(processedAndSortedAndFilteredData);
    const components = this.props.additionalComponents
      ? { TableHeaderCell, ...this.props.additionalComponents }
      : { TableHeaderCell };

    let longTableClass = "longTable";
    if (this.props.onRowClick) {
      longTableClass += " longTableWithRowClick";
    }
    return (
      <div className={longTableClass}>
        <canvas
          style={{ position: "absolute", zIndex: -1 }}
          ref={(r) => {
            this.textCanvas = r;
          }}
        />

        <div className="baseTableWrapper">
          <AutoResizer>
            {({ width, height }: { width: number; height: number }) => (
              <BaseTable
                fixed
                key="baseTable"
                ref={(r: any) => {
                  this.selectTable = r;
                }}
                rowClassName={this.rowClassNameHighlightSelected}
                columns={this.getColumns(
                  processedAndSortedAndFilteredData,
                  width
                )}
                data={processedAndSortedAndFilteredData as any} // data needs a column named "id", as a key to distinguish siblings
                frozenData={frozenRowsFromData}
                sortBy={
                  this.state.sortBy.key != ""
                    ? (this.state.sortBy as any)
                    : { key: "", order: null }
                } // this is for the BaseTable's native sort arrows css.  Even though said css isn't being used, sortBy still needs to be passed in to get sorting to work
                onColumnSort={this.onColumnSort as any}
                width={width}
                height={height}
                components={components}
                rowHeight={30}
                rowEventHandlers={{
                  onClick: (row: onRowClickParam) => {
                    if (row.rowIndex >= 0 && this.props.onRowClick) {
                      this.props.onRowClick(row);
                    }
                  },
                }}
                // this must be at the bottom, so that it overrides the above props if a duplicate is provided
                {...this.props.overrideOrAdditionalBaseTableProps}
              />
            )}
          </AutoResizer>
        </div>
        <div className="longTableButtons">
          {downloadButton}
          <div style={{ padding: "5px" }}>
            {messageSelectedShown} {messageCheckboxes}
          </div>
          {this.state.filters.size > 0 && (
            <Button
              onClick={() => {
                const textInputKeys = Object.keys(this.textInputs);
                for (let i = 0; i < textInputKeys.length; i++) {
                  this.textInputs[textInputKeys[i]].value = "";
                }
                this.setState(
                  {
                    filters: new Map<
                      string,
                      CharacterFilter | CategoricalFilter | ContinuousFilter
                    >(),
                  },
                  () => {
                    if (this.props.onFilterChange) {
                      const processedAndSortedData = this.sortDatabyColumn(
                        this.props.dataFromProps,
                        this.state.sortBy
                      );
                      if (this.props.idCol) {
                        this.props.onFilterChange(
                          this.getColumn(
                            Array.from(processedAndSortedData),
                            this.props.idCol
                          )
                        );
                      }
                    }
                  }
                );
              }}
              className="btn btn-default btn-sm"
            >
              Clear all filters
            </Button>
          )}
        </div>

        {filterToShow == "categorical" &&
          this.state.columnToFilter &&
          this.renderCategoricalFilterModal(
            this.state.columnToFilter,
            this.state.defaultCategoricalSelection
          )}

        {filterToShow == "continuous" &&
          this.state.columnToFilter &&
          this.renderContinuousFilterModal(this.state.columnToFilter)}
      </div>
    );
  }
}

export interface VectorResponse {
  cellLines: string[]; // array of depmapIDs
  values?: number[];
  categoricalValues?: string[];
}

export interface Vector {
  cellLines: string[]; // array of depmapIDs
  values?: number[] | string[];
}

export interface CategoricalValue {
  name: string;
  occurrences: number;
  color: string;
}

export interface CheckboxFilterComponentProps {
  onFiltersSave: (columnName: string, categories: string[]) => void;
  columnName: string;
  categories: CategoricalValue[];
  defaultChecked?: string[];
}

export interface CheckboxFilterComponentState {
  checkboxMap: ReadonlyMap<string, boolean>;
}

export class CheckboxFilterComponent extends React.Component<
  CheckboxFilterComponentProps,
  CheckboxFilterComponentState
> {
  constructor(props: CheckboxFilterComponentProps) {
    super(props);

    const checkboxMap: Map<string, boolean> = new Map();
    if (this.props.defaultChecked) {
      const defaultChecked: Set<string> = new Set<string>(
        this.props.defaultChecked
      );
      this.props.categories.forEach((item) => {
        checkboxMap.set(item.name, defaultChecked.has(item.name));
      });
    } else {
      this.props.categories.forEach((item) => {
        checkboxMap.set(item.name, true);
      });
    }

    this.state = {
      checkboxMap,
    };
  }

  renderCheckboxes = () => {
    const checkboxes: React.ReactNode[] = [];
    const sortedCategories: CategoricalValue[] = this.props.categories.sort(
      (a, b) => (a.name > b.name ? 1 : -1)
    );
    sortedCategories.forEach((item) => {
      const displayName =
        item.name == "" || item.name == null ? "null" : item.name;
      checkboxes.push(
        <div key={item.name} style={{ marginRight: "15px" }}>
          <input
            id={item.name}
            type="checkbox"
            style={{ cursor: "pointer" }}
            checked={this.state.checkboxMap.get(item.name)}
            onChange={() => {
              const current = this.state.checkboxMap.get(item.name);
              const newCheckboxMap = update(this.state.checkboxMap, {
                $add: [[item.name, !current]],
              });

              this.setState({
                checkboxMap: newCheckboxMap,
              });
            }}
          />
          <label
            htmlFor={item.name}
            style={{
              borderLeft: "10px solid",
              borderLeftColor: item.color,
              paddingLeft: "5px",
              marginLeft: "10px",
              cursor: "pointer",
            }}
          >
            {displayName}
          </label>
        </div>
      );
    });
    return checkboxes;
  };

  areAllChecked = () => {
    const valuesSansDuplicates: Set<boolean> = new Set(
      Array.from(this.state.checkboxMap.values())
    );
    return valuesSansDuplicates.size == 1 && valuesSansDuplicates.has(true);
  };

  areNoneChecked = () => {
    const valuesSansDuplicates: Set<boolean> = new Set(
      Array.from(this.state.checkboxMap.values())
    );
    return valuesSansDuplicates.size == 1 && valuesSansDuplicates.has(false);
  };

  checkUncheckAll = () => {
    const areAllCurrentlyChecked = this.areAllChecked();
    const checkboxUpdatedStates: [string, boolean][] = [];
    Array.from(this.state.checkboxMap.keys()).forEach((key: string) => {
      checkboxUpdatedStates.push([key, !areAllCurrentlyChecked]);
    });
    const newCheckboxMap = update(this.state.checkboxMap, {
      $add: checkboxUpdatedStates,
    });
    this.setState({
      checkboxMap: newCheckboxMap,
    });
  };

  render() {
    const categoriesToShow = [...this.state.checkboxMap.entries()]
      .filter(({ 1: boolVal }) => boolVal === true)
      .map(([k]) => k);
    const bars: StackedBarBar[] = [];

    categoriesToShow.forEach((categoryName) => {
      const entry = this.props.categories.find((element) => {
        return element.name == categoryName;
      });
      if (entry) {
        bars.push({
          label: categoryName,
          count: entry.occurrences,
          color: entry.color,
        });
      }
    });
    return (
      <div style={{ padding: "15px" }}>
        <div style={{ width: "100%", marginBottom: "10px", height: "50px" }}>
          <StackedBar bars={bars} />
        </div>
        <div
          style={{
            height: "30vh",
            overflow: "scroll",
            display: "flex",
            flexWrap: "wrap",
            flexDirection: "column",
          }}
        >
          {this.renderCheckboxes()}
        </div>
        <br />
        <div style={{ justifyContent: "space-between", display: "flex" }}>
          <label>
            <input
              style={{ cursor: "pointer", marginRight: "5px" }}
              type="checkbox"
              checked={this.areAllChecked()}
              onChange={this.checkUncheckAll}
            />
            {this.areAllChecked() ? "Uncheck All" : "Check All"}
          </label>
          <button
            type="button"
            disabled={this.areNoneChecked()}
            onClick={() => {
              this.props.onFiltersSave(this.props.columnName, categoriesToShow);
            }}
            className="btn btn-default btn-sm"
          >
            Save
          </button>
        </div>
      </div>
    );
  }
}
