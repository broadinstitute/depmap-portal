import React, { useEffect, useState } from "react";
import styles from "../styles/ContextExplorer.scss";
import { CellLineOverview } from "../models/types";
import WideTable from "@depmap/wide-table";

interface OverviewTableProps {
  cellLineData: CellLineOverview[];
  getCellLineUrlRoot: () => Promise<string>;
}

function OverviewTable(props: OverviewTableProps) {
  const { cellLineData, getCellLineUrlRoot } = props;
  const [cellLineUrlRoot, setCellLineUrlRoot] = useState<string | null>(null);

  useEffect(() => {
    getCellLineUrlRoot().then((urlRoot: string) => {
      setCellLineUrlRoot(urlRoot);
    });
  }, [getCellLineUrlRoot]);

  const getTrProps = () => {
    const className = "striped-row";
    return {
      className,
    };
  };

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

  const displayNameDepmapIdMap = new Map<string, string>();
  cellLineData.forEach((cellLineRow: CellLineOverview) => {
    displayNameDepmapIdMap.set(
      cellLineRow.cellLineDisplayName,
      cellLineRow.depmapId
    );
  });

  return (
    <div className={styles.plotContainer}>
      <div className={styles.overviewTable}>
        <WideTable
          rowHeight={28}
          data={cellLineData}
          allowDownloadFromTableDataWithMenu
          allowDownloadFromTableDataWithMenuFileName="context-explorer-overview.csv"
          columns={[
            {
              accessor: "cellLineDisplayName",
              Header: "Cell Line",
              maxWidth: 800,
              minWidth: 90,
              customFilter: renderFilterPlaceholder,
              Cell: (row: any) => (
                <>
                  {cellLineUrlRoot ? (
                    <a
                      href={`${cellLineUrlRoot}${displayNameDepmapIdMap.get(
                        row.value
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: "underline" }}
                    >
                      {row.value}
                    </a>
                  ) : (
                    <p>{row.value}</p>
                  )}
                </>
              ),
            },
            {
              accessor: "lineage",
              Header: "Lineage",
              maxWidth: 1000,
              minWidth: 90,
              customFilter: renderFilterPlaceholder,
            },
            {
              accessor: "primaryDisease",
              Header: "Primary Disease",
              maxWidth: 1000,
              minWidth: 90,
              customFilter: renderFilterPlaceholder,
            },
            {
              accessor: "subtype",
              Header: "Subtype",
              maxWidth: 1000,
              minWidth: 90,
              customFilter: renderFilterPlaceholder,
            },
            {
              accessor: "molecularSubtype",
              Header: "Molecular Subtype",
              maxWidth: 1000,
              minWidth: 90,
              customFilter: renderFilterPlaceholder,
            },
            {
              accessor: "crispr",
              Header: "CRISPR",
              maxWidth: 1000,
              minWidth: 75,
              disableFilters: true,
            },
            {
              accessor: "rnai",
              Header: "RNAi",
              maxWidth: 1000,
              minWidth: 75,
              disableFilters: true,
            },
            {
              accessor: "wes",
              Header: "WES",
              maxWidth: 1000,
              minWidth: 75,
              disableFilters: true,
            },
            {
              accessor: "wgs",
              Header: "WGS",
              maxWidth: 1000,
              minWidth: 75,
              disableFilters: true,
            },
            {
              accessor: "rna_seq",
              Header: "RNASeq",
              maxWidth: 1000,
              minWidth: 75,
              disableFilters: true,
            },
            {
              accessor: "prism",
              Header: "PRISM",
              maxWidth: 1000,
              minWidth: 75,
              disableFilters: true,
            },
          ]}
          getTrProps={getTrProps}
        />
      </div>
    </div>
  );
}

export default OverviewTable;
