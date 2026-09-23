import React, { useState } from "react";
import { Panel, PanelGroup } from "react-bootstrap";
import { MiniDataExplorerPlot } from "@depmap/data-explorer-2";
import { ModelConfigOut } from "@depmap/types";
import StyledMeter from "src/common/components/StyledMeter";
import { ScreenTypeData } from "../hooks/usePredictiveInsightsData";
import { getScreenTypeLabel } from "../screenTypeLabel";
import { buildModelPredictionsPlotConfig } from "../dataExplorerPlotConfig";
import FeatureTable from "./FeatureTable";
import PlaceholderBox from "./PlaceholderBox";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  screenType: ScreenTypeData;
  configs: ModelConfigOut[];
  dimType: string;
  dimTypeGivenId: string;
}

export default function ModelPerformanceSection({
  screenType,
  configs,
  dimType,
  dimTypeGivenId,
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
        onSelect={(key: string) =>
          setActiveKey((prevKey) => (prevKey === key ? null : key))
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
                  <span className={styles.modelHeaderGauge}>
                    <StyledMeter
                      value={fit.prediction_actual_correlation}
                      min={-1}
                      max={1}
                      showLabel
                      toFixed={3}
                      style={{ barColor: screenType.color, width: "120px" }}
                    />
                    <span className={styles.modelHeaderGaugeLabel}>
                      R between observed and predicted
                    </span>
                  </span>
                </div>
              </Panel.Toggle>
            </Panel.Heading>
            <Panel.Body collapsible>
              {activeKey === config.model_config_name && (
                <div>
                  <div className={styles.modelPlotsRow}>
                    <div className={styles.modelPlotColumn}>
                      <MiniDataExplorerPlot
                        plotConfig={buildModelPredictionsPlotConfig({
                          dimType,
                          actualsDatasetId:
                            screenType.response.actuals_dataset.id,
                          actualsFeatureGivenId:
                            screenType.response.actuals_feature_given_id,
                          actualsFeatureLabel:
                            screenType.response.actuals_feature_label,
                          predictionsDatasetId: fit.predictions_dataset.id,
                          predictionsFeatureGivenId:
                            screenType.response.actuals_feature_given_id,
                          predictionsFeatureLabel: fit.predictions_dataset.name,
                        })}
                        xAxisLabel="Actual"
                        yAxisLabel="Prediction"
                      />
                    </div>
                    <PlaceholderBox label="Top Feature Correlation Map heatmap — TODO" />
                  </div>
                  <FeatureTable
                    fit={fit}
                    dimType={dimType}
                    dimTypeGivenId={dimTypeGivenId}
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
