import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import ResourcesPage from "src/resources/components/ResourcesPage";
import { BrowserRouter as Router } from "react-router-dom";

const container = document.getElementById("react-resources-page");
if (!container) {
  throw new Error(`Expected a <div> with id "react-resources-page"`);
}

const dataElement = document.getElementById("react-resources-page-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}
const data = JSON.parse(dataElement.textContent);

const { rootCategory, title } = data;
const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <ResourcesPage
          title={title}
          subcategories={rootCategory.subcategories}
          defaultTopic={rootCategory.default_topic}
        />
      </Router>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
