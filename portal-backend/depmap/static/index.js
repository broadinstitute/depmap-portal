"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const ReactDOM = require("react-dom");
const CellLineSelector_1 = require("./components/compute/CellLineSelector");
const DtableRequest_1 = require("./components/compute/DtableRequest");
const ControlledPlot_1 = require("./components/interactive/ControlledPlot");
const AllDownloads_1 = require("./components/allDownloads/AllDownloads");
const PredictiveModelsTable_1 = require("./components/predictive/PredictiveModelsTable");
const route_1 = require("./utilities/route");
const DoseResponseCurve_1 = require("./components/compounds/DoseResponseCurve");

class InteractivePage extends React.Component {
  render() {
    let defaultProps = {
      xDataset: "",
      xFeature: "",
      yDataset: "",
      yFeature: "",
      colorDataset: "",
      colorFeature: "",
      filterDataset: "",
      filterFeature: "",
      regressionLine: "false",
      plotOnly: "true",
      colors: "",
    };
    let validProps = Object.keys(defaultProps);
    let controlledPlotProps = {};
    let query = this.props.query;
    for (let prop of validProps) {
      if (query.hasOwnProperty(prop)) {
        controlledPlotProps[prop] = query[prop];
      } else {
        controlledPlotProps[prop] = defaultProps[prop];
      }
    }
    return React.createElement(
      ControlledPlot_1.ControlledPlot,
      Object.assign({ runLmStats: this.props.runLmStats }, controlledPlotProps)
    );
  }
}
exports.InteractivePage = InteractivePage;
class DownloadsPage extends React.Component {
  render() {
    let validProps = Object.keys({
      release: "",
      file: "",
    });
    let allDownloadsProps = {};
    for (let prop of Object.keys(this.props.query)) {
      if (validProps.indexOf(prop) > -1) {
        allDownloadsProps[prop] = this.props.query[prop];
      }
    }
    return React.createElement(
      AllDownloads_1.AllDownloads,
      Object.assign({}, allDownloadsProps)
    );
  }
}
exports.DownloadsPage = DownloadsPage;
function initInteractivePage(elementId, runLmStats) {
  ReactDOM.render(
    React.createElement(InteractivePage, {
      query: route_1.getQueryParams(),
      runLmStats: runLmStats,
    }),
    document.getElementById(elementId)
  );
}
exports.initInteractivePage = initInteractivePage;
function initDownloadsPage(elementId) {
  ReactDOM.render(
    React.createElement(DownloadsPage, { query: route_1.getQueryParams() }),
    document.getElementById(elementId)
  );
}
exports.initDownloadsPage = initDownloadsPage;
function initCellSel() {
  ReactDOM.render(
    React.createElement(
      "div",
      null,
      React.createElement("br", null),
      React.createElement("br", null),
      React.createElement(CellLineSelector_1.CellSel, null)
    ),
    document.getElementById("test")
  );
}
exports.initCellSel = initCellSel;
function initDTableRequest(datasets) {
  ReactDOM.render(
    React.createElement(
      "div",
      null,
      React.createElement("br", null),
      React.createElement("br", null),
      React.createElement(DtableRequest_1.DTableRequest, {
        datasets: datasets,
      }),
      React.createElement("br", null),
      React.createElement("br", null)
    ),
    document.getElementById("test2")
  );
}
exports.initDTableRequest = initDTableRequest;
function initPredictiveTable(elementId, entityId) {
  ReactDOM.render(
    React.createElement(PredictiveModelsTable_1.PredictiveModelsTable, {
      entityId: entityId,
    }),
    document.getElementById(elementId)
  );
}
exports.initPredictiveTable = initPredictiveTable;
function initDoseResponseCurve(elementId, measurements, parameters) {
  let doseResponseComponent = ReactDOM.render(
    React.createElement(DoseResponseCurve_1.DoseResponseCurve, {
      measurements: measurements,
      curve: parameters,
      ref: (doseResponseComponent) => {
        window.doseResponseComponent = doseResponseComponent;
      },
    }),
    document.getElementById(elementId)
  );
}
exports.initDoseResponseCurve = initDoseResponseCurve;
//# sourceMappingURL=index.js.map
