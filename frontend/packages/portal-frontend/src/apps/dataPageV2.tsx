import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
// import DataPageV2 from "src/dataPageV2/components/DataPageV2";

const container = document.getElementById("react-data-pageV2");
if (!container) {
  throw new Error(`Expected a <div> with id "react-data-pageV2"`);
}

const dataElement = document.getElementById("react-data-pageV2-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}
const data = JSON.parse(dataElement.textContent);

// const { releaseNotesUrl, forumUrl } = data;
const App = () => {
  return (
    <ErrorBoundary>
      <>New Data Page Goes Here</>
      {/* <DataPageV2 releaseNotesUrl={releaseNotesUrl} forumUrl={forumUrl} /> */}
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
