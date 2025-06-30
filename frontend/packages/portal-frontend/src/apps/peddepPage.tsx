import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import PeddepPage from "src/peddepLandingPage/components/PeddepPage";

const container = document.getElementById("peddep-page");
const dataElement = document.getElementById("peddep-page-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

// const data = JSON.parse(dataElement.textContent);
// const { secretOfTheUniverse } = data;

const App = () => {
  return (
    <ErrorBoundary>
        <PeddepPage />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
