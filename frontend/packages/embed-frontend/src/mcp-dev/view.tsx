import React from "react";
import ReactDOM from "react-dom";
import "../mcp/mcp.scss";
import McpView from "../mcp/McpView";

// Dev-only twin of src/mcp/index.tsx, loaded in the iframe of mcp-host.
ReactDOM.render(<McpView />, document.getElementById("root"));
