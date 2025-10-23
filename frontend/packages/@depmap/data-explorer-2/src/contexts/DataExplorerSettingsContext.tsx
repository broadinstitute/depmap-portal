import React, { createContext, useCallback, useContext, useState } from "react";
import ReactDOM from "react-dom";
import get from "lodash.get";

const SettingsModal = React.lazy(
  () =>
    import(
      /* webpackChunkName: "SettingsModal" */
      "../components/SettingsModal"
    )
);

export const DEFAULT_SETTINGS = {
  useLegacyPortalBackend: false,
  plotStyles: {
    pointSize: 10,
    pointOpacity: 0.5,
    outlineWidth: 2,
    xAxisFontSize: 14,
    yAxisFontSize: 14,
    palette: {
      all: "#3f3f9f",
      other: "#bdbdbd",
      compare1: "#3f3f9f",
      compare2: "#c55253",
      compareBoth: "#863e8d",
      qualitativeFew: [
        "#1f77b4",
        "#ff7f0e",
        "#2ca02c",
        "#d62728",
        "#9467bd",
        "#8c564b",
        "#e377c2",
        "#bcbd22",
        "#17becf",
      ],
      qualitativeMany: [
        "#1f77b4",
        "#aec7e8",
        "#ff7f0e",
        "#ffbb78",
        "#2ca02c",
        "#98df8a",
        "#d62728",
        "#ff9896",
        "#9467bd",
        "#c5b0d5",
        "#8c564b",
        "#c49c94",
        "#e377c2",
        "#f7b6d2",
        "#bcbd22",
        "#dbdb8d",
        "#17becf",
        "#9edae5",
      ],
      sequentialScale: [
        ["0.0", "#482777"],
        ["0.111111", "#453681"],
        ["0.222222", "#3a548c"],
        ["0.333333", "#2d718e"],
        ["0.444444", "#238a8d"],
        ["0.555555", "#2aa286"],
        ["0.666666", "#3cbc75"],
        ["0.777777", "#94d841"],
        ["0.888888", "#dce419"],
        ["1.0", "#fde724"],
      ],
    },
  },
};

export type Settings = typeof DEFAULT_SETTINGS;

export const DataExplorerSettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  launchSettingsModal: () => {},
});

export const useDataExplorerSettings = () => {
  const { settings } = useContext(DataExplorerSettingsContext);
  return settings;
};

export const useLaunchSettingsModal = () => {
  const { launchSettingsModal } = useContext(DataExplorerSettingsContext);
  return launchSettingsModal;
};

const resolveSettingsWithDefaults = (newSettings: Settings) => {
  // Recursively look up default values. If a saved property has
  // been removed from the defaults, it will also be removed here.
  const resolveDefaults = (obj: object, prevPath: string[] = []) => {
    const resolvedObj: Record<string, unknown> = {};

    Object.keys(obj).forEach((key) => {
      const prop = obj[key as keyof typeof obj];
      const path = [...prevPath, key];

      if (prop !== null && typeof prop === "object" && !Array.isArray(prop)) {
        resolvedObj[key] = resolveDefaults(prop, path);
      } else if (get(DEFAULT_SETTINGS, path) !== undefined) {
        const value = get(newSettings, path) ?? get(DEFAULT_SETTINGS, path);
        resolvedObj[key] = value;
      }
    });

    return resolvedObj;
  };

  return resolveDefaults(DEFAULT_SETTINGS) as Settings;
};

export const DataExplorerSettingsProvider = ({
  children,
  feedbackUrl = "",
}: {
  children: React.ReactNode;
  feedbackUrl?: string;
}) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const storageItem = window.localStorage.getItem("data_explorer_2_settings");
    const savedSettings = storageItem ? JSON.parse(storageItem) : {};
    return resolveSettingsWithDefaults(savedSettings);
  });

  const launchSettingsModal = useCallback(() => {
    const container = document.getElementById("modal-container") as HTMLElement;
    const hide = () => ReactDOM.unmountComponentAtNode(container);
    // Unmount a previous instance if any (otherwise this is a no-op).
    hide();

    ReactDOM.render(
      <React.Suspense fallback={null}>
        <SettingsModal
          initialSettings={settings}
          defaultSettings={DEFAULT_SETTINGS}
          feedbackUrl={feedbackUrl}
          onSave={(updatedSettings) => {
            window.localStorage.setItem(
              "data_explorer_2_settings",
              JSON.stringify(updatedSettings)
            );
            setSettings(updatedSettings);
            hide();

            if (
              updatedSettings.useLegacyPortalBackend !==
              settings.useLegacyPortalBackend
            ) {
              window.location.reload();
            }
          }}
          onHide={hide}
        />
      </React.Suspense>,
      container
    );
  }, [settings, feedbackUrl]);

  return (
    <DataExplorerSettingsContext.Provider
      value={{ settings, launchSettingsModal }}
    >
      {children}
    </DataExplorerSettingsContext.Provider>
  );
};
