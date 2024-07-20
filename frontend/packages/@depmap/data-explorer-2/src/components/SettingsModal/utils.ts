import type { Settings } from "../../contexts/DataExplorerSettingsContext";

export const updateStyle = (prop: string, value: unknown) => (
  settings: Settings
) => ({
  ...settings,
  plotStyles: {
    ...settings.plotStyles,
    [prop]: value,
  },
});

export const updateColor = (prop: string, value: unknown) => (
  settings: Settings
) => ({
  ...settings,
  plotStyles: {
    ...settings.plotStyles,
    palette: {
      ...settings.plotStyles.palette,
      [prop]: value,
    },
  },
});

export const isValidNumber = (n: number, min: number, max: number) => {
  return typeof n === "number" && !Number.isNaN(n) && n >= min && n <= max;
};
