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
  // The plot fetched successfully and has no point to draw. Distinct from
  // `hadError` (something broke) and from the initial-load state (nothing has
  // been asked for yet).
  hasNoData?: boolean;
}

function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // invalid URL
  }

  return "#";
}

function safeMailto(email: string): string {
  const trimmed = email.trim();

  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(trimmed)) {
    return "#";
  }

  return `mailto:${encodeURIComponent(trimmed)}`;
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
          <a
            href={safeUrl(feedbackUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            this form
          </a>
          .
        </p>
      ) : (
        <p>
          If this problem persists, please contact us at{" "}
          <a href={safeMailto(`mailto:${contactEmail}`)}>{contactEmail}</a>.
        </p>
      )}
      {errorMessage && <details>{errorMessage}</details>}
    </div>
  );
}

// The plot came back fine and drew nothing, which is not an error and is not a
// blank slate — both of which this component already had a state for, and
// neither of which explains itself.
//
// Deliberately says nothing about *why* beyond the dataset, because the cause
// is the same whatever the plot is doing: a dataset measures some entities and
// not others, and neither aggregating nor expanding can invent the ones it
// doesn't measure. Naming the mechanism ("your context resolved to 29
// transcripts, of which this dataset tracks none") would explain it precisely
// to the handful of people who already know what a context is.
function NoDataState() {
  return (
    <div className={styles.plotEmptyState}>
      <h2>Nothing to plot</h2>
      <p>
        This dataset has no values for the things you selected. Try a different
        dataset, or widen the selection.
      </p>
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
  hasNoData = false,
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
          {!isInitialPageLoad && !hadError && !hasNoData && <EmptyScatter />}
          {!isInitialPageLoad && !hadError && hasNoData && <NoDataState />}
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
            handleClickShowAll={() => {}}
            handleClickHideAll={() => {}}
            // No real plot config exists in this placeholder state, so
            // there's nothing to resolve — "color" is an arbitrary but
            // harmless choice given `data` is null.
            target="color"
          />
        </Section>
        <Section title="Plot Selections">
          <PlotSelections
            data={null}
            plot_type={null}
            selectedIds={null}
            onClickVisualizeSelected={() => {}}
            onClickSaveSelectionAsContext={() => {}}
          />
        </Section>
      </div>
    </div>
  );
}

export default DummyPlot;
