/* eslint-disable */
import React from "react";
import { MenuItem } from "react-bootstrap";

import {
  ColumnType,
  CustomCellRendererInputs,
  LongTable,
  LongTableColumn,
  LongTableData,
} from "@depmap/long-table";
import DropdownButton from "src/common/components/DropdownButton";
import { DepmapApi, DoseResponseCurvePromise } from "src/dAPI";
import { getDapi } from "src/common/utilities/context";
import { DoseResponseCurve } from "./DoseResponseCurve";

type CompoundDataset = {
  dataset: string;
  entity: number;
  id: string;
  label: string;
  auc_dataset_display_name: string;
  compound_label: string;
  compound_xref_full: string;
  dose_replicate_dataset: string;
  dose_replicate_level_yunits: string;
};

export type DoseResponseProps = {
  datasetOptions: Array<CompoundDataset>;
  doseUnits: string;
};

type DoseResponseTableRow = {
  depmapId: string;
  cell_line_display_name: string;
} & {
  [dose: string]: number;
};
type State = {
  dataset: CompoundDataset;
  doseResponseTable: Array<DoseResponseTableRow> | null;
  selectedRows: Array<string>;
  curvePlotPoints: Map<string, DoseResponseCurvePromise>;
};

function addIdToDoseResponseCurvePromise(
  curvePlotPoints: DoseResponseCurvePromise,
  id: string
): DoseResponseCurvePromise {
  return {
    curve_params: curvePlotPoints.curve_params.map((p) => {
      return { ...p, id };
    }),
    points: curvePlotPoints.points.map((p) => {
      return { ...p, id };
    }),
  };
}

class DoseResponseTab extends React.Component<DoseResponseProps, State> {
  dapi: DepmapApi;

  cellLineUrlRoot: string;

  dropdownEventKeyToLabel: Map<CompoundDataset, React.ReactNode>;

  constructor(props: DoseResponseProps) {
    super(props);

    this.dapi = getDapi();
    this.cellLineUrlRoot = this.dapi.getUrlRoot("cell_line.view_cell_line");

    this.dropdownEventKeyToLabel = new Map(
      props.datasetOptions.map((datasetOption) => [
        datasetOption,
        this.getDatasetDisplayName(datasetOption),
      ])
    );

    this.state = {
      dataset: props.datasetOptions[0],
      doseResponseTable: null,
      selectedRows: [],
      curvePlotPoints: new Map(),
    };

    this.dapi
      .getDoseResponseTable(
        this.state.dataset.dose_replicate_dataset,
        this.state.dataset.compound_xref_full
      )
      .then((v) => {
        const depmapIds = Object.keys(v);
        depmapIds.sort();
        this.setState({
          doseResponseTable: depmapIds.map((depmapId) => {
            return { ...v[depmapId], depmapId };
          }),
        });
      });
  }

  onDatasetChange = (newDataset: CompoundDataset) => {
    this.dapi
      .getDoseResponseTable(
        newDataset.dose_replicate_dataset,
        newDataset.compound_xref_full
      )
      .then((v) => {
        const depmapIds = Object.keys(v);
        depmapIds.sort();
        const depmapIdSet = new Set(depmapIds);
        const selectedRows = this.state.selectedRows.filter((depmapId) =>
          depmapIdSet.has(depmapId)
        );

        this.setState({
          dataset: newDataset,
          selectedRows,
          doseResponseTable: depmapIds.map((depmapId) => {
            return { ...v[depmapId], depmapId };
          }),
        });
      })
      .then((v) => {
        Promise.all([
          ...this.state.selectedRows.map((depmapId) =>
            this.dapi.getDoseResponsePoints(
              newDataset.dose_replicate_dataset,
              depmapId,
              newDataset.compound_xref_full
            )
          ),
        ]).then((values) => {
          this.setState({
            curvePlotPoints: new Map(
              values.map((v, i) => [
                this.state.selectedRows[i],
                addIdToDoseResponseCurvePromise(
                  v,
                  this.state.doseResponseTable!.find(
                    (row) => row.depmapId == this.state.selectedRows[i]
                  )!.cell_line_display_name
                ),
              ])
            ),
          });
        });
      });
  };

  onRowClick = (
    event: TouchEvent | KeyboardEvent | MouseEvent,
    rowKey: string,
    rowData: LongTableData
  ) => {
    if (event.shiftKey) {
      if (this.state.selectedRows.includes(rowKey)) {
        const newSelectedRows = this.state.selectedRows.filter(
          (depmapId) => depmapId != rowKey
        );
        this.setState({ selectedRows: newSelectedRows });
      } else {
        this.dapi
          .getDoseResponsePoints(
            this.state.dataset.dose_replicate_dataset,
            rowKey,
            this.state.dataset.compound_xref_full
          )
          .then((a) =>
            this.setState({
              curvePlotPoints: this.state.curvePlotPoints.set(
                rowKey,
                addIdToDoseResponseCurvePromise(
                  a,
                  rowData.cell_line_display_name
                )
              ),
              selectedRows: this.state.selectedRows.concat([rowKey]),
            })
          );
      }
    } else {
      this.dapi
        .getDoseResponsePoints(
          this.state.dataset.dose_replicate_dataset,
          rowKey,
          this.state.dataset.compound_xref_full
        )
        .then((a) =>
          this.setState({
            curvePlotPoints: new Map([
              [
                rowKey,
                addIdToDoseResponseCurvePromise(
                  a,
                  rowData.cell_line_display_name
                ),
              ],
            ]),
            selectedRows: [rowKey],
          })
        );
    }
  };

  getDatasetDisplayName(dataset: CompoundDataset): React.ReactNode {
    const sameDataset = this.props.datasetOptions.filter(
      (datasetOption) =>
        datasetOption.dose_replicate_dataset == dataset.dose_replicate_dataset
    );

    if (dataset.dose_replicate_dataset == "CTRP_dose_replicate") {
      return (
        <span>
          CTD<sup>2</sup>
          {sameDataset.length > 1 ? ` (${dataset.compound_xref_full})` : ""}
        </span>
      );
    }
    if (
      dataset.dose_replicate_dataset == "Repurposing_secondary_dose_replicate"
    ) {
      return `PRISM Repurposing Secondary Screen ${
        sameDataset.length > 1 ? ` (${dataset.compound_xref_full})` : ""
      }`;
    }
    if (dataset.dose_replicate_dataset == "GDSC1_dose_replicate") {
      return `Sanger GDSC1 ${
        sameDataset.length > 1 ? ` (${dataset.compound_xref_full})` : ""
      }`;
    }
    if (dataset.dose_replicate_dataset == "GDSC2_dose_replicate") {
      return `Sanger GDSC2 ${
        sameDataset.length > 1 ? ` (${dataset.compound_xref_full})` : ""
      }`;
    }
    if (dataset.dose_replicate_dataset == "Prism_oncology_dose_replicate") {
      return `PRISM OncRef ${
        sameDataset.length > 1 ? ` (${dataset.compound_xref_full})` : ""
      }`;
    }

    return dataset.dose_replicate_dataset;
  }

  cellLineCellRenderer({ rowData, cellData }: CustomCellRendererInputs) {
    if (rowData.id == "frozenRow") {
      return cellData;
    }
    return (
      <a href={`${this.cellLineUrlRoot}${rowData.depmapId}`} target="_blank">
        {rowData.cell_line_display_name}
      </a>
    );
  }

  render() {
    const columns: Array<LongTableColumn> = this.state.doseResponseTable
      ? Object.keys(this.state.doseResponseTable[0])
          .filter(
            (col) => !["depmapId", "cell_line_display_name"].includes(col)
          )
          .map((dose) => {
            const formatedDisplayName = `${parseFloat(
              dose.replace("-", ".")
            ).toPrecision(2)} ${this.props.doseUnits}`;

            return {
              key: dose,
              type: "continuous" as ColumnType,
              displayName: formatedDisplayName,
            };
          })
      : [];
    columns.sort((a, b) => parseFloat(a.key) - parseFloat(b.key));
    const table = this.state.doseResponseTable;
    if (table && "ic50" in table[0]) {
      columns.unshift({
        key: "ic50",
        type: "continuous",
        displayName: "IC50",
      });
    }
    columns.unshift({
      key: "auc",
      type: "continuous",
      displayName: "AUC",
    });
    columns.push({
      key: "cell_line_display_name",
      type: "character",
      displayName: "Cell line",
      width: 150,
      cellRenderer: (inputs) => this.cellLineCellRenderer(inputs),
    });
    return (
      <div>
        <DropdownButton
          id="compound-dose-response-curve-tab-dropdown"
          selectedEventKey={this.state.dataset}
          onSelect={this.onDatasetChange}
        >
          {this.props.datasetOptions.map((datasetOption, i) => (
            <MenuItem key={i} eventKey={datasetOption}>
              {this.getDatasetDisplayName(datasetOption)}
            </MenuItem>
          ))}
        </DropdownButton>

        <DoseResponseCurve
          plotId="compound-dose-curve-tab-plot"
          measurements={
            this.state.selectedRows &&
            new Set(
              this.state.selectedRows
                .map(
                  (depmapId) => this.state.curvePlotPoints.get(depmapId)?.points
                )
                .filter(Boolean)
                .reduce((prev, cur) => prev!.concat(cur!), [])
            )
          }
          curves={
            this.state.selectedRows &&
            this.state.selectedRows
              .map(
                (depmapId) =>
                  this.state.curvePlotPoints.get(depmapId)?.curve_params
              )
              .filter(Boolean)
              .reduce((prev, cur) => prev!.concat(cur!), [])
          }
          yUnits={this.state.dataset.dose_replicate_level_yunits}
          xUnits={this.props.doseUnits}
        />
        {this.state.doseResponseTable && (
          <div style={{ height: 400 }}>
            <LongTable
              dataFromProps={this.state.doseResponseTable}
              frozenCols={["cell_line_display_name"]}
              hiddenCols={["depmapId"]}
              columns={columns}
              idCol="depmapId"
              defaultSort={{ col: "auc", order: "ASC" }}
              onRowClick={({ event, rowKey, rowData }) =>
                this.onRowClick(event, rowKey, rowData)
              }
              isSelectedRow={(row) =>
                typeof row.rowData.id === "string" &&
                this.state.selectedRows.includes(row.rowData.id)
              }
            />
          </div>
        )}
      </div>
    );
  }
}

export default DoseResponseTab;
