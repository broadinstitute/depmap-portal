import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { breadboxAPI } from "@depmap/api";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import NotFound from "src/pages/NotFound";
import { Spinner } from "@depmap/common-components";
import ElaraNavbar from "src/ElaraNavbar";
import TypesPage from "src/pages/Types/TypesPage";
import "src/create-depmap-global-object";

import "bootstrap/dist/css/bootstrap.css";
// Include this after bootstrap so we can override its styles.
import "./index.scss";

import "react-bootstrap-typeahead/css/Typeahead.css";
import "./typeahead_fix.scss";

const DataExplorer = React.lazy(() => import("src/pages/DataExplorer"));
const Datasets = React.lazy(() => import("@depmap/dataset-manager"));
const ElaraCustomAnalysesPage = React.lazy(
  () => import("src/pages/CustomAnalyses/ElaraCustomAnalysesPage")
);
const CustomDownloads = React.lazy(
  () => import("src/pages/Downloads/CustomDownloads")
);
const GroupsPage = React.lazy(() => import("@depmap/groups-manager"));
const Metadata = React.lazy(() => import("src/pages/Metadata/Metadata"));

const container = document.getElementById("root");

const App = () => {
  let basename = "";
  //  hack for setting urlPrefix when Elara is served behind Depmap portal proxy
  if (window.location.pathname.includes("/breadbox/elara")) {
    basename = window.location.pathname.replace(/\/elara\/.*$/, "");
  }
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const fetchedUser = await breadboxAPI.getBreadboxUser();
      setUser(fetchedUser);
    })();
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <ElaraNavbar />
        <Routes>
          <Route path="*" element={<NotFound />} />
          <Route path="/" element={<Navigate to="/elara/" replace />} />
          <Route path="/elara">
            <Route
              path="/elara"
              element={
                <React.Suspense
                  fallback={
                    <div style={{ width: "99vw", overflow: "hidden" }}>
                      <Spinner position="relative" />
                    </div>
                  }
                >
                  <DataExplorer />
                </React.Suspense>
              }
            />
            <Route
              path="/elara/custom_analysis"
              element={
                <React.Suspense fallback={<Spinner />}>
                  <ElaraCustomAnalysesPage />
                </React.Suspense>
              }
            />
            <Route
              path="/elara/datasets"
              element={
                <React.Suspense fallback={<Spinner />}>
                  <Datasets />
                </React.Suspense>
              }
            />
            <Route
              path="/elara/sample_types"
              element={
                <React.Suspense fallback={<Spinner />}>
                  <TypesPage type="sample" />
                </React.Suspense>
              }
            />
            <Route
              path="/elara/feature_types"
              element={
                <React.Suspense fallback={<Spinner />}>
                  <TypesPage type="feature" />
                </React.Suspense>
              }
            />
            <Route
              path="/elara/custom_downloads"
              element={
                <React.Suspense fallback={<Spinner />}>
                  <CustomDownloads />
                </React.Suspense>
              }
            />
          </Route>
          <Route
            path="/elara/groups"
            element={
              <React.Suspense fallback={<Spinner />}>
                {user && (
                  <GroupsPage
                    user={user}
                    getGroups={breadboxAPI.getGroups}
                    addGroup={breadboxAPI.postGroup}
                    deleteGroup={breadboxAPI.deleteGroup}
                    addGroupEntry={breadboxAPI.postGroupEntry}
                    deleteGroupEntry={breadboxAPI.deleteGroupEntry}
                  />
                )}
              </React.Suspense>
            }
          />
          <Route
            path="/elara/metadata"
            element={
              <React.Suspense fallback={<Spinner />}>
                <Metadata />
              </React.Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
