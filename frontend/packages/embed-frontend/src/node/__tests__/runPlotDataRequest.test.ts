import http from "http";
import type { AddressInfo } from "net";
import { runPlotDataRequest } from "../runPlotDataRequest";

// A real plot config, so the up-front validation sees the shape it will see in
// production. (Reading it here keeps these tests independent of any data
// loaded in a local Breadbox: every Breadbox answer below is a stub.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const examples = require("@depmap/data-explorer-2/src/components/DataExplorerPage/components/StartScreen/examples/public.json");

const scatter = examples["biomarker-relationship"];

const IDENTITY = "someone@example.com";
const HEADERS = { "X-Forwarded-Email": IDENTITY };

interface Seen {
  method?: string;
  url?: string;
  headers: http.IncomingHttpHeaders;
}

// A stand-in for Breadbox that answers every request the same way.
async function stubBreadbox(
  respond: (res: http.ServerResponse) => void
): Promise<{ baseUrl: string; seen: Seen[]; close: () => Promise<void> }> {
  const seen: Seen[] = [];
  let inFlight = 0;

  const server = http.createServer((req, res) => {
    inFlight += 1;
    res.on("close", () => {
      inFlight -= 1;
    });

    seen.push({ method: req.method, url: req.url, headers: req.headers });
    // No keep-alive, so closing the server never waits on idle sockets nor
    // cuts off a request that is still in flight.
    res.setHeader("Connection", "close");
    respond(res);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    seen,
    // The code under test fires some requests it doesn't wait for (see
    // `prefetch`), and they fail and log shortly after it has returned. Let
    // them finish while the console is still being captured.
    close: async () => {
      while (inFlight > 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const sendJson = (status: number, body: unknown) => (
  res: http.ServerResponse
) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const makeRequest = (
  baseUrl: string,
  overrides: Record<string, unknown> = {}
) => ({
  api_version: 1,
  plot_config: scatter,
  breadbox: { base_url: baseUrl, headers: HEADERS },
  ...overrides,
});

let stub: Awaited<ReturnType<typeof stubBreadbox>> | null = null;

async function runAgainst(
  respond: (res: http.ServerResponse) => void,
  overrides: Record<string, unknown> = {}
) {
  stub = await stubBreadbox(respond);
  const outcome = await runPlotDataRequest(
    makeRequest(stub.baseUrl, overrides)
  );

  return { outcome, seen: stub.seen };
}

function expectError(outcome: unknown, code: string) {
  expect(outcome).toMatchObject({ ok: false, error: { code, details: null } });

  const { message } = (outcome as { error: { message: string } }).error;

  // The message is shown to users: no identity, no URLs, no stack traces.
  expect(message.length).toBeGreaterThan(0);
  expect(JSON.stringify(outcome)).not.toContain(IDENTITY);
  expect(message).not.toMatch(/https?:\/\/|127\.0\.0\.1|\n\s+at /);
}

// The API layer reports failures on the console, and requests that are still
// settling can do so after the last test has ended, so these are never restored
// (nothing else shares this file's console).
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  await stub?.close();
  stub = null;
});

describe("invalid_config", () => {
  it("rejects an unsupported api_version without making a request", async () => {
    const { outcome, seen } = await runAgainst(sendJson(200, []), {
      api_version: 2,
    });

    expectError(outcome, "invalid_config");
    expect(seen).toHaveLength(0);
  });

  it("rejects an unknown plot_type", async () => {
    const { outcome, seen } = await runAgainst(sendJson(200, []), {
      plot_config: { ...scatter, plot_type: "pie_chart" },
    });

    expectError(outcome, "invalid_config");
    expect(seen).toHaveLength(0);
  });

  it("rejects a plot that is missing a required axis", async () => {
    const { x } = scatter.dimensions;

    const { outcome, seen } = await runAgainst(sendJson(200, []), {
      plot_config: { ...scatter, dimensions: { x } },
    });

    expectError(outcome, "invalid_config");
    expect(seen).toHaveLength(0);
  });

  it.each([
    ["missing", undefined],
    ["empty", {}],
    ["not an object", "X-Forwarded-Email: a@b.c"],
  ])(
    "rejects headers that are %s, and never sends a request without identity",
    async (_label, headers) => {
      const { outcome, seen } = await runAgainst(sendJson(200, []), {
        breadbox: { base_url: "http://127.0.0.1:1", headers },
      });

      expectError(outcome, "invalid_config");
      expect(seen).toHaveLength(0);
    }
  );

  it("rejects a base_url that isn't absolute", async () => {
    const outcome = await runPlotDataRequest(
      makeRequest("/breadbox", {
        breadbox: { base_url: "/breadbox", headers: HEADERS },
      })
    );

    expectError(outcome, "invalid_config");
  });
});

describe("forbidden", () => {
  it.each([401, 403])("maps a %i from Breadbox", async (status) => {
    const { outcome } = await runAgainst(sendJson(status, { detail: "no" }));

    expectError(outcome, "forbidden");
  });

  // Each kind of plot assembles its data differently. A request that is started
  // but never awaited would crash Node when it fails, rather than ending up here.
  it.each([
    "braf-vs-braf-inhibitors", // scatter, expanded
    "expression-distribution-per-lineage", // density_1d
    "correlation-structure-of-dependencies", // correlation_heatmap
  ])("is reported for every kind of plot (%s)", async (name) => {
    const { outcome } = await runAgainst(sendJson(403, { detail: "no" }), {
      plot_config: examples[name],
    });

    expectError(outcome, "forbidden");
  });
});

describe("dataset_not_found", () => {
  it("maps a 404 (which is also how Breadbox hides datasets you can't see)", async () => {
    const { outcome } = await runAgainst(
      sendJson(404, { detail: "Dataset not found" })
    );

    expectError(outcome, "dataset_not_found");
  });
});

describe("upstream_error", () => {
  it("maps a 5xx", async () => {
    const { outcome } = await runAgainst(sendJson(500, { detail: "boom" }));

    expectError(outcome, "upstream_error");
  });

  it("maps a body that isn't JSON", async () => {
    const { outcome } = await runAgainst((res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("<html>not json</html>");
    });

    expectError(outcome, "upstream_error");
  });

  it("maps an unreachable base_url", async () => {
    // Nothing listens on port 1.
    const outcome = await runPlotDataRequest(makeRequest("http://127.0.0.1:1"));

    expectError(outcome, "upstream_error");
  });
});

describe("requests", () => {
  it("send the caller's headers and use unprefixed paths", async () => {
    const { seen } = await runAgainst(sendJson(404, { detail: "nope" }));

    expect(seen.length).toBeGreaterThan(0);

    seen.forEach(({ url, headers }) => {
      expect(url).not.toMatch(/^\/breadbox/);
      expect(headers["x-forwarded-email"]).toBe(IDENTITY);
    });
  });
});
