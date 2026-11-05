import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { getUrlPrefix } from "@depmap/globals";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import ResourcesV3Page from "src/resourcesV3/components/ResourcesV3Page";

const container = document.getElementById("react-resources-v3-page");
if (!container) {
  throw new Error(`Expected a <div> with id "react-resources-v3-page"`);
}

// debugging aid to show when no route matched.
const NoMatch = () => {
  const location = useLocation();

  return (
    <pre>
      No route matched.
      {"\n"}pathname: {location.pathname}
      {"\n"}expected: /resources-v3 or /resources-v3/:postSlug
    </pre>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <Router basename={getUrlPrefix()}>
        <Routes>
          <Route path="/resources-v3" element={<ResourcesV3Page />} />
          <Route path="/resources-v3/:postSlug" element={<ResourcesV3Page />} />
          <Route path="*" element={<NoMatch />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
