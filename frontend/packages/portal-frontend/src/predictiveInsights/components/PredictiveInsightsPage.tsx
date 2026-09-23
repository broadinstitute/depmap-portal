import React from "react";
import { Spinner } from "@depmap/common-components";
import { usePredictiveInsightsData } from "../hooks/usePredictiveInsightsData";
import { getScreenTypeLabel } from "../screenTypeLabel";
import AggregateScoresChart from "./AggregateScoresChart";
import GeneTeaTile from "./GeneTeaTile";
import ModelPerformanceSection from "./ModelPerformanceSection";
import styles from "../styles/PredictiveInsights.scss";

export interface PredictiveInsightsPageProps {
  dimType: string;
  dimTypeGivenId: string;
}

export default function PredictiveInsightsPage({
  dimType,
  dimTypeGivenId,
}: PredictiveInsightsPageProps) {
  const { data, error, isLoading } = usePredictiveInsightsData(
    dimType,
    dimTypeGivenId
  );

  if (error) {
    return (
      <div className={styles.errorBanner}>
        Something went wrong loading Predictive Insights for this {dimType}.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className={styles.loading}>
        <Spinner position="static" />
      </div>
    );
  }

  const { configs, screenTypes } = data;

  if (screenTypes.length === 0) {
    return (
      <div className={styles.errorBanner}>
        No predictive model results are available for this {dimType}.
      </div>
    );
  }

  return (
    <div>
      <div className={styles.overviewRow}>
        <article className="card_wrapper">
          <div className="card_border container_fluid">
            <h2 className="no_margin cardtitle_text">Aggregate Scores</h2>
            <AggregateScoresChart configs={configs} screenTypes={screenTypes} />
          </div>
        </article>
        {screenTypes.map((screenType) => (
          <GeneTeaTile
            key={screenType.actualsDatasetId}
            title={getScreenTypeLabel(screenType)}
            screenType={screenType}
            configs={configs}
          />
        ))}
      </div>
      <h2 className={styles.sectionHeader}>
        Model Performance — Performance according to{" "}
        {screenTypes.map(getScreenTypeLabel).join(" and ")}.
      </h2>
      {screenTypes.map((screenType) => (
        <ModelPerformanceSection
          key={screenType.actualsDatasetId}
          screenType={screenType}
          configs={configs}
          dimType={dimType}
          dimTypeGivenId={dimTypeGivenId}
        />
      ))}
    </div>
  );
}
