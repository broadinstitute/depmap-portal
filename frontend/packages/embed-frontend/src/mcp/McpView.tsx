import React, { useEffect, useMemo, useRef, useState } from "react";
import { App } from "@modelcontextprotocol/ext-apps";
import { DataExplorerSettingsContext } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";
import { PlotView } from "../components/Plot";
import { EMBEDDED_PLOT_STYLES } from "../utils/embeddedPlotStyles";
import { codeGenerationBlocked } from "./codegen";

// Hosts mount every past view in a chat at once, and some discard views within
// a fraction of a second. So the tool result is only stored on arrival; the
// data is fetched once the view has been on screen for this long.
export const VISIBLE_DEBOUNCE_MS = 400;

// Chrome allows 16 live WebGL contexts per page and evicts the oldest
// silently, even from a visible view. A scattergl plot holds two. When one is
// lost we re-render from the in-memory data, after a random delay (many views
// recovering at once take contexts from each other and thrash), one recovery
// in flight per view, giving up after MAX_RECOVERY_ATTEMPTS.
export const RECOVERY_JITTER_MIN_MS = 200;
export const RECOVERY_JITTER_MAX_MS = 1500;
export const MAX_RECOVERY_ATTEMPTS = 3;
// A recovery that survives this long counts as having worked.
export const RECOVERY_STABLE_MS = 10000;

const DEFAULT_HEIGHT = 480;
const LINK_ROW_HEIGHT = 28;
const GET_PLOT_DATA_TOOL = "get_plot_data";

type PlotData = DataExplorerPlotResponse & {
  plot_config: DataExplorerPlotConfig;
  linreg_by_group?: LinRegInfo[];
};

// What the tool result told us to show. The data is fetched later.
interface PlotRequest {
  id: number;
  params: unknown;
  apiVersion: unknown;
  link: string | null;
}

type State =
  | { kind: "waiting" }
  | { kind: "queued" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: PlotData };

interface ToolResultLike {
  isError?: boolean;
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
}

function firstText(result: ToolResultLike) {
  const part = (result.content || []).find((c) => c.type === "text");
  return typeof part?.text === "string" ? part.text : null;
}

function parsePlotData(result: ToolResultLike): PlotData {
  const text = firstText(result);

  if (result.isError) {
    // Looks like "code: message".
    throw new Error(text || "The plot data request failed.");
  }

  if (text === null) {
    throw new Error("The plot data response had no text content.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("The plot data response was not valid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !(parsed as PlotData).plot_config
  ) {
    throw new Error("The plot data response was missing `plot_config`.");
  }

  return parsed as PlotData;
}

// The host's fixed `containerDimensions.height` is deliberately ignored: it is
// the size of the iframe, which is whatever we last reported through
// autoResize. Feeding it back into our own size makes a feedback loop (the
// iframe grows every round). Only the host's *maximum* may cap the default.
function heightFromHost(app: App | null) {
  const dims = app?.getHostContext()?.containerDimensions;

  if (dims && "maxHeight" in dims && typeof dims.maxHeight === "number") {
    return Math.min(DEFAULT_HEIGHT, dims.maxHeight);
  }

  return DEFAULT_HEIGHT;
}

const debugEnabled = () => /[?&]debug\b/.test(window.location.search);

function Message({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 20, color: "#666" }}>{children}</div>;
}

function McpView() {
  const [state, setState] = useState<State>({ kind: "waiting" });
  const [request, setRequest] = useState<PlotRequest | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [visible, setVisible] = useState(false);
  const [plotKey, setPlotKey] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const [blocked] = useState(() => codeGenerationBlocked());
  const inHost = window.parent !== window;

  const appRef = useRef<App | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const visibleRef = useRef(false);
  const readyRef = useRef(false);
  const latestRequestId = useRef(0);
  const fetchedRequestId = useRef(0);
  const recovery = useRef<{
    attempts: number;
    pending: ReturnType<typeof setTimeout> | null;
    stable: ReturnType<typeof setTimeout> | null;
  }>({ attempts: 0, pending: null, stable: null });

  readyRef.current = state.kind === "ready";

  const clearRecoveryTimers = () => {
    const r = recovery.current;
    if (r.pending) clearTimeout(r.pending);
    if (r.stable) clearTimeout(r.stable);
    r.pending = null;
    r.stable = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRecoveryTimers();
    };
  }, []);

  // Connect to the host.
  useEffect(() => {
    if (!inHost) {
      return undefined;
    }

    // Created here, not at import time, so nothing happens until the view
    // actually mounts. autoResize (the default) reports our size to the host.
    const app = new App(
      { name: "Data Explorer Plot", version: "0.1.0" },
      {},
      { autoResize: true }
    );
    appRef.current = app;
    let unmounted = false;

    const syncHeight = () => {
      if (!unmounted) {
        const next = heightFromHost(app);
        // Bail out (same state object) when nothing changed.
        setHeight((prev) => (prev === next ? prev : next));
      }
    };

    app.onhostcontextchanged = () => {
      if (debugEnabled()) {
        window.console.debug(
          "[mcp view] containerDimensions",
          JSON.stringify(app.getHostContext()?.containerDimensions)
        );
      }
      syncHeight();
    };

    // Only remember what to show. The fetch waits until we're on screen.
    app.ontoolresult = async (result: unknown) => {
      if (unmounted) {
        return;
      }

      const sc = (result as ToolResultLike)?.structuredContent as
        | Record<string, unknown>
        | undefined;

      if (!sc || typeof sc !== "object" || sc.type !== "plot" || !sc.params) {
        setState({
          kind: "error",
          message: "Malformed tool result: expected a plot.",
        });
        return;
      }

      latestRequestId.current += 1;
      setGaveUp(false);
      setState({ kind: "queued" });
      setRequest({
        id: latestRequestId.current,
        params: sc.params,
        apiVersion: sc.api_version,
        link: typeof sc.link === "string" ? sc.link : null,
      });
    };

    app
      .connect()
      .then(syncHeight)
      .catch((e: unknown) => {
        if (!unmounted) {
          setState({
            kind: "error",
            message: `Could not connect to the host: ${
              e instanceof Error ? e.message : String(e)
            }`,
          });
        }
      });

    return () => {
      unmounted = true;
      appRef.current = null;
      app.ontoolresult = undefined;
      app.onhostcontextchanged = undefined;
    };
  }, [inHost]);

  // Track whether we're on screen. `document.visibilityState` is useless here:
  // it stays "visible" when the iframe is scrolled away.
  useEffect(() => {
    const root = rootRef.current;

    if (!inHost || !root) {
      return undefined;
    }

    if (typeof IntersectionObserver === "undefined") {
      visibleRef.current = true;
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      const isIntersecting = entries[entries.length - 1].isIntersecting;
      visibleRef.current = isIntersecting;
      setVisible(isIntersecting);
    });
    observer.observe(root);

    return () => observer.disconnect();
  }, [inHost]);

  // Fetch once, after being continuously visible for the debounce. Becoming
  // hidden cancels the timer; becoming visible again later does not refetch.
  useEffect(() => {
    if (
      !request ||
      !visible ||
      blocked ||
      fetchedRequestId.current === request.id
    ) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      const app = appRef.current;

      if (!app) {
        return;
      }

      fetchedRequestId.current = request.id;
      setState({ kind: "loading" });

      try {
        const response = await app.callServerTool({
          name: GET_PLOT_DATA_TOOL,
          arguments: {
            api_version: request.apiVersion,
            params: request.params,
          },
        });
        const data = parsePlotData(response as ToolResultLike);

        if (mountedRef.current && latestRequestId.current === request.id) {
          setState({ kind: "ready", data });
        }
      } catch (e) {
        if (mountedRef.current && latestRequestId.current === request.id) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }, VISIBLE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [request, visible, blocked]);

  // Leaving the view unmounts the plot (see render), which is what releases
  // its WebGL contexts. Coming back remounts from the data in memory, with a
  // fresh recovery budget.
  useEffect(() => {
    clearRecoveryTimers();
    recovery.current.attempts = 0;
    setGaveUp(false);
  }, [visible]);

  // `webglcontextlost` doesn't bubble, hence capture on the container.
  useEffect(() => {
    const root = rootRef.current;

    if (!inHost || !root) {
      return undefined;
    }

    const onLost = (event: Event) => {
      const r = recovery.current;
      const target = event.target as Node | null;

      // Ignore losses of canvases that are already gone (e.g. the ones we
      // release ourselves when unmounting a plot) and ones we can't act on.
      if (!target || !target.isConnected) return;
      if (!visibleRef.current || !readyRef.current) return;
      // One recovery in flight per view.
      if (r.pending) return;

      if (r.attempts >= MAX_RECOVERY_ATTEMPTS) {
        setGaveUp(true);
        return;
      }

      r.attempts += 1;

      if (r.stable) {
        clearTimeout(r.stable);
        r.stable = null;
      }

      const delay =
        RECOVERY_JITTER_MIN_MS +
        Math.random() * (RECOVERY_JITTER_MAX_MS - RECOVERY_JITTER_MIN_MS);

      r.pending = setTimeout(() => {
        r.pending = null;

        if (!mountedRef.current || !visibleRef.current) return;

        // Remounting purges the old plot and draws a new one.
        setPlotKey((k) => k + 1);
        r.stable = setTimeout(() => {
          r.attempts = 0;
          r.stable = null;
        }, RECOVERY_STABLE_MS);
      }, delay);
    };

    root.addEventListener("webglcontextlost", onLost, true);
    return () => root.removeEventListener("webglcontextlost", onLost, true);
  }, [inHost]);

  const settings = useMemo(
    () => ({
      settings: { plotStyles: EMBEDDED_PLOT_STYLES },
      launchSettingsModal: () => {},
    }),
    []
  );

  const retry = () => {
    clearRecoveryTimers();
    recovery.current.attempts = 0;
    setGaveUp(false);
    setPlotKey((k) => k + 1);
  };

  const link = request?.link ?? null;

  const linkRow = link && (
    <div
      style={{
        flex: "0 0 auto",
        height: LINK_ROW_HEIGHT,
        lineHeight: `${LINK_ROW_HEIGHT}px`,
        padding: "0 8px",
        textAlign: "right",
      }}
    >
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          // A sandboxed iframe can't navigate on its own; ask the host.
          if (appRef.current) {
            e.preventDefault();
            appRef.current.openLink({ url: link });
          }
        }}
      >
        Open in Data Explorer
      </a>
    </div>
  );

  let content: React.ReactNode;

  if (!inHost) {
    content = (
      <Message>
        This view is meant to be embedded in an MCP host. For standalone
        testing, use the <code>/embed/plot</code> route with query parameters
        instead.
      </Message>
    );
  } else if (blocked && request) {
    content = (
      <>
        <Message>
          This host doesn&apos;t allow the code generation that Data Explorer
          plots need, so the plot can&apos;t be shown here.
        </Message>
        {linkRow}
      </>
    );
  } else if (state.kind === "waiting") {
    content = <Message>Waiting for the tool result…</Message>;
  } else if (state.kind === "queued") {
    content = <Message>Plot will load when visible…</Message>;
  } else if (state.kind === "loading") {
    content = <Message>Loading plot data…</Message>;
  } else if (state.kind === "error") {
    content = <Message>Cannot render plot. {state.message}</Message>;
  } else {
    // `height` is the plot's height. The document is always exactly that
    // plus the link row (a function of the plot and link alone), so what
    // autoResize reports never depends on a previous report. The placeholder
    // used while off screen has the same height for the same reason.
    const totalHeight = height + (link ? LINK_ROW_HEIGHT : 0);

    let plot: React.ReactNode;

    if (!visible) {
      plot = null;
    } else if (gaveUp) {
      plot = (
        <div
          role="button"
          tabIndex={0}
          onClick={retry}
          onKeyDown={(e) => e.key === "Enter" && retry()}
          style={{ padding: 20, color: "#666", cursor: "pointer" }}
        >
          Plot unavailable, click to retry
        </div>
      );
    } else {
      plot = (
        <PlotView
          key={plotKey}
          plotConfig={state.data.plot_config}
          data={state.data}
          linreg_by_group={state.data.linreg_by_group}
          height={height}
        />
      );
    }

    content = (
      <DataExplorerSettingsContext.Provider value={settings}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: totalHeight,
            overflow: "hidden",
          }}
        >
          <div style={{ flex: "1 1 auto", minHeight: 0 }}>{plot}</div>
          {linkRow}
        </div>
      </DataExplorerSettingsContext.Provider>
    );
  }

  return <div ref={rootRef}>{content}</div>;
}

export default McpView;
