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
import CorrelationFilters, {
  FilterOption,
} from "../components/CorrelationFilters";

export default {
  title: "Components/CorrelationAnalysis/CorrelationAnalysisPage",
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

const featureTypesPromise = () => {
  return new Promise<any[]>((resolve) => {
    setTimeout(() => {
      resolve(featureTypeOptions);
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
      // add index as unique id to use for selection
      resolve(
        correlationAnalysisData.map((data, i) => {
          return { id: i, ...data };
        })
      );
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
  const [selectedRows, setSelectedRows] = React.useState(new Set());
  const [correlationAnalysisData, setCorrelationAnalysisData] = React.useState<
    any[]
  >([]);
  const [
    filteredTableCorrelationAnalysisData,
    setFilteredTableCorrelationAnalysisData,
  ] = React.useState<any[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await correlationAnalysisDataPromise();
        setCorrelationAnalysisData(data);
      } catch (e) {
        console.log(e);
      }
    })();
  }, []);

  console.log(correlationAnalysisData);

  const doseColors = React.useMemo(() => {
    let doses = [];
    if (correlationAnalysisData.length) {
      const colors = [
        { hex: "#A0DA38" },
        { hex: "#4AC16D" },
        { hex: "#1EA187" },
        { hex: "#277F8E" },
        { hex: "#365C8D" },
        { hex: "#46327E" },
        { hex: "#440154" },
        { hex: "#F89540" },
        { hex: "#CC4778" },
      ];
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
      doses = Array.from(new Set(columnData["imatinib Dose"])).sort((a, b) => {
        return a - b;
      });
      return doses.map((dose, i) => {
        if (i >= colors.length) {
          return { hex: undefined, dose: dose };
        } else {
          return { ...colors[i], dose };
        }
      });
    }
    return doses;
  }, [correlationAnalysisData]);

  const columnNamesToPlotVariables = {
    "Correlation Coefficient": "x",
    "-log10 qval": "y",
    // Feature: "label",
    Feature: "text",
  };

  React.useEffect(() => {
    // if no filter applied, show all correlation analysis data
    if (
      selectedFeatureTypes.length == 0 &&
      selectedDoses.length == 0 &&
      Object.keys(allSelectedLabels).length == 0
    ) {
      setFilteredTableCorrelationAnalysisData(correlationAnalysisData);
    } else {
      // keep list of all selected plot or table features
      const selectedDataWithLabelFront: any[] = [];

      // keep only selected feature types and selected doses and unselected features in plot or table
      const filtered = correlationAnalysisData.filter((data) => {
        let keepCondition;
        // We want to keep data where feature type and dose is selected
        if (selectedFeatureTypes.length && selectedDoses.length) {
          keepCondition =
            selectedFeatureTypes.includes(data["Feature Type"]) &&
            selectedDoses.includes(data["imatinib Dose"]);
        }
        // keep data where feature type is selected
        else if (selectedFeatureTypes.length) {
          keepCondition = selectedFeatureTypes.includes(data["Feature Type"]);
        }
        // keep data where dose is selected
        else if (selectedDoses.length) {
          keepCondition = selectedDoses.includes(data["imatinib Dose"]);
        } else {
          keepCondition = data !== null;
        }

        // We also want to remove features that are selected so that we can move those data to front of list later
        const removeCondition =
          data["Feature Type"] in allSelectedLabels &&
          allSelectedLabels[data["Feature Type"]].includes(data["Feature"]);
        // data that should be moved to front must additionally be filtered
        if (removeCondition && keepCondition) {
          selectedDataWithLabelFront.push(data);
        }

        return keepCondition && !removeCondition;
      });

      // Sort by feature label first, then by dose
      selectedDataWithLabelFront.sort((a, b) => {
        if (a["Feature"] === b["Feature"]) {
          return a["imatinib Dose"] - b["imatinib Dose"]; // sort by dose within the same feature
        } else {
          return a["Feature"].localeCompare(b["Feature"]); // otherwise sort by type
        }
      });
      const selectedIds = selectedDataWithLabelFront.map((data) => {
        return data.id;
      });
      setSelectedRows(new Set(selectedIds));

      // move selected features from plot or table up to front of data list
      setFilteredTableCorrelationAnalysisData(
        selectedDataWithLabelFront.concat(filtered)
      );
    }
  }, [
    selectedFeatureTypes,
    selectedDoses,
    allSelectedLabels,
    correlationAnalysisData,
  ]);

  const volcanoDataForFeatureType = React.useMemo(() => {
    if (correlationAnalysisData.length) {
      return correlationAnalysisData.reduce((acc, curRecord) => {
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
            color: doseColors.find(
              (doseColor) => doseColor.dose === doseCategory
            ).hex,
          };
        }
        const columnNames = Object.keys(correlationAnalysisData[0]);
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
      }, {});
    }
    return {};
  }, [correlationAnalysisData]);
  console.log("volcanodata: \n", volcanoDataForFeatureType);

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
        <CorrelationFilters
          getDatasets={featureTypesPromise}
          onChangeDataset={(dataset: string) => console.log(dataset)}
          getFeatureTypes={featureTypesPromise}
          onChangeFeatureTypes={(featureTypes: string[]) =>
            setSelectedFeatureTypes(featureTypes !== null ? featureTypes : [])
          }
          doses={doseColors.map((doseColor) => doseColor.dose)}
          onChangeDoses={(newDoses) =>
            setSelectedDoses(newDoses ? newDoses : [])
          }
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
          doseColors={doseColors}
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
        <CorrelationsTable
          data={filteredTableCorrelationAnalysisData}
          selectedRows={selectedRows}
          onChangeSelections={(selections: any[]) => {
            const prevSelections = Array.from(selectedRows);
            // if selections size decreases then a row was deselected. Deselect all selected features for that feature type
            if (selections.length < prevSelections.length) {
              // should only be one unselected at a time
              // TODO: use set difference once es2024 supported
              const unselectedId = prevSelections.filter(
                (x) => !selections.includes(x)
              )[0];
              const featureTypeFeatureToRemove = filteredTableCorrelationAnalysisData.find(
                (data) => data.id == unselectedId
              );
              if (featureTypeFeatureToRemove) {
                const feature = featureTypeFeatureToRemove["Feature"];
                const featureType = featureTypeFeatureToRemove["Feature Type"];
                setAllSelectedLabels({
                  ...allSelectedLabels,
                  [featureType]: allSelectedLabels[featureType].filter(
                    (label) => label !== feature
                  ),
                });
              }
            }
            // if selections size increases then a row was selected and all doses for the selected feature type's feature should be selected
            else {
              // should only be one new selected at a time
              const newSelectedId = selections.filter(
                (x) => !prevSelections.includes(x)
              )[0];
              const featureTypeFeatureToAdd = filteredTableCorrelationAnalysisData.find(
                (data) => data.id == newSelectedId
              );
              if (featureTypeFeatureToAdd) {
                const featureType = featureTypeFeatureToAdd["Feature Type"];
                const feature = featureTypeFeatureToAdd["Feature"];
                const newSelectedLabels =
                  featureType in allSelectedLabels
                    ? [...allSelectedLabels[featureType]].push(feature)
                    : [feature];
                setAllSelectedLabels({
                  ...allSelectedLabels,
                  [featureType]: newSelectedLabels,
                });
              }
            }
          }}
        />
        <p>
          Showing {filteredTableCorrelationAnalysisData.length} of{" "}
          {correlationAnalysisData.length} entries
        </p>
      </div>
    </div>
  );
}
