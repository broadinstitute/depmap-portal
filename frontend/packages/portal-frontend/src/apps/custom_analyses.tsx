import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { CustomAnalysesPage } from "@depmap/custom-analyses";

const container = document.getElementById("custom_analyses");

const App = () => {
  return (
    <ErrorBoundary>
      <CustomAnalysesPage />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
