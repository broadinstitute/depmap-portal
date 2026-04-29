import React, { useState, useEffect } from "react";
import { App } from "@modelcontextprotocol/ext-apps";
import { DataExplorerPlotConfig } from "@depmap/types";
import ContainerSized from "../components/ContainerSized";
import Plot from "../components/Plot";

// Construct the App at module scope (not inside the React component) so it's
// a singleton. Re-creating it on every render would leak postMessage
// listeners and race the connect handshake.
const app = new App({ name: "Plot View", version: "0.1.0" });

interface Result {
  content: { type: "text"; text: string };
  structuredContent: {
    type?: "plot" | "table";
    params?: object;
  };
}

function McpView() {
  const [data, setData] = useState<Result | null>(null);

  useEffect(() => {
    app.ontoolresult = async (result: unknown) => {
      setData(result as Result);
    };

    app.connect().catch((err: unknown) => {
      window.console.error("[view] connect failed", err);
    });
  }, []);

  if (window.parent === window) {
    return (
      <div style={{ padding: "20px", color: "#666" }}>
        <p>This view is meant to be embedded in an MCP host.</p>
        <p>
          For standalone testing, use the <code>/embed/plot</code> route with
          query parameters instead.
        </p>
      </div>
    );
  }

  if (data === null) {
    return <div>waiting for tool result...</div>;
  }

  if (typeof data !== "object" || !("structuredContent" in data)) {
    return <div>Malformed tool result: {JSON.stringify(data)}</div>;
  }

  const { structuredContent: sc } = data;

  if (!sc || typeof sc !== "object" || !("type" in sc) || !("params" in sc)) {
    return <div>Malformed `structuredContent`: {JSON.stringify(sc)}</div>;
  }

  if (sc.type !== "plot") {
    return <div>Embedded view type “{sc.type}” not supported.</div>;
  }

  return (
    <ContainerSized>
      {({ height }) => (
        <Plot
          plotConfig={sc.params as DataExplorerPlotConfig}
          height={height}
        />
      )}
    </ContainerSized>
  );
}

export default McpView;
