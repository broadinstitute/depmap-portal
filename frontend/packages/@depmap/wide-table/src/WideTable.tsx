/* eslint-disable */
import * as React from "react";
import { Column, Row, SortingRule, TableProps } from "react-table";
import update from "immutability-helper";
import {
  DropdownButton,
  MenuItem,
  Popover,
  OverlayTrigger,
  Button,
  Modal,
} from "react-bootstrap";
import { colorPalette } from "depmap-shared";
import { Histogram, Histoslider } from "@depmap/common-components";
import ReactTableV7 from "./ReactTableV7";

import * as ReactCSV from "react-csv";

// useage example:
//
// <WideTable
//     data={tableData}
//     columns={columns}
//     defaultColumnsToShow={defaultColumnsToShow}
//     additionalReactTableProps={
//         {
//             defaultPageSize: 20,
//             className: "-highlight",
//         }
//     }
// />

// a lighter version of react table Column props.  Only accessor is required (if no Header is supplied, the accessor will be used as the header in the display)
// this is mostly so that we can take in Data Tables from depmap and convert them into wide table format.
export interface WideTableColumns {
  accessor: string;

  Header?: any;
  Cell?: any;

  // Custom properties (not defined in ReactTable's Column)
  /**
   * used to render helper text popover in column header
   */
  helperText?: React.ReactNode;

  /**
   * used with the Data Tables in the depmap portal
   */
  renderFunction?: any;
  columnDropdownLabel?: React.ReactNode;
  /**
   * If you don't want a particular column to be filterable, you can set this
   * to `true`.
   * @default false
   */
  disableFilters?: boolean;
  /**
   * Use a custom slider filter to filter by range. Should only be used with continuous value columns.
   * Must also set these WideTableProps: onChangeHistoSlider, rowVisibility, filters. filters syncs the
   * in-WideTable sliders with the outside state of filters defined by useDiscoveryAppFilters.
   * @default false
   */
  useHistoSliderFilter?: boolean;

  /**
   * If you don't provide a filter function, a default text input filter is used.
   * Use this prop to define your own custom filter.
   * @default undefined
   */
  customFilter?: ({
    column: { filterValue, preFilteredRows, setFilter },
  }: any) => void;
  /**
   * If you don't want a particular column to be sorted, you can set this
   * to `true`.
   * @default false
   */
  disableSortBy?: boolean;
}

export interface WideTableProps {
  /**
   * array of objects, all data for the table (will be what ends up downloaded if
   * allowDownloadFromTableData is set to true and the user clicks "download table")
   */
  data: any[];
  columns: Array<WideTableColumns & Partial<Column>>; // refer to the react-table docs for structure
  invisibleColumns?: Array<number>;

  // optional parameters
  /**
   * array of column accessors (strings) for columns we want to show on render.  If null, we'll show all columns
   */
  defaultColumnsToShow?: string[];

  /**
   * Array of column accessors (strings) for all columns we want in the table (both shown and hidden).
   * Order here determines order that columns are shown in the table.
   */
  columnOrdering?: string[];

  // wrapHeader: boolean // allow wrapping on header

  additionalReactTableProps?: Partial<TableProps>;

  /**
   * for if we want to allow download of data from somewhere else (instead of pulling data from the table)
   */
  downloadURL?: string;

  /**
   * for if we want to allow download of data from the table itself (rather than from an external source)
   */
  allowDownloadFromTableData?: boolean;
  /**
   * optimized to only render ReactCsv (expensive to render) if menu is clicked and open
   */
  allowDownloadFromTableDataWithMenu?: boolean;

  /**
   * if allowDownloadFromTableDataWithMenu, name of downloaded file
   */
  allowDownloadFromTableDataWithMenuFileName?: string;

  sorted?: Array<SortingRule<any>>; // TODO: Is this actually used?
  renderExtraDownloads?: () => JSX.Element;

  /**
   *  Use this to enable selection on the table. It will be called whenever the
   *  selections change. If this is prop is used, `idProp` must also be defined.
   */
  onChangeSelections?: (selections: any[]) => void;

  /**
   *  This determines what property of each row will be used to track
   *  selections. Must be defined to if `onChangeSelections` is.
   */
  idProp?: string;

  /**
   *  @default 24
   *  Sets a static height for each row of the table.
   *  This is necessary because the rows are virtualized.
   */
  rowHeight?: number;

  /**
   * Takes a row, add class/styling and provide some effect on click
   * @param row
   * @returns onClick function for row
   */
  getTrProps?: (row: Row) => React.HtmlHTMLAttributes<HTMLDivElement>;

  // Allow rows to be selectable, but only allow 1 selection at a time. If a row
  // is already selected, and then a new row is selected, the old row is deselected.
  singleSelectionMode: boolean;

  // Select rows by checking the checkbox of the row matching these labels
  selectedTableLabels: Set<string> | null;

  // Uses updateFilter, which is defined in useDiscoveryAppFilters
  onChangeHistoSlider?: (key: string, min: number, max: number) => void;
  // Required when a column uses the histoslider so that we can keep track of the original domain
  // of the unfiltered data, which is required for HistoSlider to work properly.
  rowVisibility?: boolean[];
  // filters syncs the in-WideTable sliders with the outside state of filters defined by useDiscoveryAppFilters.
  filters?: any[] | null;

  // If selecting table rows controls selecting annotated points in a plot, we want to be able to limit
  // the maximum allowed annotated points, so we want to be able to turn the select all checkbox off, even
  // when we're NOT in single select mode.
  hideSelectAllCheckbox?: boolean;
}

interface WideTableState {
  /**
   * map showing whether or not a column is being shown.  string key = column accessor
   */
  columnsState: ReadonlyMap<string, boolean>;

  /**
   * columns stores all the visible columns in the table.  len(tableProps.columns) < len(allColumns)
   */
  columns: Partial<Column>[];

  /**
   * stores all of the column options for the dropdown menu
   */
  allColumns: Partial<Column & { hideFromColumnSelectionDropdown: boolean }>[];

  /**
   * whether the column selector dropdown is open
   */
  columnSelectorIsOpen: boolean;

  /**
   * array containing the accessors of the columns that the table is currently being sorted by
   */
  sorted?: SortingRule<any>[];

  // State of the download button menu (if the menu is allowed in props)
  downloadMenuOpen: boolean;

  // column with filter defined in Histoslider modal
  columnToFilter?: string;
}

class WideTable extends React.Component<WideTableProps, WideTableState> {
  private selectTable: any = null;

  private textCanvas: any = null; // this is so that we can measure the pixel length of a string in order to resize column width appropriately

  private columnJustSelected = false; // used to prevent the column selector from closing after a column is selected/deselected

  private ignoreUpdate = false; // Used to prevent infinite loop when resizing columns.

  static defaultProps: Partial<WideTableProps> = {
    sorted: [],
    singleSelectionMode: false,
    onChangeHistoSlider: undefined,
    rowVisibility: undefined,
    hideSelectAllCheckbox: false,
  };

  constructor(props: WideTableProps) {
    super(props);
    this.selectTable = React.createRef();
    this.textCanvas = React.createRef();

    // reorder columns based on columnOrdering prop, if it was passed in
    const orderedColumns: Partial<Column>[] = this.processColumns(
      this.props.columns
    );

    // determine which columns to show by default using defaultColumnsToShow when WideTable is first loaded
    const columnCheckStatus: Map<
      string,
      boolean
    > = this.initializeColumnCheckStatus(orderedColumns);

    this.state = {
      columnsState: columnCheckStatus,
      columns: orderedColumns,
      allColumns: orderedColumns,
      columnSelectorIsOpen: false,
      sorted: props.sorted,
      downloadMenuOpen: false,
      columnToFilter: undefined,
    };
  }

  // force the columns to resize based on default columns being shown and hidden
  componentDidMount() {
    this.resizeColumns();
  }

  componentDidUpdate(prevProps: WideTableProps) {
    if (this.didColumnsChange(prevProps.columns)) {
      const columns = this.processColumns(this.props.columns);
      this.setState({ columns, allColumns: columns });
      return;
    }

    if (!this.ignoreUpdate) {
      this.resizeColumns();
    }
  }

  didColumnsChange(prevColumns: Partial<Column>[]) {
    const xs = prevColumns;
    const ys = this.props.columns;

    return (
      xs.length !== ys.length ||
      xs.some((_: unknown, i: number) => xs[i] !== ys[i])
    );
  }

  initializeColumnCheckStatus(orderedColumns: Partial<Column>[]) {
    const columnCheckStatus: Map<string, boolean> = new Map<string, boolean>();
    orderedColumns.forEach((item) => {
      if (this.props.defaultColumnsToShow) {
        columnCheckStatus.set(
          item.accessor as string,
          this.props.defaultColumnsToShow.includes(item.accessor as string)
        );
      } else {
        columnCheckStatus.set(item.accessor as string, true);
      }
    });
    return columnCheckStatus;
  }

  addHeaderArrows(header: string, data: any) {
    let sortIcon = null;
    const sorted = data.state?.sortBy ? data.state.sortBy : this.state.sorted;
    const sortInfo = sorted.filter((item: any) => item.id === header);
    if (sortInfo.length) {
      if (sortInfo[0].desc === true) {
        sortIcon = (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              minHeight: 20,
            }}
          >
            <span className="glyphicon glyphicon-triangle-bottom" />
          </div>
        );
      } else {
        sortIcon = (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              minHeight: 20,
            }}
          >
            <span className="glyphicon glyphicon-triangle-top" />
          </div>
        );
      }
    } else {
      sortIcon = (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            color: "LightGray",
            fontSize: 10,
          }}
        >
          <span className="glyphicon glyphicon-triangle-top" />
          <span className="glyphicon glyphicon-triangle-bottom" />
        </div>
      );
    }
    return sortIcon;
  }

  addHelperText(col: WideTableColumns) {
    const helpPopover = (
      <Popover
        id={`popover-col-helper-text-${col.accessor as string}`}
        title={col.Header || (col.accessor as string)}
      >
        {col.helperText as any}
      </Popover>
    );

    return (
      <OverlayTrigger
        trigger={["hover", "focus"]}
        placement="top"
        overlay={helpPopover}
      >
        <span
          className="glyphicon glyphicon-question-sign"
          style={{ marginInlineStart: 8 }}
        />
      </OverlayTrigger>
    );
  }

  isColsCustomType(cols: Array<any>): cols is WideTableColumns[] {
    return cols.some(this.isColCustomType);
  }

  isColCustomType(
    col: WideTableColumns | Partial<Column>
  ): col is WideTableColumns {
    return (
      (col as WideTableColumns).renderFunction != undefined ||
      (col as WideTableColumns).helperText != undefined ||
      (col as WideTableColumns).columnDropdownLabel != undefined
    );
  }

  isColumnNumeric(accessor?: string): boolean {
    if (!accessor) {
      return false;
    }

    let isNumeric = true;
    const data = this.props.data;
    const colValues = data.map((row) => {
      return row[accessor];
    });
    colValues.forEach((val) => {
      if (isNaN(val)) {
        isNumeric = false;
        return false;
      }
    });
    return isNumeric;
  }

  renderHistoSliderFilter = ({
    column: { filterValue, preFilteredRows, setFilter, id },
  }: any) => {
    let min = 0;
    let max = 1;

    const getMin = (key: any) => {
      return this.props.filters
        ? (this.props.filters.filter((filter) => filter.key === key)[0] as {
            value: number[];
          }).value[0]
        : Math.min(
            preFilteredRows
              .map((row: any) => row.values[key])
              .filter((x: any) => x)
          );
    };

    const getMax = (key: any) => {
      return this.props.filters
        ? (this.props.filters.filter((filter) => filter.key === key)[0] as {
            value: number[];
          }).value[1]
        : Math.max(
            preFilteredRows
              .map((row: any) => row.values[key])
              .filter((x: any) => x)
          );
    };

    return (
      <>
        <div
          style={{ height: "100%", width: "100%" }}
          onClick={() => {
            if (!this.state.columnToFilter) {
              this.setState({ columnToFilter: id });
            }
          }}
        >
          <Histogram
            color={colorPalette.interesting_color}
            data={
              preFilteredRows
                .map((row: any) => row.values[id])
                .filter((x: any) => x)
              /* remove nulls */
            }
          />
        </div>
        <div>
          <Modal
            dialogClassName="wide-table-slider-modal"
            show={this.state.columnToFilter != null}
            onHide={() =>
              this.setState({
                columnToFilter: undefined,
              })
            }
          >
            <Modal.Header closeButton>
              <Modal.Title>
                Filter column: {this.state.columnToFilter}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div>
                {this.state.columnToFilter && (
                  <Histoslider
                    selectedColor={colorPalette.interesting_color}
                    width={350}
                    height={100}
                    rangeHandler={(a: number, b: number) => {
                      min = Math.min(a, b);
                      max = Math.max(a, b);
                    }}
                    defaultSelection={[
                      getMin(this.state.columnToFilter),
                      getMax(this.state.columnToFilter),
                    ]}
                    rawNums={this.props.data
                      .map(
                        (row: any) => row[this.state.columnToFilter as string]
                      )
                      .filter((x: any) => x)}
                  />
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                  type="button"
                  disabled={false}
                  onClick={() => {
                    this.props.onChangeHistoSlider &&
                      this.props.onChangeHistoSlider(
                        this.state.columnToFilter as string,
                        min,
                        max
                      );
                    this.setState({
                      columnToFilter: undefined,
                    });
                  }}
                  className="btn btn-default btn-sm"
                >
                  Save
                </button>
              </div>
            </Modal.Footer>
          </Modal>
        </div>
      </>
    );
  };

  processColumns(cols: WideTableColumns[]): Partial<Column>[] {
    let processedColumns: Partial<Column>[] = [];
    const cellStyles: any = { textAlign: "left", overflowWrap: "break-word" };

    // add column headers/styling
    for (let i = 0; i < cols.length; i++) {
      let transformedColumn: Partial<Column>;
      let header: any;
      if (cols[i].Header == null) {
        header = cols[i].accessor;
      } else {
        header = cols[i].Header;
      }

      transformedColumn = {
        Header: (data) => (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              {header}
              {this.isColsCustomType(cols) &&
                cols[i].helperText &&
                this.addHelperText(cols[i])}
            </div>
            <div
              style={{
                marginInlineEnd: 10,
              }}
            >
              {cols[i].disableSortBy
                ? null
                : this.addHeaderArrows(cols[i].accessor as string, data)}
            </div>
          </div>
        ),
        accessor: cols[i].accessor,
        disableFilters: cols[i].disableFilters,
        disableSortBy: cols[i].disableSortBy,
      };

      if (cols[i].customFilter) {
        transformedColumn.Filter = cols[i].customFilter as any;
      }

      if (cols[i].useHistoSliderFilter) {
        cols[i].customFilter = this.renderHistoSliderFilter;
        transformedColumn.Filter = cols[i].customFilter as any;
      }

      // TODO: Is this actually necessary??
      if (this.isColumnNumeric(cols[i]?.accessor?.toString())) {
        (transformedColumn as any).sortType = (
          rowA: any,
          rowB: any,
          colId: any,
          desc: any
        ) => {
          if (Number(rowA.values[colId]) - Number(rowB.values[colId]) > 0) {
            return 1;
          }
          if (Number(rowA.values[colId]) - Number(rowB.values[colId]) < 0) {
            return -1;
          }
          return 0;
        };
      }
      if (cols[i].Cell != null) {
        transformedColumn.Cell = cols[i].Cell;
      } else {
        transformedColumn.Cell = (row) => (
          <div style={cellStyles}>{row.value}</div>
        );
      }

      // TODO: Should always be WideTableColumns tho?
      // if type is of WideTableColumns...
      if (this.isColsCustomType(cols) && cols[i].renderFunction != null) {
        transformedColumn.Cell = (row) => (
          <div
            style={cellStyles}
            dangerouslySetInnerHTML={{ __html: cols[i].renderFunction(row) }}
          />
        );
      } else if (!this.isColsCustomType(cols)) {
        transformedColumn = {
          ...(cols[i] as Partial<Column>),
          ...transformedColumn,
        };
      }
      processedColumns.push(transformedColumn);
    }

    if (this.props.invisibleColumns) {
      processedColumns = processedColumns.filter(
        (col, i) => !this.props.invisibleColumns!.includes(i)
      );
    }

    // sort the columns
    if (this.props.columnOrdering) {
      return this.props.columnOrdering
        .map((accessor) =>
          processedColumns.find((col) => col.accessor == accessor)
        )
        .filter((column: unknown) => column !== undefined) as Partial<Column>[];
    }
    return processedColumns;
  }

  get_text_width(str: string): number {
    const font = "'Lato', sans-serif 14px";
    const canvas = this.textCanvas;
    const context = canvas.getContext("2d");
    context.font = font;
    const metrics = context.measureText(str);
    return metrics.width;
  }

  // scales column width in table proportionally depending on contents
  getColumnWidth(
    accessor: string,
    headerText: string,
    subsettedData: [] | ReadonlyArray<any>
  ): number {
    let max = this.get_text_width(headerText);
    // Get max length using size of string in pixels
    for (let i = 0; i < subsettedData.length; i++) {
      if (subsettedData[i] != undefined && subsettedData[i][accessor] != null) {
        const str = subsettedData[i][accessor];
        const stringPixelLength = this.get_text_width(str);
        if (stringPixelLength > max) {
          max = stringPixelLength;
        }
      }
    }
    return max;
  }

  updateShownColumns(column: string) {
    // get updated map with T/F values for each column
    const updatedMap: ReadonlyMap<string, boolean> = update(
      this.state.columnsState,
      { $add: [[column, !this.state.columnsState.get(column)]] }
    );
    this.setState({
      columnsState: updatedMap,
    });
  }

  updateShownColumnsAll() {
    const newColumnsState = new Map();
    this.state.columnsState.forEach((v, k) => newColumnsState.set(k, true));
    this.setState({
      columnsState: new Map(newColumnsState as ReadonlyMap<string, boolean>),
    });
  }

  updateShownColumnsNone() {
    const newColumnsState = new Map();
    this.state.columnsState.forEach((v, k) => newColumnsState.set(k, false));
    this.setState({
      columnsState: new Map(newColumnsState as ReadonlyMap<string, boolean>),
    });
  }

  resizeColumns() {
    // TODO: Can probaby delete
    // get names of columns we want to show
    const columnsToShowAccessors = new Set(
      Array.from(this.state.columnsState.keys()).filter((key) =>
        this.state.columnsState.get(key)
      )
    );

    // update columns array by having only the columns we want to show
    const colsP = this.state.allColumns;
    const newColumns = update(this.state.allColumns, {
      $apply: (cols: typeof colsP) => {
        return cols.filter((item) =>
          columnsToShowAccessors.has(item.accessor as string)
        );
      },
    });
    const visibleData = this.getVisibleData();

    // now update shown columns with appropriate min widths
    const newCols: Partial<Column>[] = [];
    newColumns.forEach((item: Partial<Column>, i: number) => {
      newCols.push(
        update(newColumns[i], {
          ["width"]: {
            $set: this.getColumnWidth(
              item.accessor as string,
              item.accessor as string,
              visibleData
            ),
          },
        })
      );
    });

    this.ignoreUpdate = true;
    this.setState({ columns: newCols }, () => {
      this.ignoreUpdate = false;
    });
  }

  getVisibleData() {
    const resolvedState = this.selectTable.getResolvedState();
    const { pageSize } = resolvedState;
    const { page } = resolvedState;
    const { sortedData } = resolvedState;

    const visibleMinIndex = page * pageSize;
    const visibleMaxIndex = (page + 1) * pageSize;

    return sortedData.slice(
      visibleMinIndex,
      Math.min(visibleMaxIndex, sortedData.length)
    );
  }

  getResolvedState() {
    return this.selectTable.getResolvedState();
  }

  onColumnSelectorToggle(isOpen: boolean) {
    if (!this.columnJustSelected) {
      this.setState({ columnSelectorIsOpen: isOpen });
    }

    this.columnJustSelected = false;
  }

  renderShowHideMenu() {
    const options: any = [];
    let cols: Array<WideTableColumns | Partial<Column>> = this.props.columns;
    if (this.props.invisibleColumns) {
      cols = cols.filter((_, i) => !this.props.invisibleColumns?.includes(i));
    }
    if (this.props.columnOrdering) {
      cols = this.props.columnOrdering
        .map((accessor) =>
          cols.find(
            (col: WideTableColumns | Partial<Column>) =>
              col.accessor == accessor
          )
        )
        .filter((column: unknown) => column !== undefined) as (
        | WideTableColumns
        | Column
      )[];
    }

    cols.forEach((item: WideTableColumns | Partial<Column>) => {
      const title =
        (item as WideTableColumns).columnDropdownLabel ||
        (item.accessor as string);
      const columnSelected = this.state.columnsState.get(
        item.accessor as string
      );
      options.push(
        <MenuItem
          onClick={() => this.updateShownColumns(item.accessor as string)}
          name={item.accessor as string}
          key={item.accessor as string}
        >
          {columnSelected && (
            <span style={{ position: "absolute" }} aria-label="Selected, ">
              &#x2714;
            </span>
          )}
          <span style={{ marginLeft: "16px" }}>{title}</span>
        </MenuItem>
      );
    });

    const columnStatuses = Array.from(this.state.columnsState.values());
    options.push(<MenuItem divider key="separator" />);
    options.push(
      <MenuItem
        onClick={this.updateShownColumnsAll.bind(this)}
        key="select-all"
      >
        {columnStatuses.every(Boolean) && (
          <span style={{ position: "absolute" }} aria-label="Selected, ">
            &#x2714;
          </span>
        )}
        <span style={{ marginLeft: "16px" }}>Select all</span>
      </MenuItem>
    );
    options.push(
      <MenuItem
        onClick={this.updateShownColumnsNone.bind(this)}
        key="deselect-all"
      >
        {columnStatuses.every((x) => !x) && (
          <span style={{ position: "absolute" }} aria-label="Selected, ">
            &#x2714;
          </span>
        )}
        <span style={{ marginLeft: "16px" }}>Deselect all</span>
      </MenuItem>
    );

    const doPullRight = !this.props.allowDownloadFromTableDataWithMenu;

    return (
      <DropdownButton
        title="Show/Hide Columns"
        pullRight={doPullRight}
        id="dropup-size-medium"
        bsSize="xsmall"
        onToggle={(isOpen) => this.onColumnSelectorToggle(isOpen)}
        open={this.state.columnSelectorIsOpen}
        onSelect={() => (this.columnJustSelected = true)}
      >
        {options}
      </DropdownButton>
    );
  }

  updateDownloadMenuButtonState(downloadMenuIsOpen: boolean) {
    this.setState({
      downloadMenuOpen: downloadMenuIsOpen,
    });
  }

  // TODO:  make the tables widths update on filtered change and sorted change
  render() {
    const dropdownColumnHideShowMenu = this.renderShowHideMenu();
    let downloadButton = null;
    let numberOfRows = null;
    const dataToDownload = this.props.data;
    if (this.props.downloadURL) {
      downloadButton = (
        <Button
          href={this.props.downloadURL}
          className="glyphicon glyphicon-download-alt"
          target="_blank"
          bsStyle="link"
          style={{ paddingRight: 10 }}
        />
      );
    } else if (this.props.allowDownloadFromTableData) {
      downloadButton = (
        <ReactCSV.CSVLink
          data={dataToDownload}
          filename="my-file.csv"
          className="glyphicon glyphicon-download-alt"
          target="_blank"
          style={{ paddingRight: 10 }}
        />
      );
    } else if (this.props.allowDownloadFromTableDataWithMenu) {
      numberOfRows = dataToDownload.length;

      const MenuContent = ({ getData }: any) => (
        <>
          <li role="presentation">
            <ReactCSV.CSVLink
              role="menuitem"
              data={getData()}
              filename={
                this.props.allowDownloadFromTableDataWithMenuFileName ??
                "portal-file.csv"
              }
            >
              Data (.csv)
            </ReactCSV.CSVLink>
          </li>
        </>
      );

      const getData = () => {
        return this.props.data;
      };

      downloadButton = (
        <div>
          <DropdownButton
            id={`context-explorer-download-plot-icon`}
            title={<span className="glyphicon glyphicon-download-alt" />}
            bsSize="small"
            pullRight
            onToggle={(downloadMenuIsOpen) =>
              this.updateDownloadMenuButtonState(downloadMenuIsOpen)
            }
          >
            {this.state.downloadMenuOpen && <MenuContent getData={getData} />}
          </DropdownButton>
        </div>
      );
    }

    const helpPopover = (
      <Popover id="popover-trigger-hover-focus" title="Tips">
        Click column headers to sort.
        <br />
        Use textboxes below the headers to filter values in a column.{" "}
      </Popover>
    );
    return (
      <div className="wide-table">
        <canvas
          style={{ position: "absolute", visibility: "hidden" }}
          ref={(r) => {
            this.textCanvas = r;
          }}
        />
        <div>
          <div style={{ display: "flex", alignItems: "center", float: "left" }}>
            {this.props.renderExtraDownloads &&
              this.props.renderExtraDownloads()}
          </div>
          {!this.props.allowDownloadFromTableDataWithMenu && (
            <div
              id="thing"
              style={{
                display: "flex",
                alignItems: "center",
                float: "right",
              }}
            >
              {downloadButton}
              <OverlayTrigger
                trigger={["hover", "focus"]}
                placement="top"
                overlay={helpPopover}
              >
                <span
                  className="glyphicon glyphicon-question-sign"
                  style={{ marginInlineEnd: 10 }}
                />
              </OverlayTrigger>
              {dropdownColumnHideShowMenu}
            </div>
          )}
          {this.props.allowDownloadFromTableDataWithMenu && (
            <>
              <div
                id="thing"
                style={{
                  display: "flex",
                  alignItems: "center",
                  float: "left",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontSize: "18px", marginRight: "5px" }}>
                  {
                    this.props.data.filter((_, index) =>
                      this.props.rowVisibility
                        ? this.props.rowVisibility[index]
                        : true
                    ).length
                  }{" "}
                  entries
                </span>
                {dropdownColumnHideShowMenu}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  float: "right",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    marginRight: "5px",
                  }}
                >
                  Download
                </span>
                {downloadButton}
              </div>
            </>
          )}
        </div>
        <ReactTableV7
          ref={(r) => {
            this.selectTable = r;
          }}
          columns={this.state.columns as any}
          data={this.props.data.filter((_, index) =>
            this.props.rowVisibility ? this.props.rowVisibility[index] : true
          )}
          onChangeSelections={this.props.onChangeSelections}
          idProp={this.props.idProp}
          rowHeight={this.props.rowHeight}
          getTrProps={this.props.getTrProps}
          selectedLabels={this.props.selectedTableLabels}
          singleSelectionMode={this.props.singleSelectionMode}
          hideSelectAllCheckbox={this.props.hideSelectAllCheckbox}
        />
      </div>
    );
  }
}
export default React.memo(WideTable);
