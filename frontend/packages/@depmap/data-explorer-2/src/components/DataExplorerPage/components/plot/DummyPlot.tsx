import React from "react";
import Section from "../Section";
import StartScreen from "../StartScreen";
import PrototypeScatterPlot from "./prototype/PrototypeScatterPlot";
import DataExplorerPlotControls from "./DataExplorerPlotControls";
import { useLegendState } from "./prototype/plotUtils";
import PlotLegend from "./PlotLegend";
import PlotSelections from "./PlotSelections";
import styles from "../../styles/DataExplorer2.scss";

interface Props {
  isInitialPageLoad: boolean;
  feedbackUrl: string | null;
  contactEmail: string;
  tutorialLink: string;
  hadError?: boolean;
  errorMessage?: string;
}

function ErrorState({
  feedbackUrl,
  contactEmail,
  errorMessage,
}: {
  feedbackUrl: string | null;
  contactEmail: string;
  errorMessage: string;
}) {
  return (
    <div className={styles.plotEmptyState}>
      <h2>Sorry, an error occurred</h2>
      {feedbackUrl ? (
        <p>
          If this problem persists, please submit a report with{" "}
          <a href={feedbackUrl} target="_blank" rel="noopener noreferrer">
            this form
          </a>
          .
        </p>
      ) : (
        <p>
          If this problem persists, please contact us at{" "}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      )}
      {errorMessage && <details>{errorMessage}</details>}
    </div>
  );
}

function EmptyScatter() {
  const data = {
    x: [],
    y: [],
    xLabel: "",
    yLabel: "",
    hoverText: [],
  } as any;

  return (
    <PrototypeScatterPlot
      data={data}
      xKey="x"
      yKey="y"
      colorMap={new Map()}
      colorKey1="color1"
      colorKey2="color2"
      categoricalColorKey="catColorData"
      continuousColorKey="contColorData"
      hoverTextKey="hoverText"
      annotationTextKey="annotationText"
      height="auto"
      xLabel=""
      yLabel=""
    />
  );
}

function DummyPlot({
  isInitialPageLoad,
  feedbackUrl,
  contactEmail,
  tutorialLink,
  hadError = false,
  errorMessage = "",
}: Props) {
  const { hiddenLegendValues, onClickLegendItem } = useLegendState({
    plot_type: "scatter",
    index_type: "depmap_model",
    dimensions: {},
  });

  return (
    <div className={styles.DataExplorerScatterPlot}>
      <div className={styles.left}>
        <div className={styles.plotControls}>
          <DataExplorerPlotControls plotConfig={{}} isLoading />
        </div>
        <div className={styles.plot}>
          {isInitialPageLoad && <StartScreen tutorialLink={tutorialLink} />}
          {!isInitialPageLoad && !hadError && <EmptyScatter />}
          {!isInitialPageLoad && hadError && (
            <ErrorState
              feedbackUrl={feedbackUrl}
              contactEmail={contactEmail}
              errorMessage={errorMessage}
            />
          )}
        </div>
      </div>
      <div className={styles.right}>
        <Section title="Legend">
          <PlotLegend
            data={null}
            continuousBins={null}
            hiddenLegendValues={hiddenLegendValues}
            onClickLegendItem={onClickLegendItem}
            colorMap={new Map()}
            legendKeysWithNoData={null}
            handleClickShowAll={() => {}}
            handleClickHideAll={() => {}}
          />
        </Section>
        <Section title="Plot Selections">
          <PlotSelections
            data={null}
            plot_type={null}
            selectedLabels={null}
            onClickVisualizeSelected={() => {}}
            onClickSaveSelectionAsContext={() => {}}
          />
        </Section>
      </div>
    </div>
  );
}

export default DummyPlot;
