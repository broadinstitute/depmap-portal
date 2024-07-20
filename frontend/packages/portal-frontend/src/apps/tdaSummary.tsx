import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import TDASummaryPage from "src/tda/components/TDASummaryPage";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";

const container = document.getElementById("react-tda-summary");

const App = () => {
  return (
    <ErrorBoundary>
      <TDASummaryPage />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
