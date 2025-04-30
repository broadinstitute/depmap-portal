import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import { ApiContext } from "@depmap/api";
import { apiFunctions } from "src/common/utilities/context";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import DoseViabilityPrototypePage from "src/doseViabilityPrototype/components/DoseViabilityPrototypePage";

const container = document.getElementById("dose_viability_prototype");

const App = () => {
  return (
    <ApiContext.Provider value={apiFunctions.depmap}>
      <ErrorBoundary>
        <DoseViabilityPrototypePage />
      </ErrorBoundary>
    </ApiContext.Provider>
  );
};

ReactDOM.render(<App />, container);
