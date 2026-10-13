import { runPlotDataRequest } from "../runPlotDataRequest";

// What these tests cover is what the script does with the service's two
// results, so the service itself is replaced. (The Breadbox-facing behavior is
// in runPlotDataRequest.test.ts.)
jest.mock(
  "@depmap/data-explorer-2/src/services/dataExplorerAPI/fetchPlotData",
  () => ({
    fetchPlotData: jest.fn(),
    fetchPlotLinearRegression: jest.fn(),
  })
);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const service = require("@depmap/data-explorer-2/src/services/dataExplorerAPI/fetchPlotData");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const examples = require("@depmap/data-explorer-2/src/components/DataExplorerPage/components/StartScreen/examples/public.json");

const request = {
  api_version: 1,
  plot_config: examples["biomarker-relationship"],
  breadbox: {
    base_url: "http://127.0.0.1:8000",
    headers: { "X-Forwarded-Email": "someone@example.com" },
  },
};

const PLOT = {
  index_type: "depmap_model",
  index_ids: ["a", "b"],
  dimensions: {},
};
// `data` always carries the normalized config too; what it contains is covered
// in normalizePlotConfig.test.ts.
const WITH_CONFIG = {
  ...PLOT,
  plot_config: expect.objectContaining({ plot_type: "scatter" }),
};
const FIT = [{ group_label: "all", slope: 2, intercept: 1 }];

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  service.fetchPlotData.mockResolvedValue(PLOT);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

it("adds the regression fit to data when one was computed", async () => {
  service.fetchPlotLinearRegression.mockResolvedValue(FIT);

  expect(await runPlotDataRequest(request)).toEqual({
    ok: true,
    data: { ...WITH_CONFIG, linreg_by_group: FIT },
  });
});

it("leaves data exactly as the service returned it when no fit applies", async () => {
  service.fetchPlotLinearRegression.mockResolvedValue(null);

  const outcome = await runPlotDataRequest(request);

  expect(outcome).toEqual({ ok: true, data: WITH_CONFIG });
  expect(Object.keys((outcome as { data: object }).data)).not.toContain(
    "linreg_by_group"
  );
});

it("still returns the plot when the fit can't be computed", async () => {
  service.fetchPlotLinearRegression.mockRejectedValue(
    Object.assign(new Error("Request failed with status 500"), {
      isRequestFailure: true,
      status: 500,
    })
  );

  expect(await runPlotDataRequest(request)).toEqual({
    ok: true,
    data: WITH_CONFIG,
  });
});

it("does not hide a bug in the script behind a missing fit", async () => {
  service.fetchPlotLinearRegression.mockRejectedValue(new TypeError("bug"));

  await expect(runPlotDataRequest(request)).rejects.toThrow("bug");
});
