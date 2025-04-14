import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";

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
      <div>
        The answer to life, the universe, and everything is:
        {/* {secretOfTheUniverse} */}
      </div>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
