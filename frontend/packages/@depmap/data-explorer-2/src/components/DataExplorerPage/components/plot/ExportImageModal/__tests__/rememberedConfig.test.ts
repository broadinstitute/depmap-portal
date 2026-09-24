import { DEFAULT_EXPORT_CONFIG, ExportConfig } from "../exportDefaults";
import {
  readRememberedExportConfig,
  rememberExportConfig,
} from "../rememberedConfig";

const makeConfig = (overrides: Partial<ExportConfig> = {}): ExportConfig => ({
  ...DEFAULT_EXPORT_CONFIG,
  ...overrides,
});

// jest-setup.ts's global `afterEach` calls `jest.resetAllMocks()` (to reset
// the @depmap/api auto-mocks). That collaterally strips the *implementation*
// off jest-localstorage-mock's getItem/setItem too, since those are also
// jest.fn()s — and jest-localstorage-mock only installs one such instance
// per test file, reused across every test in it. So after the first test's
// afterEach runs, localStorage silently goes dead for the rest of the file.
// Re-mocking it fresh here, every test, works around that: this beforeEach
// runs after the global afterEach's reset, so it always starts clean.
beforeEach(() => {
  const store: Record<string, string> = {};
  jest
    .spyOn(window.localStorage, "getItem")
    .mockImplementation((key) => (key in store ? store[key] : null));
  jest
    .spyOn(window.localStorage, "setItem")
    .mockImplementation((key, value) => {
      store[key] = value;
    });
  jest.spyOn(window.localStorage, "clear").mockImplementation(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  });
});

describe("rememberExportConfig / readRememberedExportConfig", () => {
  test("round-trips every field for one plot type", () => {
    const config = makeConfig({
      width: 999,
      chromeLineWidth: 5,
      legendPosition: "above",
      tickFontSize: 18,
    });

    rememberExportConfig(config, "scatter");
    const result = readRememberedExportConfig("scatter");

    expect(result.width).toBe(999);
    expect(result.chromeLineWidth).toBe(5);
    expect(result.legendPosition).toBe("above");
    expect(result.tickFontSize).toBe(18);
  });

  test("per-type fields tuned for one plot type don't leak into another", () => {
    rememberExportConfig(makeConfig({ chromeLineWidth: 5 }), "scatter");

    const heatmapResult = readRememberedExportConfig("correlation_heatmap");

    expect(heatmapResult.chromeLineWidth).toBe(
      DEFAULT_EXPORT_CONFIG.chromeLineWidth
    );
  });

  test("shared fields (width/height/unit/resolution) carry over to every plot type", () => {
    rememberExportConfig(makeConfig({ width: 999, height: 777 }), "scatter");

    const waterfallResult = readRememberedExportConfig("waterfall");

    expect(waterfallResult.width).toBe(999);
    expect(waterfallResult.height).toBe(777);
  });

  test("an out-of-range remembered value falls back to the default rather than being trusted", () => {
    rememberExportConfig(makeConfig({ chromeLineWidth: 5 }), "density_1d");

    // Directly corrupt what got stored, the way a hand-edited or
    // since-re-bounded payload could.
    const raw = JSON.parse(
      window.localStorage.getItem(
        "data_explorer_2_image_export_density_1d"
      ) as string
    );
    raw.chromeLineWidth = 999;
    window.localStorage.setItem(
      "data_explorer_2_image_export_density_1d",
      JSON.stringify(raw)
    );

    const result = readRememberedExportConfig("density_1d");
    expect(result.chromeLineWidth).toBe(DEFAULT_EXPORT_CONFIG.chromeLineWidth);
  });

  test("missing localStorage entirely falls back to the full default config", () => {
    const result = readRememberedExportConfig("waterfall");
    expect(result).toEqual(DEFAULT_EXPORT_CONFIG);
  });
});
