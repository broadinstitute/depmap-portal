import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import GeneTea from "src/geneTea/components/GeneTea";
import { GeneTeaFiltersContextProvider } from "src/geneTea/context/GeneTeaFiltersContext";

const container = document.getElementById("react-gene-tea");

const App = () => {
  return (
    <ErrorBoundary>
      <GeneTeaFiltersContextProvider>
        <GeneTea />
      </GeneTeaFiltersContextProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
