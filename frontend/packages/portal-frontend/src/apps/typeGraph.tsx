import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import TypeGraphExplorer from "src/typeGraph/TypeGraphExplorer";

const container = document.getElementById("type_graph");

const App = () => {
  return (
    <ErrorBoundary>
      <TypeGraphExplorer />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
