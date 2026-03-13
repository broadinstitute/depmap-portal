import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import AnchorScreenDashboard from "src/anchorScreenDashboard/components/AnchorScreenDashboard";

const container = document.getElementById("anchor_screen_dashboard");

const App = () => {
  return (
    <ErrorBoundary>
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
        <AnchorScreenDashboard />
      </PlotlyLoaderProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
