import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { apiFunctions } from "src/common/utilities/context";
import { ApiContext } from "@depmap/api";
import { Spinner } from "@depmap/common-components";

const GroupsManager = React.lazy(
  () => import("src/groupsManager/components/GroupsManager")
);

const container = document.getElementById("react-groups-manager-root");

const App = () => {
  return (
    <ErrorBoundary>
      <ApiContext.Provider value={apiFunctions.breadbox}>
        <React.Suspense fallback={<Spinner />}>
          <GroupsManager />
        </React.Suspense>
      </ApiContext.Provider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
