// The contract of the standalone plot-data script, minus the process plumbing
// (see cli.ts). Rationale for the rules below is in ADR 0010.
import { configureBreadboxClient, getRequestFailure } from "@depmap/api";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";
// Import from the modules, not the `@depmap/data-explorer-2` package root: the
// root exports React components, which have no place in a Node bundle.
import {
  fetchPlotData,
  fetchPlotLinearRegression,
} from "@depmap/data-explorer-2/src/services/dataExplorerAPI/fetchPlotData";
import { isCompleteDimension } from "@depmap/data-explorer-2/src/utils/dimensionHelpers";

export const SUPPORTED_API_VERSION = 1;

export type PlotDataErrorCode =
  | "invalid_config"
  | "forbidden"
  | "dataset_not_found"
  | "upstream_error";

// `linreg_by_group` is the one thing `data` carries beyond the response the page
// fetches: see ADR 0010.
export type PlotData = DataExplorerPlotResponse & {
  linreg_by_group?: LinRegInfo[];
};

export type PlotDataOutcome =
  | { ok: true; data: PlotData }
  | {
      ok: false;
      error: { code: PlotDataErrorCode; message: string; details: null };
    };

const fail = (code: PlotDataErrorCode, message: string): PlotDataOutcome => ({
  ok: false,
  error: { code, message, details: null },
});

// Which axes a plot can't be drawn without.
const REQUIRED_AXES: Record<string, string[]> = {
  scatter: ["x", "y"],
  density_1d: ["x"],
  waterfall: ["x"],
  correlation_heatmap: ["x"],
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface ParsedRequest {
  plotConfig: DataExplorerPlotConfig;
  baseUrl: string;
  headers: Record<string, string>;
}

// Never echo anything from `breadbox.headers` (names or values) in a message.
function parseRequest(input: unknown): ParsedRequest | PlotDataOutcome {
  if (!isObject(input)) {
    return fail("invalid_config", "The request must be a JSON object.");
  }

  if (input.api_version !== SUPPORTED_API_VERSION) {
    return fail(
      "invalid_config",
      `Unsupported api_version. This script supports ${SUPPORTED_API_VERSION}.`
    );
  }

  const { plot_config: plotConfig, breadbox } = input;

  if (!isObject(breadbox)) {
    return fail("invalid_config", 'The request is missing "breadbox".');
  }

  const { base_url: baseUrl, headers } = breadbox;

  if (typeof baseUrl !== "string" || !/^https?:\/\/[^/]/.test(baseUrl)) {
    return fail(
      "invalid_config",
      'The request needs an absolute http(s) "breadbox.base_url".'
    );
  }

  // A request with no identity header is treated by a local Breadbox as
  // privileged, so a missing or empty map must never reach the network.
  if (
    !isObject(headers) ||
    Object.keys(headers).length === 0 ||
    Object.values(headers).some((value) => typeof value !== "string")
  ) {
    return fail(
      "invalid_config",
      'The request needs a non-empty "breadbox.headers" object of strings.'
    );
  }

  if (!isObject(plotConfig)) {
    return fail("invalid_config", 'The request is missing "plot_config".');
  }

  const { plot_type: plotType, index_type: indexType, dimensions } = plotConfig;

  if (typeof plotType !== "string" || !(plotType in REQUIRED_AXES)) {
    return fail("invalid_config", "The plot config has an unknown plot_type.");
  }

  if (typeof indexType !== "string" || indexType === "") {
    return fail("invalid_config", "The plot config is missing index_type.");
  }

  if (!isObject(dimensions)) {
    return fail("invalid_config", "The plot config is missing dimensions.");
  }

  for (const axis of REQUIRED_AXES[plotType]) {
    if (!isCompleteDimension(dimensions[axis] as never)) {
      return fail(
        "invalid_config",
        `A ${plotType} plot needs a complete "${axis}" dimension.`
      );
    }
  }

  return {
    plotConfig: (plotConfig as unknown) as DataExplorerPlotConfig,
    baseUrl,
    headers: headers as Record<string, string>,
  };
}

// Returns null for anything that isn't a failure we can name. Those are bugs in
// the script, and are left to crash (see ADR 0010) rather than be dressed up as
// something the user did.
function classifyError(e: unknown): PlotDataOutcome | null {
  const failure = getRequestFailure(e);

  if (failure) {
    const { status } = failure;

    if (status === 401 || status === 403) {
      return fail(
        "forbidden",
        "You don't have permission to read the data this plot needs."
      );
    }

    // Breadbox answers 404, not 403, for a dataset the caller can't see.
    if (status === 404) {
      return fail(
        "dataset_not_found",
        "A dataset this plot needs was not found, or you don't have access to it."
      );
    }

    // Breadbox rejected the request itself as malformed.
    if (
      status !== undefined &&
      status >= 400 &&
      status < 500 &&
      status !== 408 &&
      status !== 429
    ) {
      return fail("invalid_config", (e as Error).message);
    }

    return fail(
      "upstream_error",
      "Breadbox could not be reached or did not return a usable answer."
    );
  }

  if (
    e instanceof TypeError ||
    e instanceof RangeError ||
    e instanceof ReferenceError ||
    e instanceof SyntaxError
  ) {
    return null;
  }

  // Errors thrown by the service itself: an unknown dimension type, a bad
  // context, and so on.
  if (e instanceof Error) {
    return fail("invalid_config", e.message);
  }

  return null;
}

// Resolves to an outcome for every expected result. Rejects only for a bug.
export async function runPlotDataRequest(
  input: unknown
): Promise<PlotDataOutcome> {
  const parsed = parseRequest(input);

  if ("ok" in parsed) {
    return parsed;
  }

  configureBreadboxClient({ baseUrl: parsed.baseUrl, headers: parsed.headers });

  try {
    const data = await fetchPlotData(parsed.plotConfig);
    const linreg_by_group = await fetchRegressionIfRequested(parsed.plotConfig);

    // Only present when a fit was asked for and computed, so every other
    // config gets exactly the response the page would.
    return {
      ok: true,
      data: linreg_by_group ? { ...data, linreg_by_group } : data,
    };
  } catch (e) {
    const outcome = classifyError(e);

    if (!outcome) {
      throw e;
    }

    return outcome;
  }
}

// As on the page, a fit that can't be computed doesn't fail the plot. A bug in
// the script still does, though: only failures we can name are tolerated.
async function fetchRegressionIfRequested(plotConfig: DataExplorerPlotConfig) {
  try {
    return await fetchPlotLinearRegression(plotConfig);
  } catch (e) {
    const outcome = classifyError(e);

    if (!outcome) {
      throw e;
    }

    console.error(
      "Could not compute the regression line:",
      !outcome.ok && outcome.error.message
    );

    return null;
  }
}
