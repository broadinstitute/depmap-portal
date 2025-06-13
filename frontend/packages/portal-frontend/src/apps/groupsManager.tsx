import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { Spinner } from "@depmap/common-components";

const GroupsManager = React.lazy(
  () => import("src/groupsManager/components/GroupsManager")
);

const container = document.getElementById("react-groups-manager-root");

const App = () => {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<Spinner />}>
        <GroupsManager />
      </React.Suspense>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
