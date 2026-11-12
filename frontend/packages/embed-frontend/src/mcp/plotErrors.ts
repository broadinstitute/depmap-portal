// Named plot errors: what to show the user, what to tell the model, and
// whether a retry makes sense. Pure (no React) so it is easy to test.
//
// Failures of `get_plot_data` arrive as text like "code: message". Only the
// code is ever used. The message can echo the plot's configuration, so it is
// never displayed and never sent to the model.

export type RetryPolicy = "none" | "auto" | "manual";

export interface PlotErrorEntry {
  userText: string;
  modelText: string;
  retry: RetryPolicy;
  // For "auto" entries: shown once the automatic retries have run out.
  exhaustedUserText?: string;
}

export interface PlotErrorInfo extends PlotErrorEntry {
  code: string;
}

const SERVER_ERROR: PlotErrorEntry = {
  userText: "Something went wrong while preparing this plot.",
  modelText: "The plot failed with a server error.",
  retry: "manual",
};

const BAD_CONFIG: PlotErrorEntry = {
  userText:
    "This plot's settings couldn't be understood. It may need to be recreated.",
  modelText: "The plot configuration was invalid; build a new plot.",
  retry: "none",
};

const TOO_LARGE: PlotErrorEntry = {
  userText: "This plot is too large to display here.",
  modelText:
    "The plot is too large; suggest a smaller selection or the portal link.",
  retry: "none",
};

const BUSY: PlotErrorEntry = {
  userText: "Many plots are loading at once. Retrying…",
  modelText: "The plot was delayed because the service was busy.",
  retry: "auto",
  exhaustedUserText: "The service is busy right now. Try again in a moment.",
};

export const FALLBACK: PlotErrorEntry = {
  userText: "This plot could not be shown.",
  modelText: "The plot failed with an unrecognised error.",
  retry: "manual",
};

export const PLOT_ERRORS: Record<string, PlotErrorEntry> = {
  dataset_not_found: {
    userText:
      "A dataset this plot needs was not found, or you don't have access to it.",
    modelText:
      "A dataset the plot needs is missing or inaccessible; do not retry the same configuration.",
    retry: "none",
  },
  forbidden: {
    userText: "You don't have access to some of the data in this plot.",
    modelText:
      "Access to the data was denied; do not retry the same configuration.",
    retry: "none",
  },
  invalid_config: BAD_CONFIG,
  invalid_request: BAD_CONFIG,
  unsupported_api_version: BAD_CONFIG,
  request_too_large: TOO_LARGE,
  result_too_large: TOO_LARGE,
  busy: BUSY,
  too_many_requests: BUSY,
  timeout: {
    userText: "This plot took too long to produce.",
    modelText: "The plot timed out; it may work later or with a smaller scope.",
    retry: "manual",
  },
  upstream_error: SERVER_ERROR,
  internal_error: SERVER_ERROR,
  bad_response: SERVER_ERROR,
  breadbox_unreachable: {
    userText: "The data service can't be reached right now.",
    modelText: "The data service is unavailable.",
    retry: "manual",
  },
  unauthenticated: {
    userText: "Your session has expired. Sign in again.",
    modelText: "The user is not signed in.",
    retry: "none",
  },
  network_error: {
    userText: "Couldn't reach the chat service.",
    // The model can't be reached either, so no note is sent for this one.
    modelText: "",
    retry: "manual",
  },
};

// Must match the plot types the view can draw (DataExplorerPlotType).
export const PLOT_TYPES = [
  "density_1d",
  "scatter",
  "correlation_heatmap",
  "waterfall",
];

function lookup(code: string): PlotErrorInfo {
  if (Object.prototype.hasOwnProperty.call(PLOT_ERRORS, code)) {
    return { code, ...PLOT_ERRORS[code] };
  }

  if (/^http_5\d\d$/.test(code)) {
    return { code, ...SERVER_ERROR };
  }

  return { code: "unknown", ...FALLBACK };
}

// A string is the text of an `isError` result. An Error is a call that failed
// without a result (the host bridge throws, e.g. "... failed (HTTP 429)").
export function describePlotError(source: string | Error): PlotErrorInfo {
  if (typeof source === "string") {
    const match = source.match(/^([a-z][a-z0-9_]*):\s*/);
    return lookup(match ? match[1] : "unknown");
  }

  const message = source.message || "";

  // Some hosts (ChatGPT) reject a failed tool call instead of returning an
  // `isError` result, with the server's text inside the error's message. The
  // server's fixed sentence anchors the code; nothing else is ever used.
  const embedded = message.match(
    /(?:^|[^A-Za-z0-9_])([a-z][a-z0-9_]{0,39}): The plot data could not be produced\./
  );

  if (embedded) {
    return lookup(embedded[1]);
  }

  if (message.includes("(HTTP 429)")) return lookup("too_many_requests");
  if (message.includes("(HTTP 413)")) return lookup("request_too_large");
  if (message.includes("(HTTP 502)")) return lookup("result_too_large");
  if (message.includes("(HTTP 401)")) return lookup("unauthenticated");

  return lookup("network_error");
}

// A short stable id that only tells plots apart. It reveals nothing readable
// about the configuration.
export function plotId(params: unknown): string {
  const text = JSON.stringify(params) || "";
  let hash = 5381;

  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  }

  return hash.toString(16).padStart(8, "0").slice(0, 6);
}

// Only an allowlisted plot type may appear in a note: the configuration comes
// from a model's tool call, and model-written text must not reach the note.
function safeType(plotType: unknown) {
  return typeof plotType === "string" && PLOT_TYPES.includes(plotType)
    ? plotType
    : "unknown";
}

export function failureNote(
  id: string,
  plotType: unknown,
  info: PlotErrorInfo
): string {
  return `[plot ${id}] The plot "${safeType(plotType)}" could not be drawn: ${
    info.modelText
  } (code: ${info.code}).`;
}

export function successNote(id: string, plotType: unknown): string {
  return `[plot ${id}] The plot "${safeType(
    plotType
  )}" was drawn successfully.`;
}
