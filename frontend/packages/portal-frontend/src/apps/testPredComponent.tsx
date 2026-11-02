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

const App = () => (
  <ErrorBoundary>
    <Grid>
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
        <PredictiveInsightsPage dimType={dimType} dimTypeGivenId={givenId} />
      </PlotlyLoaderProvider>
    </Grid>
  </ErrorBoundary>
);

ReactDOM.render(<App />, container);
