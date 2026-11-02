import http from "http";
import type { AddressInfo } from "net";
import { configureBreadboxClient, getRequestFailure } from "@depmap/api";
import fetchContextFromCas from "../fetchContextFromCas";
import { runPlotDataRequest } from "../runPlotDataRequest";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const examples = require("@depmap/data-explorer-2/src/components/DataExplorerPage/components/StartScreen/examples/public.json");

const scatter = examples["biomarker-relationship"];
const HEADERS = { "X-Forwarded-Email": "someone@example.com" };

let server: http.Server | null = null;
let urls: string[] = [];

async function stubBreadbox(status: number, body: unknown) {
  urls = [];
  server = http.createServer((req, res) => {
    urls.push(req.url || "");
    res.setHeader("Connection", "close");
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));

  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  configureBreadboxClient(null);
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

// The page retries a failed lookup against the legacy Portal's CAS. The script
// has no such address and deliberately doesn't (see ADR 0010), so a context that
// Breadbox can't resolve is simply not found.
describe("a context Breadbox can't resolve", () => {
  it("is reported as not found, without a legacy Portal fallback", async () => {
    const baseUrl = await stubBreadbox(404, { detail: "Not found" });
    configureBreadboxClient({ baseUrl, headers: HEADERS });

    await expect(fetchContextFromCas("abc=")).rejects.toThrow(/not found/);

    // One request, to Breadbox's path. (The page's fallback asks for /cas/...)
    expect(urls).toEqual(["/temp/cas/abc="]);
  });

  it("fails the whole request as invalid_config", async () => {
    const baseUrl = await stubBreadbox(404, { detail: "Not found" });

    const outcome = await runPlotDataRequest({
      api_version: 1,
      plot_config: {
        ...scatter,
        dimensions: {
          ...scatter.dimensions,
          x: { ...scatter.dimensions.x, context: { hash: "abc=" } },
        },
      },
      breadbox: { base_url: baseUrl, headers: HEADERS },
    });

    expect(outcome).toMatchObject({
      ok: false,
      error: { code: "invalid_config" },
    });
    expect(urls).toEqual(["/temp/cas/abc="]);
  });
});

it("leaves other failures to be classified by status", async () => {
  const baseUrl = await stubBreadbox(500, { detail: "boom" });
  configureBreadboxClient({ baseUrl, headers: HEADERS });

  const error = await fetchContextFromCas("abc=").catch((e) => e);

  expect(getRequestFailure(error)).toEqual({ status: 500 });
});

it("rejects an answer with no usable value", async () => {
  const baseUrl = await stubBreadbox(200, { value: "not json" });
  configureBreadboxClient({ baseUrl, headers: HEADERS });

  await expect(fetchContextFromCas("abc=")).rejects.toThrow(
    /could not be read/
  );
});

it("returns the stored context", async () => {
  const context = { name: "x", dimension_type: "gene", expr: true, vars: {} };
  const baseUrl = await stubBreadbox(200, { value: JSON.stringify(context) });
  configureBreadboxClient({ baseUrl, headers: HEADERS });

  expect(await fetchContextFromCas("abc=")).toEqual(context);
});
