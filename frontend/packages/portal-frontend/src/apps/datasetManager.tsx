import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { Spinner } from "@depmap/common-components";

const Datasets = React.lazy(() => import("@depmap/dataset-manager"));
const container = document.getElementById("react-dataset-manager-root");
// const dataElement = document.getElementById("react-dataset-manager-data");

// const data = JSON.parse(dataElement.textContent);

const App = () => {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<Spinner />}>
        <Datasets />
      </React.Suspense>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
