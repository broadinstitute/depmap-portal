import React, { useEffect, useState } from "react";
import styles from "../styles/ContextExplorer.scss";
import { CellLineOverview } from "../models/types";
import WideTable from "@depmap/wide-table";
import { enabledFeatures } from "@depmap/globals";

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

  const columns = [
    {
      accessor: "cellLineDisplayName",
      Header: "Cell Line",
      maxWidth: 800,
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
      maxWidth: 120,
      minWidth: 120,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "primaryDisease",
      Header: "Primary Disease",
      maxWidth: 150,
      minWidth: 150,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "level0",
      Header: "Level0",
      maxWidth: 90,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "level1",
      Header: "Level1",
      maxWidth: 90,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "level2",
      Header: "Level2",
      maxWidth: 90,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "level3",
      Header: "Level3",
      maxWidth: 90,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "level4",
      Header: "Level4",
      maxWidth: 90,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "level5",
      Header: "Level5",
      maxWidth: 90,
      customFilter: renderFilterPlaceholder,
    },
    {
      accessor: "crispr",
      Header: "CRISPR",
      maxWidth: 90,
      disableFilters: true,
    },
    {
      accessor: "rnai",
      Header: "RNAi",
      maxWidth: 90,
      disableFilters: true,
    },
    {
      accessor: "wes",
      Header: "WES",
      maxWidth: 90,
      disableFilters: true,
    },
    {
      accessor: "wgs",
      Header: "WGS",
      maxWidth: 90,
      disableFilters: true,
    },
    {
      accessor: "rna_seq",
      Header: "RNASeq",
      maxWidth: 90,
      disableFilters: true,
    },
    {
      accessor: "prismRepurposing",
      Header: "PRISM Repurposing",
      maxWidth: 90,
      disableFilters: true,
    },
  ];

  const defaultColumns = [
    "cellLineDisplayName",
    "lineage",
    "primaryDisease",
    "level0",
    "level1",
    "level2",
    "level3",
    "crispr",
    "rnai",
    "wgs",
    "wes",
    "rna_seq",
    "prismRepurposing",
  ];

  if (enabledFeatures.context_explorer_prerelease_datasets) {
    columns.push({
      accessor: "prismOncRef",
      Header: "PRISM OncRef",
      maxWidth: 90,
      disableFilters: true,
    });

    defaultColumns.push("prismOncRef");
  }

  return (
    <div className={styles.plotContainer}>
      <div className={styles.overviewTable}>
        <div style={{ maxWidth: "99%", minWidth: "100px" }}>
          <WideTable
            rowHeight={28}
            data={cellLineData}
            allowDownloadFromTableDataWithMenu
            allowDownloadFromTableDataWithMenuFileName="context-explorer-overview.csv"
            columns={columns}
            getTrProps={getTrProps}
            defaultColumnsToShow={defaultColumns}
          />
        </div>
      </div>
    </div>
  );
}

export default OverviewTable;
