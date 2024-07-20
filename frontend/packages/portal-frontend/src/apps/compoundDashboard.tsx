import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import CompoundDashboard from "src/compoundDashboard/components/CompoundDashboard";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";

const container = document.getElementById("react-compound-dashboard");

const App = () => {
  return (
    <ErrorBoundary>
      <CompoundDashboard />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
