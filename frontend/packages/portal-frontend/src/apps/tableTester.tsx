/* eslint react/jsx-props-no-spreading: "off" */
import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import WideTable from "@depmap/wide-table";

const container = document.getElementById("react-root");

const data = [];
const sampleData = [
  {
    "Cell Line": "HT29",
    "Depmap Id": "ACH-000552",
    "Map Id": "ht29",
    "Break Point 1": "13:38265769-38265769+",
    "Break Point 2": "13:26473373-26473373+",
    "Trans Class": "INV-like",
    "Gene 1": "SOX10",
    "Site 1": "In Intron, 0.4 kb away from Exon 7 of Gene TRPC4(-)",
    "Gene 2": "UNC93B1",
    "Site 2": "In Intron, 27.9 kb away from Exon 38 of Gene ATP8A2(+)",
    Fusion: "In frame: TRPC4,ATP8A2",
    "Multi Sv Fusion": "FALSE",
    "Cosmic Fus": "FALSE",
  },
  {
    "Cell Line": "HT29",
    "Depmap Id": "ACH-000552",
    "Map Id": "ht29",
    "Break Point 1": "16:78576039-78576039-",
    "Break Point 2": "16:78618727-78618727+",
    "Trans Class": "DEL-like",
    "Gene 1": "SOX10",
    "Site 1": "In Intron, 109.4 kb away from Exon 20 of Gene WWOX(+)",
    "Gene 2": "AMY1A",
    "Site 2": "In Intron, 106.4 kb away from Exon 21 of Gene WWOX(+)",
    Fusion: "In frame: CLEC3A,WWOX",
    "Multi Sv Fusion": "TRUE",
    "Cosmic Fus": "FALSE",
  },
  {
    "Cell Line": "HT29",
    "Depmap Id": "ACH-000552",
    "Map Id": "ht29",
    "Break Point 1": "6:128625701-128625701+",
    "Break Point 2": "6:158389390-158389390-",
    "Trans Class": "DUP-like",
    "Gene 1": "SOX10",
    "Site 1": "In Intron, 16.5 kb away from Exon 40 of Gene PTPRK(-)",
    "Gene 2": "MAP4K4",
    "Site 2": "Intergenic, 13.5 kb away from Gene SYNJ2(+)",
    Fusion: "In frame: PTPRK,PTPRK",
    "Multi Sv Fusion": "TRUE",
    "Cosmic Fus": "FALSE",
  },
  {
    "Cell Line": "UACC62",
    "Depmap Id": "ACH-000425",
    "Map Id": "ht29",
    "Break Point 1": "13:38265769-38265769+",
    "Break Point 2": "13:26473373-26473373+",
    "Trans Class": "INV-like",
    "Gene 1": "SOX10",
    "Site 1": "In Intron, 0.4 kb away from Exon 7 of Gene TRPC4(-)",
    "Gene 2": "UNC93B1",
    "Site 2": "In Intron, 27.9 kb away from Exon 38 of Gene ATP8A2(+)",
    Fusion: "In frame: TRPC4,ATP8A2",
    "Multi Sv Fusion": "FALSE",
    "Cosmic Fus": "FALSE",
  },
  {
    "Cell Line": "UACC62",
    "Depmap Id": "ACH-000425",
    "Map Id": "ht29",
    "Break Point 1": "16:78576039-78576039-",
    "Break Point 2": "16:78618727-78618727+",
    "Trans Class": "DEL-like",
    "Gene 1": "SOX10",
    "Site 1": "In Intron, 109.4 kb away from Exon 20 of Gene WWOX(+)",
    "Gene 2": "AMY1A",
    "Site 2": "In Intron, 106.4 kb away from Exon 21 of Gene WWOX(+)",
    Fusion: "In frame: CLEC3A,WWOX",
    "Multi Sv Fusion": "TRUE",
    "Cosmic Fus": "FALSE",
  },
  {
    "Cell Line": "UACC62",
    "Depmap Id": "ACH-000425",
    "Map Id": "ht29",
    "Break Point 1": "6:128625701-128625701+",
    "Break Point 2": "6:158389390-158389390-",
    "Trans Class": "DUP-like",
    "Gene 1": "SOX10",
    "Site 1": "In Intron, 16.5 kb away from Exon 40 of Gene PTPRK(-)",
    "Gene 2": "MAP4K4",
    "Site 2": "Intergenic, 13.5 kb away from Gene SYNJ2(+)",
    Fusion: "In frame: PTPRK,PTPRK",
    "Multi Sv Fusion": "TRUE",
    "Cosmic Fus": "FALSE",
  },
];

for (let i = 0; i < 1000; i += 1) {
  data.push(sampleData[i % sampleData.length]);
}

const props: any = {
  data,
  columns: [
    {
      accessor: "Cell Line",
      renderFunction: (e: any) => {
        const { value } = e;
        const row = e.original || e.row.original;
        const id = row["Depmap Id"];

        return `<a href="/cell_line/${id}">${value}</a>`;
      },
    },
    {
      accessor: "Depmap Id",
    },
    {
      accessor: "Map Id",
    },
    {
      accessor: "Break Point 1",
    },
    {
      accessor: "Break Point 2",
    },
    {
      accessor: "Trans Class",
    },
    {
      accessor: "Gene 1",
      renderFunction: (e: any) => {
        const { value } = e;
        return `<a href="/gene/${value}">${value}</a>`;
      },
    },
    {
      accessor: "Site 1",
    },
    {
      accessor: "Gene 2",
      renderFunction: (e: any) => {
        const { value } = e;
        return `<a href="/gene/${value}">${value}</a>`;
      },
    },
    {
      accessor: "Site 2",
    },
    {
      accessor: "Fusion",
    },
    {
      accessor: "Multi Sv Fusion",
    },
    {
      accessor: "Cosmic Fus",
    },
  ],
  invisibleColumns: [],
  defaultColumnsToShow: [
    "Cell Line",
    "Trans Class",
    "Gene 1",
    "Gene 2",
    "Fusion",
  ],
  additionalReactTableProps: {},
  downloadURL: "/partials/data_table/download/translocation_by_gene?gene_id=11",
  sorted: [],
};

const App = () => {
  return (
    <ErrorBoundary>
      <WideTable {...props} />
      <WideTable {...props} idProp="Cell Line" />
      <br />
      <br />
      <br />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
