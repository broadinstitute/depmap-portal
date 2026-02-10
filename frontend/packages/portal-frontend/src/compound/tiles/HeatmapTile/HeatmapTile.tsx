import React, { useMemo } from "react";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import styles from "../CompoundTiles.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import useHeatmapData from "src/compound/heatmapTab/hooks/useHeatmapData";
import PrototypeBrushableHeatmap from "src/compound/heatmapTab/doseViabilityHeatmap/components/PrototypeBrushableHeatmap";
import { sortHeatmapByViability } from "src/compound/heatmapTab/heatmapPlotUtils";
import DoseTriangleLabel from "./DoseTriangleLabel";
import ErrorLoading from "./ErrorLoading";
import TopLinesMiniTable from "./TopLinesMiniTable";
import { useDoseViabilityDataContext } from "src/compound/hooks/DoseViabilityDataContext";

interface HeatmapTileProps {
  compoundName: string;
  displayName: string;
  isLoadingDataset: boolean;
}

export const HeatmapTile: React.FC<HeatmapTileProps> = ({
  compoundName,
  displayName,
  isLoadingDataset,
}) => {
  const {
    tableFormattedData,
    doseColumnNames,
    error,
    isLoading,
  } = useDoseViabilityDataContext();

  const { heatmapFormattedData } = useHeatmapData(
    tableFormattedData,
    doseColumnNames
  );

  // Sort data by ascending mean viability
  const sortedHeatmapFormattedData = useMemo(
    () => sortHeatmapByViability(heatmapFormattedData),
    [heatmapFormattedData]
  );

  const heatmapTabHref = (() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "heatmap");
    return url.pathname + url.search;
  })();

  const customInfoImg = (
    <img
      style={{
        height: "13px",
        margin: "1px 3px 4px 3px",
        cursor: "pointer",
      }}
      src={toStaticUrl("img/gene_overview/info_purple.svg")}
      alt="description of term"
      className="icon"
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
          <InfoIcon
            target={customInfoImg}
            popoverContent={
              <p>
                {
                  "This tile shows a miniature version of the figure shown on the 'Heatmap' tab. Each column represents a cell line and each row represents dose, starting with the highest dose. Red indicates loss of viability in that cell line at that dose. An interactive version of this figure can be found on the 'Heatmap' tab."
                }
              </p>
            }
            popoverId={`compound-viability-popover`}
            trigger={["hover", "focus"]}
          />
        </h2>
        <div className="card_padding">
          {tableFormattedData && (
            <div className={styles.subHeader}>
              {compoundName} ({displayName}) sensitivity distributed per dose
            </div>
          )}
          {(isLoading || isLoadingDataset) && !error && <PlotSpinner />}
          {!isLoading && !error && sortedHeatmapFormattedData && (
            <div className={styles.heatmapWithTriangle}>
              <DoseTriangleLabel />

              <div className={styles.heatmapContainer}>
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
              </div>
            </div>
          )}
          {tableFormattedData && (
            <TopLinesMiniTable tableFormattedData={tableFormattedData} />
          )}
          <hr className={styles.heatmapSeparator} />
          {tableFormattedData && (
            <p className="stacked-boxplot-download-container">
              View details in{" "}
              <a href={heatmapTabHref} className={styles.buttonLink}>
                Heatmap
              </a>
            </p>
          )}
        </div>
      </div>
    </article>
  );
};
