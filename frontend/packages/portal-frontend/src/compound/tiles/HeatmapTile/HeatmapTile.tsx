import React, { useEffect, useMemo, useState } from "react";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import styles from "./CompoundTiles.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { useDoseTableDataContext } from "src/compound/hooks/DoseTableDataContext";
import useHeatmapData from "src/compound/heatmapTab/hooks/useHeatmapData";
import PrototypeBrushableHeatmap from "src/compound/heatmapTab/doseViabilityHeatmap/components/PrototypeBrushableHeatmap";
import { legacyPortalAPI } from "@depmap/api";
import { TableRow } from "src/compound/types";
import { sortHeatmapByViability } from "src/compound/heatmapTab/heatmapPlotUtils";

const FailedToLoadHeatmapTile: React.FC = () => {
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

export const HeatmapTile: React.FC = () => {
  const {
    tableFormattedData,
    doseColumnNames,
    error,
    isLoading,
  } = useDoseTableDataContext();

  const { heatmapFormattedData, doseMin, doseMax } = useHeatmapData(
    tableFormattedData,
    doseColumnNames
  );

  // Sort data by ascending mean viability
  const sortedHeatmapFormattedData = useMemo(
    () => sortHeatmapByViability(heatmapFormattedData),
    [heatmapFormattedData]
  );

  const [cellLineUrlRoot, setCellLineUrlRoot] = useState<string | null>(null);

  useEffect(() => {
    legacyPortalAPI.getCellLineUrlRoot().then((urlRoot: string) => {
      setCellLineUrlRoot(urlRoot);
    });
  }, []);
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
    return <FailedToLoadHeatmapTile />;
  }

  return (
    <article
      className={`${styles.HeatmapTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Heatmap
          {showInfoIcon && (
            <InfoIcon
              target={customInfoImg}
              popoverContent={<p>{"This is a tooltip"}</p>}
              popoverId={`struc-detail-popover`}
              trigger={["hover", "focus"]}
            />
          )}
        </h2>
        {isLoading && !error && <PlotSpinner />}
        {!isLoading && !error && sortedHeatmapFormattedData && (
          <PrototypeBrushableHeatmap
            data={{
              ...sortedHeatmapFormattedData,
              x: sortedHeatmapFormattedData.x,
              y: sortedHeatmapFormattedData.y,
              z: sortedHeatmapFormattedData.z,
            }}
            onLoad={() => {}}
            xAxisTitle="Cell Lines"
            yAxisTitle={`Dose`}
            legendTitle={"Viability"}
          />
        )}
      </div>
    </article>
  );
};
