import React, { useMemo, useState } from "react";
import BarChart from "src/plot/components/BarChart";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { FEATURE_SET_COLORS, TopFeaturesBarData } from "../models/types";

export interface TopFeaturesOverallTileProps {
  plotTitle: string;
  topFeaturesData: TopFeaturesBarData | null;
  entityLabel: string;
}

const TopFeaturesOverallTile = ({
  plotTitle,
  topFeaturesData,
  entityLabel,
}: TopFeaturesOverallTileProps) => {
  const [
    topFeaturesPlotElement,
    setTopFeaturesPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  const xValues = useMemo(
    () =>
      topFeaturesData
        ? topFeaturesData.data.adj_feature_importance.reverse()
        : [],
    [topFeaturesData]
  );

  const yValues = useMemo(
    () => (topFeaturesData ? topFeaturesData.data.feature.reverse() : []),
    [topFeaturesData]
  );

  const customColors = useMemo(() => {
    return topFeaturesData
      ? topFeaturesData.data.feature_set
          .map((set) => {
            console.log(set);
            const test = FEATURE_SET_COLORS.get(set);
            console.log(test);
            return FEATURE_SET_COLORS.get(set) || "#000000";
          })
          .reverse()
      : [];
  }, [topFeaturesData]);

  const customLegend = (
    <div className={styles.legendContainer}>
      <div className={styles.legendTitle}>
        <h4>FEATURE SET</h4>
      </div>
      <div className={styles.bottomLegend}>
        <div className={styles.cellContextBox} />
        <div className={styles.legendLabel}>Cell Context</div>
        <div className={styles.driverEventsBox} />
        <div className={styles.legendLabel}>Driver Events</div>
        <div className={styles.geneticDerangementBox} />
        <div className={styles.legendLabel}>Genetic Derangement</div>
        <div className={styles.dnaBox} />
        <div className={styles.legendLabel}>DNA</div>
        <div className={styles.rnaSeqBox} />
        <div className={styles.legendLabel}>RNASeq</div>
      </div>
    </div>
  );

  return (
    <article className="card_wrapper stacked-boxplot-tile">
      <div className="card_border container_fluid" style={{ height: "530px" }}>
        <h2 className="no_margin cardtitle_text">Top Features Overall</h2>
        <p
          style={{
            marginLeft: "10px",
            marginRight: "10px",
            marginBottom: "15px",
          }}
        >
          Top features for {entityLabel} are listed according to CRISPR Summed
          Importance.
        </p>
        <div className="card_padding stacked-boxplot-graphs-padding">
          <div className={styles.PredictabilityTab}>
            {!topFeaturesData && !topFeaturesPlotElement && (
              <PlotSpinner height={"100%"} />
            )}
            {topFeaturesData && (
              <BarChart
                title={plotTitle}
                xValues={xValues}
                yValues={yValues}
                height={360}
                customColors={customColors}
                customLegend={customLegend}
                onLoad={(element: ExtendedPlotType | null) => {
                  if (element) {
                    setTopFeaturesPlotElement(element);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default TopFeaturesOverallTile;
