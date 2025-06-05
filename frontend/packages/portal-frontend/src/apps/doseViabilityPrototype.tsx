import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import DoseViabilityPrototypePage from "src/doseViabilityPrototype/components/DoseViabilityPrototypePage";

const container = document.getElementById("dose_viability_prototype");

const App = () => {
  return (
    <ErrorBoundary>
      <DoseViabilityPrototypePage />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
