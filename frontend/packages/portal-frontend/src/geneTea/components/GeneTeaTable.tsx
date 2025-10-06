import styles from "../styles/GeneTea.scss";
import React, { useState } from "react";
import WideTable from "@depmap/wide-table";
import PlotSpinner from "src/plot/components/PlotSpinner";
import GeneTeaContextModal from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/GeneTeaContextModal";

interface GeneTeaTableProps {
  error: boolean;
  isLoading: boolean;
  height: number;
  tableData: any;
  prefferedTableDataForDownload: any;
  selectedTableRows: Set<string>;
  termToMatchingGenesMap: Map<string, string[]>;
  handleChangeSelection: (selections: string[]) => void;
}

const GeneTeaTable: React.FC<GeneTeaTableProps> = ({
  error,
  isLoading,
  height,
  tableData,
  prefferedTableDataForDownload,
  selectedTableRows,
  termToMatchingGenesMap,
  handleChangeSelection,
}) => {
  const [selectedTerm, setSelectedTerm] = useState<{
    matchingGenes: string[];
    term: string;
  } | null>(null);

  const tableColumns = [
    {
      accessor: "term",
      Header: "Term",
      helperText:
        "The '~' prefix indicates a synonym set, with sub-terms defined in the ‘Synonyms’ column.",
      minWidth: 800,
      Cell: (row: any) => (
        <>
          {termToMatchingGenesMap ? (
            <button
              key={`${row.value}`}
              type="button"
              className={styles.linkButton}
              onClick={() =>
                setSelectedTerm({
                  term: row.value,
                  matchingGenes: termToMatchingGenesMap.get(row.value)!,
                })
              }
            >
              {row.value}
            </button>
          ) : (
            <p>{row.value}</p>
          )}
        </>
      ),
    },
    {
      accessor: "termGroup",
      Header: "Term Group",
      helperText:
        "The '++' suffix indicates the term is a member of a group. All terms in a group share the same value in this column.",
      minWidth: 800,
    },
    {
      accessor: "fdr",
      Header: "FDR",
      helperText:
        "False discovery rate value, from Benjamini-Hochberg correction of hypergeometric test p-values.",
      minWidth: 800,
    },
    {
      accessor: "effectSize",
      Header: "Effect Size",
      helperText:
        "Sum of tf-idf across query genes. This measures the total information encoded by this term for the query, and approximates its specificity.",
      minWidth: 800,
    },
    {
      accessor: "matchingGenesInList",
      Header: "Matching Query",
      helperText: "Genes in query whose descriptions contain the term.",
      minWidth: 800,
    },
    {
      accessor: "nMatchingGenesInList",
      Header: "n Matching Query",
      helperText:
        "Number of genes in query whose descriptions contain the term.",
      minWidth: 800,
    },
    {
      accessor: "nMatchingGenesOverall",
      Header: "n Matching Overall",
      helperText:
        "Number of genes in background whose descriptions contain the term. This defines how common a term is.",
      minWidth: 800,
    },
    {
      accessor: "synonyms",
      Header: "Synonyms",
      helperText: "Semicolon-separated list of terms making up a synonym set.",
      minWidth: 200,
    },
  ];
  let tableContent;
  if (error) {
    tableContent = (
      <div className={styles.errorMessage}>Error loading table data.</div>
    );
  } else if (isLoading) {
    tableContent = (
      <div className={styles.tableSpinnerContainer}>
        <PlotSpinner />
      </div>
    );
  } else {
    tableContent = (
      <div>
        <WideTable
          idProp="term"
          rowHeight={28}
          data={tableData || []}
          prefferedTableDataForDownload={prefferedTableDataForDownload || []}
          fixedHeight={height}
          columns={tableColumns}
          columnOrdering={tableColumns.map((col) => col.accessor)}
          defaultColumnsToShow={tableColumns.map((col) => col.accessor)}
          selectedTableLabels={selectedTableRows}
          onChangeSelections={handleChangeSelection}
          hideSelectAllCheckbox
          allowDownloadFromTableDataWithMenu
          allowDownloadFromTableDataWithMenuFileName="gene-tea-data.csv"
          minimumAllowedSelections={1}
          useAllSelectionsInOnChangeHandler
        />{" "}
        <GeneTeaContextModal
          show={Boolean(selectedTerm)}
          term={selectedTerm?.term || ""}
          synonyms={[]}
          coincident={[]}
          matchingGenes={selectedTerm?.matchingGenes || []}
          onClose={() => setSelectedTerm(null)}
        />
      </div>
    );
  }
  return <>{tableContent}</>;
};

export default GeneTeaTable;
