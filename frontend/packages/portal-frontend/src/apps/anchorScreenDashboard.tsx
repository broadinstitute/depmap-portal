import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import AnchorScreenDashboard from "src/anchorScreenDashboard/components/AnchorScreenDashboard";

const container = document.getElementById("anchor_screen_dashboard");

const App = () => {
  return (
    <ErrorBoundary>
      <AnchorScreenDashboard />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
