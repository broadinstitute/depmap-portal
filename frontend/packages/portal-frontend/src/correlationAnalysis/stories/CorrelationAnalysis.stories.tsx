import * as React from "react";
import * as Plotly from "plotly.js";

import WideTable from "@depmap/wide-table";
import { correlationAnalysisData } from "./correlationAnalysisData";
import { VolcanoPlot as VolcanoPlotOld } from "../../plot/components/VolcanoPlot";
import { VolcanoData } from "../../plot/models/volcanoPlotModels";
import { VolcanoPlot } from "@depmap/plotly-wrapper";
import { VolcanoTrace } from "@depmap/plotly-wrapper";
import AsyncSelect from "react-select/async";
import { TagOption } from "@depmap/common-components";
import Select, {
  OptionsType,
  ValueType,
  ActionMeta,
  ActionTypes,
} from "react-select";
import { Button } from "react-bootstrap";
import { getHighlightLineColor } from "@depmap/utils";
import CorrelationsTable from "../components/CorrelationsTable";
import CorrelationsPlots from "../components/CorrelationsPlots";

export default {
  title: "Components/CorrelationAnalysis",
  component: WideTable,
};

// Compound: string;
// "imatinib Dose": string;
// "Feature Type": string;
// Feature: string;
// "Correlation Coefficient": number;
// "-log10 qval": number;
// Rank: number;

const featureTypeOptions: TagOption[] = [
  { label: "CRISPR knock-out", value: "CRISPR knock-out", isDisabled: false },
  { label: "Copy number", value: "Copy number", isDisabled: true },
  { label: "Gene expression", value: "Gene expression", isDisabled: false },
  { label: "Metabolomics", value: "Metabolomics", isDisabled: true },
  { label: "Micro RNA", value: "Micro RNA", isDisabled: true },
  { label: "Proteomics", value: "Proteomics", isDisabled: true },
  {
    label: "Repurposing compounds",
    value: "Repurposing compounds",
    isDisabled: false,
  },
  { label: "shRNA knockdown", value: "shRNA knockdown", isDisabled: true },
];

const filterOptions = (inputValue: string) =>
  featureTypeOptions.filter((val) =>
    val.label.toLowerCase().includes(inputValue.toLowerCase())
  );

const featureTypesPromise = (inputValue: string) => {
  return new Promise<TagOption[]>((resolve) => {
    setTimeout(() => {
      resolve(filterOptions(inputValue));
    }, 1000);
  });
};

const correlationAnalysisDataPromise = () => {
  return new Promise<
    {
      Compound: string;
      "imatinib Dose": string;
      "Feature Type": string;
      Feature: string;
      "Correlation Coefficient": number;
      "-log10 qval": number;
      Rank: number;
    }[]
  >((resolve) => {
    setTimeout(() => {
      resolve(correlationAnalysisData);
    }, 1000);
  });
};

export function Story() {
  const plotlyRef = React.useRef(null);

  const compound = "imatinib";
  const [selectedFeatureTypes, setSelectedFeatureTypes] = React.useState<
    string[]
  >([]);
  const [selectedDoses, setSelectedDoses] = React.useState<string[]>([]);
  const [allSelectedLabels, setAllSelectedLabels] = React.useState<{
    [key: string]: string[];
  }>({});

  console.log(correlationAnalysisData);
  const columnData = {};
  const columnNames = Object.keys(correlationAnalysisData[0]);
  columnNames.forEach(
    (colName) =>
      (columnData[colName] = correlationAnalysisData.map(
        (record) => record[colName]
      ))
  );
  console.log(columnNames);
  console.log(columnData);

  const getDoseOptions = () => {
    const doses = new Set(columnData["imatinib Dose"]);
    console.log(doses);
    // TODO: need to sort doses
    const doseOptions = [];
    doses.forEach((dose) => {
      doseOptions.push({ label: dose, value: dose });
    });
    return doseOptions;
  };

  const columnNamesToPlotVariables = {
    "Correlation Coefficient": "x",
    "-log10 qval": "y",
    // Feature: "label",
    Feature: "text",
  };

  const filteredTableCorrelationAnalysisData = React.useMemo(() => {
    // if no filter applied, show all correlation analysis data
    if (
      selectedFeatureTypes.length == 0 &&
      selectedDoses.length == 0 &&
      Object.keys(allSelectedLabels).length == 0
    ) {
      return correlationAnalysisData;
    }

    // keep list of all selected plot or table features
    const selectedDataWithLabelFront: any[] = [];

    // keep only selected feature types and selected doses and unselected features in plot or table
    const filtered = correlationAnalysisData.filter((data) => {
      // We want to keep data where feature type or dose is selected
      const keepCondition =
        selectedFeatureTypes.includes(data["Feature Type"]) ||
        selectedDoses.includes(data["imatinib Dose"]);
      // We want to remove features that are selected so that we can move those data to front of list later
      const removeCondition =
        data["Feature Type"] in allSelectedLabels &&
        allSelectedLabels[data["Feature Type"]].includes(data["Feature"]);
      if (
        data["Feature Type"] in allSelectedLabels &&
        allSelectedLabels[data["Feature Type"]].includes(data["Feature"])
      ) {
        selectedDataWithLabelFront.push(data);
      }

      return keepCondition || !removeCondition;
    });

    // Sort by feature label first, then by dose
    selectedDataWithLabelFront.sort((a, b) => {
      if (a["Feature"] === b["Feature"]) {
        return a["imatinib Dose"] - b["imatinib Dose"]; // sort by dose within the same feature
      } else {
        return a["Feature"].localeCompare(b["Feature"]); // otherwise sort by type
      }
    });

    // move selected features from plot or table up to front of data list
    return selectedDataWithLabelFront.concat(filtered);
  }, [selectedFeatureTypes, selectedDoses, allSelectedLabels]);

  const volcanoDataForFeatureType = correlationAnalysisData.reduce(
    (acc, curRecord) => {
      const key = curRecord["Feature Type"];
      if (!acc[key]) {
        acc[key] = {};
      }
      const doseCategory = curRecord["imatinib Dose"];
      if (!(doseCategory in acc[key])) {
        acc[key][doseCategory] = {
          x: [],
          y: [],
          label: [],
          text: [],
          isSignificant: [],
          name: doseCategory,
          color: undefined, // "blue", // causes marker.color undefined
        };
      }
      columnNames.forEach((colName) => {
        if (colName in columnNamesToPlotVariables) {
          const value = curRecord[colName];
          if (colName == "-log10 qval") {
            const val = Math.pow(10, -value);
            // VolcanoPlotProp `y` data by default log transforms values. To do the complement: Math.exp(-x)
            acc[key][doseCategory][columnNamesToPlotVariables[colName]].push(
              val
            );
          } else if (colName == "Feature") {
            const label = curRecord[colName];
            const text =
              `<b>${label}</b><br>` +
              `<b>${compound} dose (uM)</b>: ${curRecord["imatinib Dose"]}<br>` +
              `<b>Correlation:</b> ${curRecord[
                "Correlation Coefficient"
              ].toFixed(3)}<br>` +
              `<b>-log10(p-value):</b> ${curRecord["-log10 qval"].toFixed(
                3
              )}<br>` +
              `<b>Feature Type:</b> ${curRecord["Feature Type"]}`;
            acc[key][doseCategory][columnNamesToPlotVariables[colName]].push(
              text
            );
            acc[key][doseCategory]["label"].push(label);
          } else {
            acc[key][doseCategory][columnNamesToPlotVariables[colName]].push(
              value
            );
          }
        }
      });
      acc[key][doseCategory]["isSignificant"].push(false);
      return acc;
    },
    {}
  );
  console.log(volcanoDataForFeatureType);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 7fr",
        gridAutoRows: "1fr 1fr",
        gridTemplateAreas: "'a b b b b b b b''a c c c c c c c'",
        gap: "2rem",
        // marginBottom: "50px",
      }}
    >
      {/* {JSON.stringify(selectedFeatureTypes)} */}
      <div
        style={{
          gridArea: "a",
        }}
      >
        <h1>FILTERS</h1>
        <header>Dataset</header>
        <AsyncSelect
          placeholder="Choose Dataset"
          defaultOptions
          loadOptions={featureTypesPromise}
          isMulti
          onChange={(value, action) => {
            console.log(value, action);
            setSelectedFeatureTypes(
              value !== null
                ? value.map((selectedFeatureType) => selectedFeatureType.value)
                : []
            );
          }}
        />
        <header>Dose</header>
        <Select
          placeholder="imatinib Doses(uM)"
          defaultOptions
          options={getDoseOptions()}
          isMulti
          onChange={(value, action) => {
            console.log(value, action);
            setSelectedDoses(
              value ? value.map((selectedDose) => selectedDose.value) : []
            );
          }}
        />
        <header>Feature Types</header>
        <AsyncSelect
          placeholder="Select Feature Types"
          defaultOptions
          loadOptions={featureTypesPromise}
          isMulti
          onChange={(value, action) => {
            console.log(value, action);
            setSelectedFeatureTypes(
              value !== null
                ? value.map((selectedFeatureType) => selectedFeatureType.value)
                : []
            );
          }}
        />
        <header>Features</header>
        <AsyncSelect
          placeholder="Select Features"
          defaultOptions
          loadOptions={featureTypesPromise}
          isMulti
          onChange={(value, action) => {
            console.log(value, action);
            setSelectedFeatureTypes(
              value !== null
                ? value.map((selectedFeatureType) => selectedFeatureType.value)
                : []
            );
          }}
        />
      </div>

      <div style={{ gridArea: "b" }}>
        <CorrelationsPlots
          featureTypesToShow={
            selectedFeatureTypes.length
              ? selectedFeatureTypes
              : Object.keys(volcanoDataForFeatureType)
          }
          dosesToFilter={selectedDoses}
          volcanoDataForFeatureTypes={volcanoDataForFeatureType}
          featureTypeSelectedLabels={allSelectedLabels}
          forwardSelectedLabels={(
            featureType: string,
            newSelectedLabels: string[]
          ) => {
            setAllSelectedLabels({
              ...allSelectedLabels,
              [featureType]: newSelectedLabels,
            });
          }}
        />
      </div>

      <div style={{ gridArea: "c" }}>
        <CorrelationsTable data={filteredTableCorrelationAnalysisData} />
        <p>
          Showing {filteredTableCorrelationAnalysisData.length} of{" "}
          {correlationAnalysisData.length} entries
        </p>
      </div>
    </div>
  );
}
