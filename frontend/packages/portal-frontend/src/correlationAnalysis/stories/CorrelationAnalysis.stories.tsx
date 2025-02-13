import * as React from "react";
import * as Plotly from "plotly.js";

import WideTable from "@depmap/wide-table";
import { correlationAnalysisData } from "./correlationAnalysisData";
import { VolcanoPlot } from "../../plot/components/VolcanoPlot";
import { VolcanoData } from "../../plot/models/volcanoPlotModels";
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

export function Story() {
  const plotlyRef = React.useRef(null);
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

  // const volcanoData: Array<VolcanoData> = [
  //   {
  //     x: columnData["Correlation Coefficient"],
  //     y: columnData["-log10 qval"].map((x) => {
  //       return Math.exp(-x);
  //     }),
  //     label: columnData["imatinib Dose"],
  //     text: columnData["Feature"],
  //     isSignificant: new Array(correlationAnalysisData.length).fill(false),
  //   },
  // ];
  // console.log(volcanoData);

  const columnNamesToPlotVariables = {
    "Correlation Coefficient": "x",
    "-log10 qval": "y",
    "imatinib Dose": "label",
    Feature: "text",
  };
  const volcanoDataForFeatureType = correlationAnalysisData.reduce(
    (acc, curRecord) => {
      const key = curRecord["Feature Type"];
      if (!acc[key]) {
        acc[key] = { x: [], y: [], label: [], text: [], isSignificant: [] };
      }
      columnNames.forEach((colName) => {
        if (colName in columnNamesToPlotVariables) {
          const value = curRecord[colName];
          if (colName == "-log10 qval") {
            // VolcanoPlotProp `y` data by default log transforms values. To do the complement: Math.exp(-x)
            acc[key][columnNamesToPlotVariables[colName]].push(
              Math.exp(-value)
            );
          } else {
            acc[key][columnNamesToPlotVariables[colName]].push(value);
          }
        }
      });
      acc[key]["isSignificant"].push(false);
      return acc;
    },
    {}
  );
  console.log(volcanoDataForFeatureType);

  return (
    <div>
      {["Gene expression", "CRISPR knock-out", "Repurposing compounds"].map(
        (selectedFeatureType) => {
          return (
            <VolcanoPlot
              Plotly={Plotly}
              // ref={plotlyRef}
              xLabel="Correlation Coefficient"
              yLabel="-log10 (q value"
              data={[volcanoDataForFeatureType[selectedFeatureType]]}
            />
          );
        }
      )}

      <WideTable
        columns={[
          { accessor: "Compound" },
          { accessor: "imatinib Dose" },
          { accessor: "Feature Type" },
          { accessor: "Feature" },
          { accessor: "Correlation Coefficient" },
          { accessor: "-log10 qval" },
          { accessor: "Rank" },
        ]}
        data={correlationAnalysisData}
      />
    </div>
  );
}
