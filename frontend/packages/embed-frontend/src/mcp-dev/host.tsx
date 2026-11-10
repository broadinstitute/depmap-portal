import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { readPlotFromQueryString } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import {
  fetchPlotData,
  fetchPlotLinearRegression,
} from "@depmap/data-explorer-2/src/services/dataExplorerAPI/fetchPlotData";

// Dev-only stand-in for an MCP host. It is NOT conformant (no CSP, sandbox, or
// real sizing); it exists to render McpView with hot reload. It reads the same
// query params as /embed/plot, sends them to the view as a tool result, and
// answers the view's get_plot_data call by fetching the data from Breadbox the
// way EmbeddedPlot does. Any other tool call is logged and answered with an
// empty success.

const VIEW_URL = "/embed/mcp-view";
const GET_PLOT_DATA_TOOL = "get_plot_data";

// `?host=Delphi` makes this host report that name and accept `ui/message`,
// which is what the view needs before it offers "Ask about these N …". The
// message it sends appears in the log; nothing is drafted or sent.
const HOST_NAME =
  new URLSearchParams(window.location.search).get("host") || "dev-host";

interface LogEntry {
  id: number;
  dir: "host→view" | "view→host";
  label: string;
  body: unknown;
}

type Msg = { id?: number; method?: string; params?: any };

function Host() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [frameKey, setFrameKey] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const nextId = useRef(0);
  const logEnd = useRef<HTMLDivElement>(null);
  const plotConfig = useRef<unknown>(null);

  const note = useCallback((dir: LogEntry["dir"], body: any) => {
    const label = body.method
      ? `${body.method}${
          body.method === "tools/call" ? ` ${body.params?.name}` : ""
        }`
      : `response #${body.id}${body.error ? " (error)" : ""}`;
    nextId.current += 1;
    setEntries((prev) => [...prev, { id: nextId.current, dir, label, body }]);
  }, []);

  const send = useCallback(
    (msg: unknown) => {
      note("host→view", msg);
      frameRef.current?.contentWindow?.postMessage(msg, "*");
    },
    [note]
  );

  const sendToolResult = useCallback(() => {
    send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: {
        content: [{ type: "text", text: "Showing a plot." }],
        structuredContent: {
          type: "plot",
          api_version: 1,
          params: plotConfig.current,
          link: `${window.location.origin}/data_explorer_2/${window.location.search}`,
        },
      },
    });
  }, [send]);

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) {
        return;
      }

      const msg = event.data as Msg;
      note("view→host", msg);

      const reply = (result: unknown) =>
        send({ jsonrpc: "2.0", id: msg.id, result });

      if (msg.method === "ui/initialize") {
        reply({
          protocolVersion: msg.params.protocolVersion,
          hostInfo: { name: HOST_NAME, version: "0" },
          hostCapabilities: {
            serverTools: {},
            openLinks: {},
            updateModelContext: { text: {} },
            ...(HOST_NAME === "Delphi" ? { message: { text: {} } } : {}),
          },
          hostContext: { containerDimensions: { maxHeight: 800 } },
        });
      } else if (msg.method === "ui/notifications/initialized") {
        try {
          plotConfig.current = await readPlotFromQueryString();
        } catch (e) {
          window.console.error(e);
        }
        sendToolResult();
      } else if (
        msg.method === "tools/call" &&
        msg.params?.name === GET_PLOT_DATA_TOOL
      ) {
        try {
          const config = msg.params.arguments.params;
          const [data, linreg] = await Promise.all([
            fetchPlotData(config),
            fetchPlotLinearRegression(config),
          ]);
          const text = JSON.stringify({
            ...data,
            plot_config: config,
            linreg_by_group: linreg || undefined,
          });
          reply({ content: [{ type: "text", text }] });
        } catch (e) {
          reply({
            isError: true,
            content: [{ type: "text", text: `upstream_error: ${e}` }],
          });
        }
      } else if (msg.id !== undefined && msg.method) {
        // Other tool calls (and anything else expecting an answer): log only.
        reply(msg.method === "tools/call" ? { content: [] } : {});
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [note, send, sendToolResult]);

  useEffect(() => {
    logEnd.current?.scrollIntoView();
  }, [entries.length]);

  const btn = { marginRight: 8 };

  return (
    <div style={{ fontFamily: "sans-serif", margin: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Dev MCP host</strong>
        <span style={{ marginLeft: 20 }} />
        <button
          type="button"
          style={btn}
          onClick={() => setFrameKey((k) => k + 1)}
        >
          Reload view
        </button>
        <button type="button" style={btn} onClick={sendToolResult}>
          Resend tool result
        </button>
        <button type="button" onClick={() => setEntries([])}>
          Clear log
        </button>
      </div>
      <iframe
        key={frameKey}
        ref={frameRef}
        title="MCP view"
        src={VIEW_URL}
        // McpView's plot is 480px tall, plus a 28px "Open in Data Explorer" row.
        style={{ width: 710, height: 508, border: "1px solid #ccc" }}
      />
      <h4>Messages</h4>
      <div style={{ maxHeight: 300, overflow: "auto", background: "#f4f4f4" }}>
        {entries.map((e) => (
          <details key={e.id} style={{ padding: "2px 8px", fontSize: 12 }}>
            <summary>
              <code>
                {e.dir} {e.label}
              </code>
            </summary>
            <pre>{JSON.stringify(e.body, null, 2)}</pre>
          </details>
        ))}
        <div ref={logEnd} />
      </div>
    </div>
  );
}

ReactDOM.render(<Host />, document.getElementById("root"));
