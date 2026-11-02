import React, { useState } from "react";
import { Panel, PanelGroup } from "react-bootstrap";
import { ModelConfigOut } from "@depmap/types";
import CorrelationMeter from "src/predictability/components/CorrelationMeter";
import { ScreenTypeData } from "../hooks/usePredictiveInsightsData";
import { getScreenTypeLabel } from "../screenTypeLabel";
import FeatureTable from "./FeatureTable";
import MiniScatterPlot from "./MiniScatterPlot";
import ModelCorrelationHeatmap from "./ModelCorrelationHeatmap";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  screenType: ScreenTypeData;
  configs: ModelConfigOut[];
  dimType: string;
}

export default function ModelPerformanceSection({
  screenType,
  configs,
  dimType,
}: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const models = configs
    .map((config) => ({
      config,
      fit: screenType.response.model_fits.find(
        (f) => f.config_name === config.model_config_name
      ),
    }))
    .filter(
      (
        entry
      ): entry is {
        config: ModelConfigOut;
        fit: NonNullable<typeof entry.fit>;
      } => entry.fit !== undefined
    );

  return (
    <section className={styles.modelPerformanceSection}>
      <h3
        className={styles.screenTypeHeader}
        style={{ color: screenType.color, borderColor: screenType.color }}
      >
        {getScreenTypeLabel(screenType)}
      </h3>
      <PanelGroup
        accordion
        id={`model-performance-${screenType.actualsDatasetId}`}
        activeKey={activeKey}
        onSelect={(key) =>
          setActiveKey((prevKey) => (prevKey === key ? null : (key as string)))
        }
      >
        {models.map(({ config, fit }) => (
          <Panel
            eventKey={config.model_config_name}
            key={config.model_config_name}
          >
            <Panel.Heading>
              <Panel.Toggle componentClass="div">
                <div className={styles.modelHeaderRow}>
                  <span className={styles.modelHeaderName}>
                    <span className={styles.expandIndicator}>
                      {activeKey === config.model_config_name ? "−" : "+"}
                    </span>
                    {config.model_config_name}
                  </span>
                  <span className={styles.modelHeaderGaugeLabel}>
                    Correlation between observed and predicted
                  </span>
                  <span className={styles.modelHeaderGauge}>
                    <span className={styles.correlationValue}>
                      {fit.prediction_actual_correlation.toFixed(2)}
                    </span>
                    <CorrelationMeter
                      correlation={fit.prediction_actual_correlation}
                      useGradedColorScheme
                      showLabel={false}
                    />
                  </span>
                </div>
              </Panel.Toggle>
            </Panel.Heading>
            <Panel.Body collapsible>
              {activeKey === config.model_config_name && (
                <div>
                  <div className={styles.modelPlotsRow}>
                    <div className={styles.modelPlotColumn}>
                      <MiniScatterPlot
                        dimType={dimType}
                        xAxis={{
                          datasetId: screenType.response.actuals_dataset.id,
                          featureGivenId:
                            screenType.response.actuals_feature_given_id,
                          featureLabel:
                            screenType.response.actuals_feature_label,
                          axisLabel: "Actual",
                        }}
                        yAxis={{
                          datasetId: fit.predictions_dataset.id,
                          featureGivenId:
                            screenType.response.actuals_feature_given_id,
                          featureLabel: fit.predictions_dataset.name,
                          axisLabel: "Prediction",
                        }}
                      />
                    </div>
                    <div className={styles.modelPlotColumn}>
                      <ModelCorrelationHeatmap fit={fit} dimType={dimType} />
                    </div>
                  </div>
                  <FeatureTable
                    fit={fit}
                    dimType={dimType}
                    actualsDatasetId={screenType.response.actuals_dataset.id}
                    actualsFeatureGivenId={
                      screenType.response.actuals_feature_given_id
                    }
                    actualsFeatureLabel={
                      screenType.response.actuals_feature_label
                    }
                  />
                </div>
              )}
            </Panel.Body>
          </Panel>
        ))}
      </PanelGroup>
    </section>
  );
}
