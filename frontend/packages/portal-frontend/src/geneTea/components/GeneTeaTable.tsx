import styles from "../styles/GeneTea.scss";
import React, { useState } from "react";
import WideTable from "@depmap/wide-table";
import PlotSpinner from "src/plot/components/PlotSpinner";
import GeneTeaContextModal from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/GeneTeaContextModal";

interface GeneTeaTableProps {
  error: boolean;
  isLoading: boolean;
  tableData: any;
  prefferedTableDataForDownload: any;
  selectedTableRows: Set<string>;
  termToMatchingGenesMap: Map<string, string[]>;
  handleChangeSelection: (selections: string[]) => void;
}

const GeneTeaTable: React.FC<GeneTeaTableProps> = ({
  error,
  isLoading,
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

  const renderFilterPlaceholder = ({
    column: { filterValue, setFilter },
  }: any) => {
    return (
      <input
        type="text"
        placeholder={`Search...`}
        value={filterValue || ""}
        onChange={(event) => setFilter(event.target.value || undefined)}
        style={{ width: "90%", fontSize: "12px" }}
      />
    );
  };

  const tableColumns = [
    {
      accessor: "Term",
      Header: "Term",
      tooltipText:
        "The '~' prefix indicates a synonym set, with sub-terms defined in the ‘Synonyms’ column.",
      minWidth: 150,
      width: 280,
      maxWidth: 500,
      customFilter: renderFilterPlaceholder,
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
      accessor: "Term Group",
      Header: "Term Group",
      tooltipText:
        "The '++' suffix indicates the term is a member of a group. All terms in a group share the same value in this column.",
      minWidth: 150,
      width: 1500,
      maxWidth: 2000,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "FDR",
      Header: "FDR",
      tooltipText:
        "False discovery rate value, from Benjamini-Hochberg correction of hypergeometric test p-values.",
      minWidth: 80,
      width: 80,
      maxWidth: 80,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "Effect Size",
      Header: "Effect Size",
      tooltipText:
        "Sum of tf-idf across query genes. This measures the total information encoded by this term for the query, and approximates its specificity.",
      minWidth: 90,
      width: 90,
      maxWidth: 90,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "Matching Query",
      Header: "Matching Query",
      tooltipText: "Genes in query whose descriptions contain the term.",
      minWidth: 180,
      width: 500,
      maxWidth: 1000,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "n Matching Query",
      Header: "n Matching Query",
      tooltipText:
        "Number of genes in query whose descriptions contain the term.",
      minWidth: 120,
      width: 120,
      maxWidth: 120,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "n Matching Overall",
      Header: "n Matching Overall",
      tooltipText:
        "Number of genes in background whose descriptions contain the term. This defines how common a term is.",
      minWidth: 130,
      width: 130,
      maxWidth: 130,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "Synonyms",
      Header: "Synonyms",
      tooltipText: "Semicolon-separated list of terms making up a synonym set.",
      minWidth: 180,
      width: 1000,
      maxWidth: 1000,
      customFilter: renderFilterPlaceholder,
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
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <WideTable
          idProp="Term"
          rowHeight={32}
          fixedHeight={500}
          data={tableData || []}
          prefferedTableDataForDownload={prefferedTableDataForDownload || []}
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
