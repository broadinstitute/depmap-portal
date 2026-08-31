import { breadboxAPI } from "../breadboxAPI";
import { cached } from "../apiCacheDecorator";

// Minimal stand-ins for the fetch machinery request() uses; jsdom provides
// neither fetch nor Headers.
class FakeHeaders {
  private map = new Map<string, string>();

  constructor(init?: Record<string, string>) {
    Object.entries(init || {}).forEach(([k, v]) => this.set(k, v));
  }

  has(name: string) {
    return this.map.has(name.toLowerCase());
  }

  set(name: string, value: string) {
    this.map.set(name.toLowerCase(), value);
  }

  get(name: string) {
    return this.map.get(name.toLowerCase()) ?? null;
  }
}

beforeEach(() => {
  (globalThis as { Headers: unknown }).Headers = FakeHeaders;

  (globalThis as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new FakeHeaders({ "content-type": "application/json" }),
    json: async () => [],
  });
});

it("plain cached() serves repeated identical GETs from memory", async () => {
  // REGRESSION: the decorator once mapped plain cached(api) to a null ambient
  // context, which createJsonClient reads as "not inside cached() at all" —
  // silently disabling the in-memory cache for every non-persisted call and
  // re-fetching getDatasets/getDimensionTypes on every use.
  await cached(breadboxAPI).getDimensionTypes();
  await cached(breadboxAPI).getDimensionTypes();
  await cached(breadboxAPI).getDimensionTypes();

  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
