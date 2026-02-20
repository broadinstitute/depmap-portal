import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import ResistanceScreenDashboard from "src/resistanceScreenDashboard/components/ResistanceScreenDashboard";

const container = document.getElementById("resistance_screen_dashboard");

const App = () => {
  return (
    <ErrorBoundary>
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
        <ResistanceScreenDashboard />
      </PlotlyLoaderProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
