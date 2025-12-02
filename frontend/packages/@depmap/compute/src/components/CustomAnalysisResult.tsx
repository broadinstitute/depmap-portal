/* eslint-disable */
import * as React from "react";
import { VolcanoPlot, VolcanoTrace } from "@depmap/plotly-wrapper";
import { Tab, Tabs } from "react-bootstrap";

import {
  isSelectedRowParam,
  LongTable,
  onRowClickParam,
} from "@depmap/long-table";
import { ComputeResponseResult, AnalysisType } from "@depmap/compute";
import { assert } from "@depmap/utils";
import SaveContextButton, { SelectionState } from "./SaveContextButton";

import "../styles/CustomAnalysisResult.scss";

type PlotlyType = typeof import("plotly.js");

type VisualizationType = "volcano" | "table";
type TabEventKey = "close" | VisualizationType;

interface CustomAnalysisResultProps {
  Plotly: PlotlyType;
  onTableClick?: (
    sliceId: string,
    colorSliceId: string | undefined,
    filterSliceId: string
  ) => void;
  // Data Explorer 2 doesn't understand slice IDs so it uses this callback
  // instead of `onTableClick`. Note that it's not called by initResults().
  onLabelClick?: (entityLabel: string) => void;
  hideResult?: () => void;
  result: ComputeResponseResult;
  analysisType: AnalysisType;
  queryLimit: number;
  // Originally, this component controlled its own state. Data Explorer 2 wants
  // to be able to control the selected label.
  controlledLabel?: string;
}

interface CustomAnalysisResultState {
  queryLimit: number;
  selectedLabel: string; // this records which row is selected by the user in the result table
  visualizationType: VisualizationType;
}

export class CustomAnalysisResult extends React.Component<
  CustomAnalysisResultProps,
  Partial<CustomAnalysisResultState>
> {
  constructor(props: any) {
    super(props);
    this.state = {
      queryLimit: this.props.queryLimit,
      selectedLabel: undefined,
      visualizationType: "volcano",
    };
  }

  componentDidMount = () => {
    // the component is always re-mounted when a new result is returned
    // so initResults always runs fresh for a new result
    this.initResults();
  };

  componentWillReceiveProps(nextProps: Readonly<CustomAnalysisResultProps>) {
    if (
      nextProps.controlledLabel != null &&
      this.state.selectedLabel !== nextProps.controlledLabel
    ) {
      this.setState({
        selectedLabel: nextProps.controlledLabel,
      });
    }
  }

  initResults = () => {
    if (this.props.result.data) {
      const row = !this.props.controlledLabel
        ? 0
        : this.props.result.data.findIndex(
            (d) => d.label === this.props.controlledLabel
          ) || 0;

      // should be present or absent depending on analysis type
      const colorSliceId = this.props.result.colorSliceId
        ? this.props.result.colorSliceId
        : undefined;
      if (this.props.onTableClick) {
        this.props.onTableClick(
          this.props.result.data[row].vectorId,
          colorSliceId,
          this.props.result.filterSliceId
        );
      }
      const newState: Partial<CustomAnalysisResultState> = {
        selectedLabel: this.props.result.data[row].label,
      };
      this.setState(newState);
    }
  };

  formatCell = (value: string, colName: string) => {
    if (colName == "Cor" || colName == "EffectSize") {
      return parseFloat(value).toFixed(2);
    }
    if (colName == "PValue" || colName == "QValue") {
      return parseFloat(value).toExponential(2);
    }
    return value;
  };

  renderResultTable = (slicedData: any) => {
    assert(
      this.props.result.data.length > 0,
      `Result data array has length 0: ${this.props.result.data}`
    );
    const columnsInData = Object.keys(this.props.result.data[0]);

    const requiredCols = [
      "label",
      "PValue",
      "QValue",
      "numCellLines",
      "vectorId",
    ];
    for (const col of requiredCols) {
      assert(
        columnsInData.includes(col),
        `${col} missing from results: ${this.props.result.data}`
      );
    }
    const allPossibleCols = [...requiredCols];
    allPossibleCols.splice(1, 0, "EffectSize", "Cor"); // insert after "label"

    const visibleColsInData = allPossibleCols.filter((x) =>
      columnsInData.includes(x)
    );
    const hiddenCols = ["vectorId"];

    const columnsProps = visibleColsInData.map((key, i) => {
      const widths = [100, 115, 115, 115, 125];

      return { key, width: widths[i] };
    });

    const isSelectedRow = (row: isSelectedRowParam) => {
      return (
        row.rowData !== undefined &&
        row.rowData.label === this.state.selectedLabel
      );
    };
    const onRowClick = (row: onRowClickParam) => {
      this.setState({
        selectedLabel: row.rowData.label,
      });
      const sliceId = row.rowData.vectorId;
      if (this.props.onTableClick) {
        this.props.onTableClick(
          sliceId,
          this.props.result.colorSliceId
            ? this.props.result.colorSliceId
            : undefined,
          this.props.result.filterSliceId
        );
      }

      if (this.props.onLabelClick) {
        this.props.onLabelClick(row.rowData.label);
      }
    };

    return (
      // need to define height for longtable, which fits the parent div height
      <div>
        {/* this div exists to define longtable height */}
        <div style={{ height: "300px" }}>
          <LongTable
            dataFromProps={slicedData}
            hiddenCols={hiddenCols}
            onRowClick={onRowClick}
            isSelectedRow={isSelectedRow}
            columns={columnsProps}
          />
        </div>
        {this.renderQueryCellLines()}
      </div>
    );
  };

  onTabSelect = (eventKey: any) => {
    // comes in as type MouseEvent<{}>
    eventKey = eventKey as TabEventKey;
    if (eventKey == "close") {
      this.setState({
        visualizationType: "volcano",
      });
      this.props.hideResult?.();
    } else {
      this.setState({ visualizationType: eventKey as VisualizationType });
    }
  };

  renderResultPanel = () => {
    if (this.props.result && this.props.result.data) {
      const slicedData = this.props.result.data.slice(
        0,
        Math.min(
          this.state.queryLimit ?? Infinity,
          this.props.result.data.length
        )
      );

      return (
        <div style={{ width: "100%" }}>
          <div
            className="result-container"
            style={{
              display: "flex",
              flexDirection: "row",
              marginLeft: "20px",
              marginTop: "20px",
            }}
          >
            <Tabs
              defaultActiveKey="volcano"
              animation={false}
              onSelect={this.onTabSelect}
              activeKey={this.state.visualizationType}
              id="results-panel" // required by react (bootstrap?) for accessibility
              style={{ width: "100%" }} // required to fill panel
            >
              {this.props.hideResult ? (
                <Tab
                  eventKey="close"
                  title="x"
                  tabClassName="close-associations"
                />
              ) : null}
              <Tab eventKey="volcano" title="Volcano" />
              <Tab eventKey="table" title="Table" />
              <div>
                {this.renderControls()}
                <div
                  style={{
                    display: `${
                      this.state.visualizationType == "volcano"
                        ? "block"
                        : "none"
                    }`,
                  }}
                >
                  {this.renderVolcanoPlot(slicedData)}
                </div>
                <div
                  style={{
                    display: `${
                      this.state.visualizationType == "table" ? "block" : "none"
                    }`,
                  }}
                >
                  {this.renderResultTable(slicedData)}
                </div>
              </div>
            </Tabs>
          </div>
        </div>
      );
    }
  };

  renderQueryCellLines = () => {
    return (
      <div>
        <strong>{this.props.result.numCellLinesUsed} cell lines queried</strong>
      </div>
    );
  };

  downloadList = (listContents: Array<string>) => {
    const outputString = Array.from(listContents).join(",");
    const element = document.createElement("a");
    const file = new Blob([outputString], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "query_cell_lines.txt";
    document.body.appendChild(element);
    element.click();
  };

  renderLimitControls = () => {
    return (
      <label>
        <strong>Number of results to show:</strong>
        <input
          type="number"
          value={this.state.queryLimit}
          onChange={(e) => {
            const limit = +e.target.value;
            if (limit > 0) {
              this.setState({ queryLimit: +e.target.value });
            }
          }}
        />
      </label>
    );
  };

  renderControls = () => {
    return (
      <div style={{ display: "flex", flexBasis: 0, flexGrow: 2 }}>
        {this.renderLimitControls()}
      </div>
    );
  };

  renderVolcanoPlot = (slicedData: any) => {
    let isEffectSizeNotCor;
    const columns = Object.keys(this.props.result.data[0]);
    if (columns.includes("EffectSize")) {
      assert(!columns.includes("Cor"));
      isEffectSizeNotCor = true;
    } else {
      assert(columns.includes("Cor"));
      isEffectSizeNotCor = false;
    }

    const labels: Array<string> = this.props.result.data.map(
      (x: any) => x.label
    );
    const pVals: Array<number> = this.props.result.data.map(
      (x: any) => x.PValue
    );
    const qVals: Array<number> = this.props.result.data.map(
      (x: any) => x.QValue
    );
    const effectSizes: Array<number> = isEffectSizeNotCor
      ? this.props.result.data.map((x: any) => x.EffectSize)
      : this.props.result.data.map((x: any) => x.Cor);

    const xLabel = isEffectSizeNotCor ? "Effect size" : "Correlation";
    const yLabel = "PValue";
    const downloadData: any[] = [];
    const yLabelDownload = `-log10(${yLabel})`;

    const inSignificantPts = [];
    const significantPts = [];
    for (let i = 0; i < slicedData.length; i++) {
      const point = {
        effectSize: effectSizes[i],
        pVal: pVals[i],
        label: labels[i],
      };
      if (qVals[i] > 0.05) {
        inSignificantPts.push(point);
      } else {
        significantPts.push(point);
      }
      downloadData.push({
        Feature: point.label,
        [xLabel]: point.effectSize,
        [yLabelDownload]: -Math.log10(point.pVal),
      });
    }

    const trace: Array<VolcanoTrace> = [];
    trace.push({
      x: inSignificantPts
        .filter((x: any) => x.label != this.state.selectedLabel)
        .map((x: any) => x.effectSize),
      y: inSignificantPts
        .filter((x: any) => x.label != this.state.selectedLabel)
        .map((x: any) => x.pVal),
      label: inSignificantPts
        .filter((x: any) => x.label != this.state.selectedLabel)
        .map((x: any) => x.label),
      linregress_y: [],
      color: 0,
      name: "",
    });
    trace.push({
      x: significantPts
        .filter((x: any) => x.label != this.state.selectedLabel)
        .map((x: any) => x.effectSize),
      y: significantPts
        .filter((x: any) => x.label != this.state.selectedLabel)
        .map((x: any) => x.pVal),
      label: significantPts
        .filter((x: any) => x.label != this.state.selectedLabel)
        .map((x: any) => x.label),
      linregress_y: [],
      color: 2,
      name: "qVal <= 0.05",
    });

    if (this.state.selectedLabel) {
      const highlightLabel = this.state.selectedLabel;
      const highlightIndex = labels.indexOf(highlightLabel);
      const highlightPVal = pVals[highlightIndex];
      const highlightEffectSize = effectSizes[highlightIndex];
      trace.push({
        x: [highlightEffectSize],
        y: [highlightPVal],
        label: [highlightLabel],
        linregress_y: [],
        color: 4,
        size: 12,
        name: "selected",
      });
    }

    const plotProps = {
      xLabel,
      yLabel,
      traces: trace,
      showAxesOnSameScale: false, // defaulting to false until someone requests this for this plot as well
      cellLinesToHighlight: new Set([]), // currently detached from cell line highlighting, see pivotal ##166772731
      onPointClick: (point: { customdata: any }) => {
        const geneName = point.customdata.selectToLabelAnnotationKey as string;
        const index = this.props.result.data.findIndex(
          (row: any) => row.label === geneName
        );
        this.setState({
          selectedLabel: geneName,
        });
        if (this.props.onTableClick) {
          this.props.onTableClick(
            this.props.result.data[index].vectorId,
            this.props.result.colorSliceId
              ? this.props.result.colorSliceId
              : undefined,
            this.props.result.filterSliceId
          );
        }

        if (this.props.onLabelClick) {
          this.props.onLabelClick(geneName);
        }
      },
      downloadData,
    };

    return (
      <div
        style={{
          flexDirection: "column",
          justifyContent: "center",
          flex: "auto",
          minWidth: "0px",
          position: "relative",
        }}
      >
        <div key="resultVolcano" style={{ flex: "auto", height: "300px" }}>
          <SelectionState>
            {(selectedLabels, setSelectedLabels) => (
              <VolcanoPlot
                Plotly={this.props.Plotly}
                additionalPlotlyCallbacks={{
                  plotly_selected: (e) => {
                    const labels = e?.points
                      ? e.points.map(
                          (p: any) => p.customdata.selectToLabelAnnotationKey
                        )
                      : [];

                    setSelectedLabels(labels);
                  },
                }}
                additionalToolbarWidgets={[
                  <SaveContextButton
                    entityType={this.props.result.entityType}
                    selectedLabels={selectedLabels}
                  />,
                ]}
                {...plotProps}
              />
            )}
          </SelectionState>
        </div>
      </div>
    );
  };

  render() {
    return (
      <div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              width: "100%",
            }}
          >
            {this.renderResultPanel()}
          </div>
        </div>
      </div>
    );
  }
}
