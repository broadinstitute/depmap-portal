import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import DataPage from "src/dataPage2/components/DataPage";

const container = document.getElementById("react-data-page2");
if (!container) {
  throw new Error(`Expected a <div> with id "react-data-page2"`);
}

const dataElement = document.getElementById("react-data-page-data2");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const data = JSON.parse(dataElement.textContent);

const { releaseNotesUrl, forumUrl } = data;

const App = () => {
  return (
    <ErrorBoundary>
      <DataPage releaseNotesUrl={releaseNotesUrl} forumUrl={forumUrl} />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
