import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom";

// import "bootstrap/dist/css/bootstrap.css";
// import "react-bootstrap-typeahead/css/Typeahead.css";
// import "./typeahead_fix.scss";
import "./index.scss";

const EmbeddedPlot = lazy(() => import("./surfaces/EmbeddedPlot"));
const EmbeddedTable = lazy(() => import("./surfaces/EmbeddedTable"));
const McpView = lazy(() => import("./surfaces/McpView"));

const BASE = "/embed";

function App() {
  const path = window.location.pathname
    .replace(/\/index\.html$/, "")
    .replace(/\/$/, "");
  const route = path.startsWith(BASE) ? path.slice(BASE.length) : path;
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
          Please specify one of these supported routes:
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
