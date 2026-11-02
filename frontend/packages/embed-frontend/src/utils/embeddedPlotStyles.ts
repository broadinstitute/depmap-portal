import { DEFAULT_SETTINGS } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";

export const EMBEDDED_PLOT_STYLES = {
  ...DEFAULT_SETTINGS.plotStyles,
  // Unless otherwise specified, shrink the font size a little for
  // embedded plots.
  xAxisFontSize: 12,
  yAxisFontSize: 12,
};
