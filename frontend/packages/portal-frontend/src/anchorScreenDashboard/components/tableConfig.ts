import { ModelIdCell, ScatterPlotCell, VolcanoPlotCell } from "./cells";

const columns = [
  { accessor: "ModelID", Cell: ModelIdCell },
  { accessor: "StrippedCellLineName" },
  { accessor: "OncotreeLineage" },
  { accessor: "OncotreePrimaryDisease" },
  { accessor: "OncotreeSubtype" },
  { accessor: "Drug" },
  { accessor: "ExperimentID" },
  { accessor: "ControlArmScreenID" },
  { accessor: "DrugArmScreenID" },
  {
    accessor: "volcano plot link",
    disableFilters: true,
    disableSortBy: true,
    Header: "",
    Cell: VolcanoPlotCell,
    maxWidth: 30,
  },
  {
    accessor: "scatter plot link",
    disableFilters: true,
    disableSortBy: true,
    Header: "",
    Cell: ScatterPlotCell,
    maxWidth: 30,
  },
];

const defaultColumnsToShow = [
  "ModelID",
  "StrippedCellLineName",
  "OncotreeLineage",
  "OncotreePrimaryDisease",
  "Drug",
  "volcano plot link",
  "scatter plot link",
];

const sorted = [{ id: "ModelID", desc: false }];

export default { columns, defaultColumnsToShow, sorted };
