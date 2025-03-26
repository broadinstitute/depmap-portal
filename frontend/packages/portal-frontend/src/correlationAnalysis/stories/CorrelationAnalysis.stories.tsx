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

export function Story() {
  const plotlyRef = React.useRef(null);

  const [selectedFeatureTypes, setSelectedFeatureTypes] = React.useState<
    string[]
  >([]);

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

  const columnNamesToPlotVariables = {
    "Correlation Coefficient": "x",
    "-log10 qval": "y",
    Feature: "label",
    // Feature: "text",
  };

  const filteredTableCorrelationAnalysisData = React.useMemo(() => {
    // if no selected feature types, show all correlation analysis data
    if (selectedFeatureTypes.length == 0) {
      return correlationAnalysisData;
    }
    return correlationAnalysisData.filter((data) =>
      selectedFeatureTypes.includes(data["Feature Type"])
    );
  }, [selectedFeatureTypes]);

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

  const filteredVolcanoPlotFeatureTypes = React.useMemo(() => {
    if (selectedFeatureTypes.length == 0) {
      // if no selected feature types, return all feature types that have volcano plot data
      return featureTypeOptions
        .filter(
          (featureTypeOption) =>
            featureTypeOption.value in volcanoDataForFeatureType
        )
        .map((featureTypeOption) => featureTypeOption.value);
    }
    return selectedFeatureTypes;
  }, [selectedFeatureTypes]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 7fr",
        gridAutoRows: "1fr 1fr",
        gridTemplateAreas: "'a b b b b b b b''a c c c c c c c'",
        // gap: "2rem",
        // marginBottom: "50px",
      }}
    >
      {/* {JSON.stringify(selectedFeatureTypes)} */}
      <div
        style={{
          gridArea: "a",
        }}
      >
        <AsyncSelect
          placeholder="imatinib Doses(uM)"
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
        <AsyncSelect
          placeholder="Select Feature Types..."
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "2rem",
            marginBottom: "50px",
          }}
        >
          {filteredVolcanoPlotFeatureTypes.map((selectedFeatureType) => {
            return (
              <>
                {/* <div>
                  <header
                    style={{
                      textAlign: "center",
                      fontSize: "18px",
                      backgroundColor: "lightgray",
                    }}
                  >{`${selectedFeatureType}`}</header>
                  <VolcanoPlot
                    Plotly={Plotly}
                    xLabel="Correlation Coefficient"
                    yLabel="q value"
                    traces={Object.values(
                      volcanoDataForFeatureType[selectedFeatureType]
                    )}
                    showAxesOnSameScale={false}
                    cellLinesToHighlight={new Set([])}
                    onPointClick={(point) => {
                      console.log(point);
                    }}
                    downloadData={[]}
                  />
                </div> */}
                <div>
                  <header
                    style={{
                      textAlign: "center",
                      fontSize: "18px",
                      backgroundColor: "lightgray",
                    }}
                  >
                    {selectedFeatureType}
                  </header>
                  <VolcanoPlotOld
                    Plotly={Plotly}
                    // ref={plotlyRef}
                    xLabel="Correlation Coefficient"
                    yLabel="q value"
                    data={Object.values(
                      volcanoDataForFeatureType[selectedFeatureType]
                    )}
                  />
                </div>
              </>
            );
          })}
        </div>
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
