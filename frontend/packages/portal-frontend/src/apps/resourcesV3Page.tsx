import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { BrowserRouter as Router } from "react-router-dom";
import ResourcesV3Page from "src/resourcesV3/components/ResourcesV3Page";

const container = document.getElementById("react-resources-v3-page");
if (!container) {
  throw new Error(`Expected a <div> with id "react-resources-v3-page"`);
}

const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <ResourcesV3Page />
      </Router>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
