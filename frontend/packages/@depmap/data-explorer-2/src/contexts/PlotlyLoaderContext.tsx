import React, { createContext, useContext } from "react";
import type Plotly from "plotly.js";

type PlotlyType = typeof Plotly;
// type PlotlyType = Omit<typeof Plotly, "register" | "animate" | "Icons">;

type PlotlyLoaderType = React.FC<{
  version: "global" | "module";
  children: (Plotly: PlotlyType) => React.ReactElement | null;
}>;

const defaultValue = (() => {
  throw new Error("Make sure a <PlotlyLoaderProvider> is in the React tree.");
}) as PlotlyLoaderType;

const PlotlyLoaderContext = createContext(defaultValue);

export const usePlotlyLoader = () => {
  return useContext(PlotlyLoaderContext);
};

export const PlotlyLoaderProvider = ({
  PlotlyLoader,
  children,
}: {
  // Trying to get different versions of Plotly to play nice is too challenging.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PlotlyLoader: any;
  children: React.ReactNode;
}) => {
  return (
    <PlotlyLoaderContext.Provider value={PlotlyLoader as PlotlyLoaderType}>
      {children}
    </PlotlyLoaderContext.Provider>
  );
};
