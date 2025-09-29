import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import GeneTea from "src/geneTea/components/GeneTea";
import { GeneTeaFiltersContextProvider } from "src/geneTea/context/GeneTeaFiltersContext";
import { TopTermsContextProvider } from "src/geneTea/context/TopTermsContext";
import { AllTermsContextProvider } from "src/geneTea/context/AllTermsContext";

const container = document.getElementById("react-gene-tea");

const App = () => {
  return (
    <ErrorBoundary>
      <GeneTeaFiltersContextProvider>
        <TopTermsContextProvider>
          <AllTermsContextProvider>
            <GeneTea />
          </AllTermsContextProvider>
        </TopTermsContextProvider>
      </GeneTeaFiltersContextProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
