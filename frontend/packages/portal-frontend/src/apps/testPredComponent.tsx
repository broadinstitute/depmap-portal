import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import { Grid } from "react-bootstrap";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import PredictiveInsightsPage from "src/predictiveInsights/components/PredictiveInsightsPage";

const dataEl = document.getElementById("test-pred-component-data");
const { dimType, givenId } = JSON.parse(dataEl?.textContent || "{}");

const container = document.getElementById("test-pred-component-root");

const responseDescription = () => {
  if (dimType === "gene") {
    return "response to the inactivation of the gene";
  }

  if (dimType === "compound_v2") {
    return "response to treament with the compound";
  }

  return "NA";
};

const App = () => (
  <ErrorBoundary>
    <Grid>
      <p>
        This page shows how well machine-learning models can predict{" "}
        {responseDescription()} given other molecular features of the cell
        lines. A series of random forest models have been trained with
        increasing number of features and an aggregate summary is shown in the
        plots at the top of this page. In the following section, one can see the
        specific results of each individual model.
      </p>
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
        <PredictiveInsightsPage dimType={dimType} dimTypeGivenId={givenId} />
      </PlotlyLoaderProvider>
    </Grid>
  </ErrorBoundary>
);

ReactDOM.render(<App />, container);
