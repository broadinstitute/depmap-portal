import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom";

// import "bootstrap/dist/css/bootstrap.css";
// import "react-bootstrap-typeahead/css/Typeahead.css";
// import "./typeahead_fix.scss";
import "./index.scss";

const EmbeddedPlot = lazy(() => import("./surfaces/EmbeddedPlot"));
const EmbeddedTable = lazy(() => import("./surfaces/EmbeddedTable"));
const McpView = lazy(() => import("./surfaces/McpView"));

function App() {
  const path = window.location.pathname
    .replace(/\/index\.html$/, "")
    .replace(/\/$/, "");

  // Take everything after the LAST /embed/ segment. The frontend may be
  // served at any depth depending on proxy configuration:
  //   /embed/plot                            (local dev)
  //   /portal/breadbox/embed/plot            (production, behind proxy)
  //   /my/mock/proxy/embed/plot              (mock proxy for testing)
  // lastIndexOf is defensive against the unlikely case where some prefix
  // happens to contain "/embed" itself.
  const embedIndex = path.lastIndexOf("/embed");
  const route =
    embedIndex >= 0 ? path.slice(embedIndex + "/embed".length) : path;

  let surface;

  switch (route) {
    case "/plot":
      surface = <EmbeddedPlot />;
      break;

    case "/table":
      surface = <EmbeddedTable />;
      break;

    case "/mcp":
      surface = <McpView />;
      break;

    default:
      return (
        <div style={{ padding: 20 }}>
          Please specify one of these supported routes after{" "}
          <code>/embed/</code>:
          <ul>
            <li>/plot</li>
            <li>/table</li>
            <li>/mcp</li>
          </ul>
        </div>
      );
  }

  return <Suspense fallback={null}>{surface}</Suspense>;
}

ReactDOM.render(<App />, document.getElementById("root"));
