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
  screenTypeLabel: string;
}

const formatTextWrap = (text: string, maxLineLength: number) => {
  const words = text.replace(/[\r\n]+/g, " ").split(" ");
  let lineLength = 0;

  return words.reduce((result, word) => {
    if (lineLength + word.length >= maxLineLength) {
      lineLength = word.length;
      return result + `<br>${word}`; // don't add spaces upfront
    }

    lineLength += word.length + (result ? 1 : 0);
    return result ? result + ` ${word}` : `${word}`; // add space only when needed
  }, "");
};

const TopFeaturesOverallTile = ({
  plotTitle,
  topFeaturesData,
  entityLabel,
  screenTypeLabel,
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
        <h5>FEATURE SET</h5>
      </div>
      <div className={styles.bottomLegend}>
        <div>
          <div className={styles.legendItem}>
            <div className={styles.cellContextBox} />
            <div className={styles.legendLabel}>Cell Context</div>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.confoundersBox} />
            <div className={styles.legendLabel}>Confounders</div>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.driverEventsBox} />
            <div className={styles.legendLabel}>Driver Events</div>
          </div>
        </div>
        <div>
          <div className={styles.legendItem}>
            <div className={styles.geneticDerangementBox} />
            <div className={styles.legendLabel}>Genetic Derangement</div>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.dnaBox} />
            <div className={styles.legendLabel}>DNA</div>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.rnaSeqBox} />
            <div className={styles.legendLabel}>RNASeq</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ height: "350px" }}>
      <p
        style={{
          marginLeft: "10px",
          marginRight: "10px",
          marginBottom: "15px",
        }}
      >
        Top features for {entityLabel} are listed according to {screenTypeLabel}{" "}
        Summed Importance.
      </p>
      <div className="card_padding stacked-boxplot-graphs-padding">
        <div className={styles.PredictabilityTab}>
          {!topFeaturesData && !topFeaturesPlotElement && (
            <PlotSpinner height={"100%"} />
          )}
          {topFeaturesData && (
            <BarChart
              title={plotTitle}
              categoryValues={xValues}
              xAxisTitle={"Adjusted Feature Importance"}
              categoryLabels={yValues.map((val: string) =>
                formatTextWrap(val, 50)
              )}
              height={330}
              margin={{
                l: 298,

                r: 20,

                b: 50,

                t: 0,

                pad: 8,
              }}
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
  );
};

export default TopFeaturesOverallTile;
