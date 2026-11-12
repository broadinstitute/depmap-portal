import React, { useEffect, useMemo, useRef, useState } from "react";
import { App } from "@modelcontextprotocol/ext-apps";
import { DataExplorerSettingsContext } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";
import ReadyPlot, { LINK_ROW_HEIGHT } from "./ReadyPlot";
import {
  hostAcceptsMessages,
  hostSupportsDraft,
  messageParams,
} from "./selection";
import { EMBEDDED_PLOT_STYLES } from "../utils/embeddedPlotStyles";
import { codeGenerationBlocked } from "./codegen";
import {
  describePlotError,
  failureNote,
  plotId,
  PlotErrorInfo,
  successNote,
} from "./plotErrors";

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
const GET_PLOT_DATA_TOOL = "get_plot_data";

// Shown in place of "Loading plot data…" once a load has taken this long.
export const SLOW_LOAD_HINT_MS = 8000;
// Automatic retries for busy errors: delay n is BASE * 2^(n-1) plus jitter.
export const MAX_AUTO_RETRIES = 2;
export const AUTO_RETRY_BASE_MS = 1000;
export const AUTO_RETRY_JITTER_MS = 1000;

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
  | { kind: "retrying"; userText: string }
  | { kind: "error"; message: string; failure?: PlotErrorInfo }
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
    // Looks like "code: message". Only the code is ever shown.
    throw new Error(text || "unknown: The plot data request failed.");
  }

  if (text === null) {
    throw new Error("bad_response: The response had no text content.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("bad_response: The response was not valid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !(parsed as PlotData).plot_config
  ) {
    throw new Error("bad_response: The response was missing `plot_config`.");
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
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [blocked] = useState(() => codeGenerationBlocked());
  // Whether the host accepts a view's `ui/message`. Known only once connected.
  const [canSendMessages, setCanSendMessages] = useState(false);
  // Whether the host can take the message as an unsent draft.
  const [canDraft, setCanDraft] = useState(false);
  const inHost = window.parent !== window;

  const appRef = useRef<App | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const visibleRef = useRef(false);
  const readyRef = useRef(false);
  const latestRequestId = useRef(0);
  const fetchedKey = useRef("");
  const autoRetries = useRef(0);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteSent = useRef(false);
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

  const clearAutoRetryTimer = () => {
    if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current);
    autoRetryTimer.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRecoveryTimers();
      clearAutoRetryTimer();
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
      clearAutoRetryTimer();
      autoRetries.current = 0;
      noteSent.current = false;
      setAttempt(0);
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
      .then(() => {
        syncHeight();

        if (!unmounted) {
          setCanSendMessages(hostAcceptsMessages(app));
          setCanDraft(hostSupportsDraft(app));
        }
      })
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

  // Tells the model about the outcome, if the host accepts it. Fire and
  // forget; a note is plain text built from a fixed template.
  const tellModel = (text: string) => {
    const app = appRef.current;

    if (!app || !app.getHostCapabilities()?.updateModelContext?.text) {
      return;
    }

    app.updateModelContext({ content: [{ type: "text", text }] }).catch((e) => {
      if (debugEnabled()) {
        window.console.debug("[mcp view] updateModelContext failed", e);
      }
    });
  };

  // Fetch after being continuously visible for the debounce. Becoming hidden
  // cancels the timer; becoming visible again later does not refetch. A retry
  // is the same effect with a new attempt number.
  useEffect(() => {
    const key = request ? `${request.id}:${attempt}` : "";

    if (!request || !visible || blocked || fetchedKey.current === key) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      const app = appRef.current;

      if (!app) {
        return;
      }

      const isCurrent = () =>
        mountedRef.current && latestRequestId.current === request.id;

      fetchedKey.current = key;
      setState({ kind: "loading" });

      const fail = (info: PlotErrorInfo) => {
        if (!isCurrent()) {
          return;
        }

        if (info.retry === "auto" && autoRetries.current < MAX_AUTO_RETRIES) {
          autoRetries.current += 1;
          const delay =
            AUTO_RETRY_BASE_MS * 2 ** (autoRetries.current - 1) +
            Math.random() * AUTO_RETRY_JITTER_MS;

          setState({ kind: "retrying", userText: info.userText });
          clearAutoRetryTimer();
          autoRetryTimer.current = setTimeout(() => {
            autoRetryTimer.current = null;

            if (isCurrent()) {
              // Back to queued; the effect fetches once we're visible.
              setState({ kind: "queued" });
              setAttempt((a) => a + 1);
            }
          }, delay);
          return;
        }

        // A busy error that ran out of retries becomes a manual one.
        const finalInfo: PlotErrorInfo =
          info.retry === "auto"
            ? {
                ...info,
                retry: "manual",
                userText: info.exhaustedUserText ?? info.userText,
              }
            : info;

        setState({
          kind: "error",
          message: finalInfo.userText,
          failure: finalInfo,
        });

        if (finalInfo.modelText) {
          noteSent.current = true;
          tellModel(
            failureNote(
              plotId(request.params),
              (request.params as { plot_type?: unknown })?.plot_type,
              finalInfo
            )
          );
        }
      };

      let response: unknown;

      try {
        response = await app.callServerTool({
          name: GET_PLOT_DATA_TOOL,
          arguments: {
            api_version: request.apiVersion,
            params: request.params,
          },
        });
      } catch (e) {
        fail(describePlotError(e instanceof Error ? e : new Error(String(e))));
        return;
      }

      let data: PlotData;

      try {
        data = parsePlotData(response as ToolResultLike);
      } catch (e) {
        fail(describePlotError(e instanceof Error ? e.message : String(e)));
        return;
      }

      if (isCurrent()) {
        setState({ kind: "ready", data });

        if (noteSent.current) {
          noteSent.current = false;
          tellModel(
            successNote(
              plotId(request.params),
              (request.params as { plot_type?: unknown })?.plot_type
            )
          );
        }
      }
    }, VISIBLE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [request, visible, blocked, attempt]);

  // After a while, say that large plots are slow rather than stuck.
  useEffect(() => {
    setSlow(false);

    if (state.kind !== "loading") {
      return undefined;
    }

    const timer = setTimeout(() => setSlow(true), SLOW_LOAD_HINT_MS);
    return () => clearTimeout(timer);
  }, [state.kind]);

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

  const tryAgain = () => {
    clearAutoRetryTimer();
    autoRetries.current = 0;
    setState({ kind: "queued" });
    setAttempt((a) => a + 1);
  };

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
    content = (
      <Message>
        Loading plot data…
        {slow && " large plots can take up to 30 seconds."}
      </Message>
    );
  } else if (state.kind === "retrying") {
    content = <Message>{state.userText}</Message>;
  } else if (state.kind === "error" && state.failure) {
    content = (
      <Message>
        {state.failure.userText}{" "}
        <code style={{ fontSize: "0.8em" }}>{state.failure.code}</code>
        {state.failure.retry === "manual" && (
          <div
            role="button"
            tabIndex={0}
            onClick={tryAgain}
            onKeyDown={(e) => e.key === "Enter" && tryAgain()}
            style={{ marginTop: 8, cursor: "pointer", color: "#337ab7" }}
          >
            Try again
          </div>
        )}
      </Message>
    );
  } else if (state.kind === "error") {
    content = <Message>Cannot render plot. {state.message}</Message>;
  } else {
    // `height` is the plot's height. ReadyPlot makes the document exactly that
    // plus the row under the plot (a function of the plot and host alone), so
    // what autoResize reports never depends on a previous report. The
    // placeholder used while off screen has the same height for the same
    // reason. It is keyed by the request so a selection never outlives its
    // data.
    const fallback =
      visible && gaveUp ? (
        <div
          role="button"
          tabIndex={0}
          onClick={retry}
          onKeyDown={(e) => e.key === "Enter" && retry()}
          style={{ padding: 20, color: "#666", cursor: "pointer" }}
        >
          Plot unavailable, click to retry
        </div>
      ) : null;

    content = (
      <DataExplorerSettingsContext.Provider value={settings}>
        <ReadyPlot
          key={`${request?.id}:${attempt}`}
          data={state.data}
          height={height}
          link={link}
          plotKey={plotKey}
          showPlot={visible && !gaveUp}
          fallback={fallback}
          canSendMessages={canSendMessages}
          onOpenLink={(url) => {
            // A sandboxed iframe can't navigate on its own; ask the host.
            if (!appRef.current) {
              return false;
            }

            appRef.current.openLink({ url });
            return true;
          }}
          sendMessage={(text) =>
            appRef.current
              ? appRef.current.sendMessage(messageParams(text, canDraft))
              : Promise.resolve({ isError: true })
          }
        />
      </DataExplorerSettingsContext.Provider>
    );
  }

  return <div ref={rootRef}>{content}</div>;
}

export default McpView;
