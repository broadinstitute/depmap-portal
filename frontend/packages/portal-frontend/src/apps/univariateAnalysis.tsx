import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import { UnivariateAnalysisPage } from "src/univariateAnalysis/components/UnivariateAnalysisPage";
import { BrowserRouter as Router } from "react-router-dom";

const container = document.getElementById("react-univariate-analysis-page");
if (!container) {
  throw new Error(`Expected a <div> with id "react-univariate-analysis-page"`);
}

const dataElement = document.getElementById(
  "react-univariate-analysis-page-data"
);
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}
const data = JSON.parse(dataElement.textContent);

console.log("univariateAnalysis");

const { rootCategory } = data;
const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <UnivariateAnalysisPage sample={rootCategory} />
      </Router>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
