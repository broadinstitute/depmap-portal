import React, { useMemo, useState, useEffect } from "react";
import styles from "../CompoundTiles.scss";
import { legacyPortalAPI } from "@depmap/api";
import { TableFormattedData } from "src/compound/types";

interface TopLinesMiniTableProps {
  tableFormattedData: TableFormattedData;
}

const TopLinesMiniTable: React.FC<TopLinesMiniTableProps> = ({
  tableFormattedData,
}) => {
  const sortedTableFormattedData = useMemo(
    () => tableFormattedData?.sort((a, b) => a.auc - b.auc) || [],
    [tableFormattedData]
  );

  const [cellLineUrlRoot, setCellLineUrlRoot] = useState<string | null>(null);

  useEffect(() => {
    legacyPortalAPI.getCellLineUrlRoot().then((urlRoot: string) => {
      setCellLineUrlRoot(urlRoot);
    });
  }, []);

  return (
    <>
      <div className={styles.subHeader}>Top 5 Sensitive Lines</div>
      <table className={styles.heatmapTileTable}>
        <thead>
          <tr>
            <th className={styles.tableColumnHeader}>Cell Line</th>
            <th className={styles.tableColumnHeader}>AUC (Mean Viability)</th>
          </tr>
        </thead>
        <tbody>
          {[...sortedTableFormattedData].slice(0, 5).map((row) => (
            <tr key={row.cellLine}>
              <td>
                {cellLineUrlRoot ? (
                  <a
                    href={`${cellLineUrlRoot}${row.modelId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.cellLine}
                  </a>
                ) : (
                  row.cellLine
                )}
              </td>
              <td>{row.auc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

export default TopLinesMiniTable;
