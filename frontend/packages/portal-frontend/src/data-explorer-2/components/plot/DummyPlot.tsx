import React from "react";
import Section from "src/data-explorer-2/components/Section";
import StartScreen from "src/data-explorer-2/components/StartScreen";
import PrototypeScatterPlot from "src/data-explorer-2/components/plot/prototype/PrototypeScatterPlot";
import DataExplorerPlotControls from "src/data-explorer-2/components/plot/DataExplorerPlotControls";
import { useLegendState } from "src/data-explorer-2/components/plot/prototype/plotUtils";
import PlotLegend from "src/data-explorer-2/components/plot/PlotLegend";
import PlotSelections from "src/data-explorer-2/components/plot/PlotSelections";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

interface Props {
  isInitialPageLoad: boolean;
  feedbackUrl: string | null;
  contactEmail: string;
  tutorialLink: string;
  hadError?: boolean;
}

function ErrorState({
  feedbackUrl,
  contactEmail,
}: {
  feedbackUrl: string | null;
  contactEmail: string;
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
            <ErrorState feedbackUrl={feedbackUrl} contactEmail={contactEmail} />
          )}
        </div>
      </div>
      <div className={styles.right}>
        <Section title="Legend">
          <PlotLegend
            data={null}
            continuousBins={null}
            color_by={undefined}
            hiddenLegendValues={hiddenLegendValues}
            onClickLegendItem={onClickLegendItem}
            colorMap={{}}
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
