import React, { useEffect, useMemo, useState } from "react";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import styles from "../CompoundTiles.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { useDoseTableDataContext } from "src/compound/hooks/DoseTableDataContext";
import useHeatmapData from "src/compound/heatmapTab/hooks/useHeatmapData";
import PrototypeBrushableHeatmap from "src/compound/heatmapTab/doseViabilityHeatmap/components/PrototypeBrushableHeatmap";
import { legacyPortalAPI } from "@depmap/api";
import { sortHeatmapByViability } from "src/compound/heatmapTab/heatmapPlotUtils";
import { TableFormattedData } from "src/compound/types";

interface HeatmapTileProps {
  compoundName: string;
  isLoadingDataset: boolean;
}

const ErrorLoading: React.FC = () => {
  return (
    <article
      className={`${styles.HeatmapTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">Heatmap</h2>
        <div className="card_padding">
          <div className={styles.errorMessage}>
            There was an error loading this tile.
          </div>
        </div>
      </div>
    </article>
  );
};

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

export const HeatmapTile: React.FC<HeatmapTileProps> = ({
  compoundName,
  isLoadingDataset,
}) => {
  const {
    tableFormattedData,
    doseColumnNames,
    error,
    isLoading,
  } = useDoseTableDataContext();

  const { heatmapFormattedData } = useHeatmapData(
    tableFormattedData,
    doseColumnNames
  );

  // Sort data by ascending mean viability
  const sortedHeatmapFormattedData = useMemo(
    () => sortHeatmapByViability(heatmapFormattedData),
    [heatmapFormattedData]
  );

  // TODO: Always show InfoIcon once we have content for the popoverContent
  const showInfoIcon = false;
  const customInfoImg = (
    <img
      src={toStaticUrl("img/gene_overview/info_purple.svg")}
      alt="heatmap info tip"
      className={styles.infoImage}
    />
  );

  if (!isLoading && error) {
    return <ErrorLoading />;
  }

  return (
    <article
      className={`${styles.HeatmapTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Compound Viability
          {showInfoIcon && (
            <InfoIcon
              target={customInfoImg}
              popoverContent={<p>{"This is a tooltip"}</p>}
              popoverId={`struc-detail-popover`}
              trigger={["hover", "focus"]}
            />
          )}
        </h2>
        <div className="card_padding">
          <div className={styles.subHeader}>
            {compoundName} sensitivity distributed per dose
          </div>
          {(isLoading || isLoadingDataset) && !error && <PlotSpinner />}
          {!isLoading && !error && sortedHeatmapFormattedData && (
            <PrototypeBrushableHeatmap
              data={{
                ...sortedHeatmapFormattedData,
                x: sortedHeatmapFormattedData.x,
                y: sortedHeatmapFormattedData.y,
                z: sortedHeatmapFormattedData.z,
              }}
              onLoad={() => {}}
              xAxisTitle={"Cell Lines"}
              yAxisTitle={`Dose`}
              legendTitle={"Viability"}
              interactiveVersion={false}
            />
          )}
          {tableFormattedData && (
            <TopLinesMiniTable tableFormattedData={tableFormattedData} />
          )}
        </div>
      </div>
    </article>
  );
};
