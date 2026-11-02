import { runPlotDataRequest } from "../runPlotDataRequest";

// The script normalizes the config it is sent before building data (ADR 0010).
// The service and the context lookup are replaced so only that is under test.
jest.mock(
  "@depmap/data-explorer-2/src/services/dataExplorerAPI/fetchPlotData",
  () => ({
    fetchPlotData: jest.fn(),
    fetchPlotLinearRegression: jest.fn(),
  })
);
jest.mock("../fetchContextFromCas", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const service = require("@depmap/data-explorer-2/src/services/dataExplorerAPI/fetchPlotData");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fetchContextFromCas = require("../fetchContextFromCas").default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const examples = require("@depmap/data-explorer-2/src/components/DataExplorerPage/components/StartScreen/examples/public.json");

const scatter = examples["biomarker-relationship"];

const makeRequest = (plot_config: unknown) => ({
  api_version: 1,
  plot_config,
  breadbox: {
    base_url: "http://127.0.0.1:8000",
    headers: { "X-Forwarded-Email": "someone@example.com" },
  },
});

const normalized = async (plot_config: unknown) => {
  const outcome = await runPlotDataRequest(makeRequest(plot_config));

  return (outcome as { data: { plot_config: any } }).data.plot_config;
};

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  service.fetchPlotData.mockResolvedValue({ index_ids: [] });
  service.fetchPlotLinearRegression.mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

it("builds the data from the normalized config, not the one it was sent", async () => {
  const legacy = JSON.parse(JSON.stringify(scatter));
  delete legacy.version;
  delete legacy.color_by;

  const plotConfig = await normalized(legacy);

  expect(service.fetchPlotData).toHaveBeenCalledWith(plotConfig);
  // v1 -> v2: an absent color_by used to mean "uniform".
  expect(plotConfig.color_by).toBe("uniform");
  expect(plotConfig).not.toHaveProperty("version");
});

it("repairs pre-versioning payloads", async () => {
  const { x, y } = scatter.dimensions;
  const { slice_type: sliceType, ...restOfX } = x;

  const plotConfig = await normalized({
    ...scatter,
    version: undefined,
    // `dimensions` used to be an array, and `slice_type` was `entity_type`.
    dimensions: [{ ...restOfX, entity_type: sliceType }, y],
  });

  expect(plotConfig.dimensions.x.slice_type).toBe(sliceType);
  expect(plotConfig.dimensions.x).not.toHaveProperty("entity_type");
  expect(plotConfig.dimensions.y).toBeDefined();
});

it("resolves a context hash through the context store", async () => {
  const context = scatter.dimensions.x.context;
  fetchContextFromCas.mockResolvedValue(context);

  const plotConfig = await normalized({
    ...scatter,
    dimensions: {
      ...scatter.dimensions,
      x: { ...scatter.dimensions.x, context: { hash: "abc=", negated: false } },
    },
  });

  expect(fetchContextFromCas).toHaveBeenCalledWith("abc=");
  expect(plotConfig.dimensions.x.context).toEqual(context);
});

it("reports a context it can't resolve as an invalid config", async () => {
  fetchContextFromCas.mockRejectedValue(new Error("A context was not found."));

  const outcome = await runPlotDataRequest(
    makeRequest({
      ...scatter,
      dimensions: {
        ...scatter.dimensions,
        x: { ...scatter.dimensions.x, context: { hash: "nope=" } },
      },
    })
  );

  expect(outcome).toMatchObject({
    ok: false,
    error: { code: "invalid_config" },
  });
  expect(service.fetchPlotData).not.toHaveBeenCalled();
});

it.each([
  ["a dimension that isn't an object", { dimensions: { x: "nope", y: 1 } }],
  [
    "a dimension with no context",
    { dimensions: { x: {}, y: scatter.dimensions.y } },
  ],
  ["filters that aren't objects", { filters: "nope" }],
  ["metadata values that aren't objects", { metadata: { color_property: 7 } }],
])("rejects %s without crashing", async (_label, overrides) => {
  const outcome = await runPlotDataRequest(
    makeRequest({ ...scatter, ...overrides })
  );

  expect(outcome).toMatchObject({
    ok: false,
    error: { code: "invalid_config" },
  });
  expect(service.fetchPlotData).not.toHaveBeenCalled();
});
