import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import ContextExplorer from "src/contextExplorer/components/ContextExplorer";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import { ContextExplorerContextProvider } from "src/contextExplorer/context/ContextExplorerContext";

const container = document.getElementById("react-context-explorer");

const App = () => {
  return (
    <ErrorBoundary>
      <ContextExplorerContextProvider>
        <ContextExplorer />
      </ContextExplorerContextProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
