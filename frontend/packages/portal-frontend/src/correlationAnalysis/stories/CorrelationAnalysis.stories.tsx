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
  const volcanoData: Array<VolcanoData> = [
    {
      x: columnData["Correlation Coefficient"],
      y: columnData["-log10 qval"].map((x) => {
        return Math.exp(-x);
      }),
      label: columnData["imatinib Dose"],
      text: columnData["Feature"],
      isSignificant: new Array(correlationAnalysisData.length).fill(false),
    },
  ];

  console.log(columnNames);
  console.log(columnData);
  console.log(volcanoData);

  return (
    <div>
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
