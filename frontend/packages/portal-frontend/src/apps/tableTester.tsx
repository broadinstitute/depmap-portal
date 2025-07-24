import "src/public-path";
import React, { useState } from "react";
import ReactDOM from "react-dom";
import {
  ContextTypeSelect,
  PlotlyLoaderProvider,
} from "@depmap/data-explorer-2";
import SliceTable from "@depmap/slice-table";
import { SliceQuery } from "@depmap/types";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import PlotlyLoader from "src/plot/components/PlotlyLoader";

const container = document.getElementById("react-root");

const slices: SliceQuery[] = [];

const App = () => {
  const [indexTypeName, setIndexTypeName] = useState("depmap_model");

  return (
    <ErrorBoundary>
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
        <div style={{ margin: 20 }}>
          <ContextTypeSelect
            value={indexTypeName}
            onChange={setIndexTypeName}
            useContextBuilderV2
            title="Dimension type"
          />
        </div>
        <div
          style={{ margin: 20, display: "flex", height: "calc(100vh - 146px)" }}
        >
          <SliceTable index_type_name={indexTypeName} initialSlices={slices} />
        </div>
      </PlotlyLoaderProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
