import "src/public-path";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import qs from "qs";
import {
  ContextTypeSelect,
  PlotlyLoaderProvider,
} from "@depmap/data-explorer-2";
import SliceTable from "@depmap/slice-table";
import { SliceQuery } from "@depmap/types";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import PlotlyLoader from "src/plot/components/PlotlyLoader";

const container = document.getElementById("react-root");

const getIndexTypeNameFromUrl = () => {
  const queryString = window.location.search.slice(1);
  const params = qs.parse(queryString);

  return (params.index_type_name as string) || "depmap_model";
};

const getSlicesFromUrl = () => {
  try {
    const queryString = window.location.search.slice(1);
    const params = qs.parse(queryString);

    if (params.slices) {
      const decodedString = atob((params as any).slices);
      const parsedSlices = JSON.parse(decodedString);

      if (Array.isArray(parsedSlices)) {
        return parsedSlices;
      }
    }
  } catch (error) {
    window.console.error("Error parsing slices from URL:", error);
  }

  return [];
};

let initialSlices: SliceQuery[] = getSlicesFromUrl();

const updateQueryString = (
  nextSlices: SliceQuery[],
  nextIndexTypeName: string
) => {
  try {
    const jsonString = JSON.stringify(nextSlices);
    const encodedString = btoa(jsonString);
    const baseUrl = window.location.pathname;

    const newParams = {
      slices: encodedString,
      index_type_name: nextIndexTypeName,
    };

    const newQueryString = qs.stringify(newParams);
    const newUrl = newQueryString ? `${baseUrl}?${newQueryString}` : baseUrl;

    window.history.pushState(null, "", newUrl);
  } catch (error) {
    window.console.error("Error updating URL with slices:", error);
  }
};

const App = () => {
  const [key, setKey] = useState(0);
  const [indexTypeName, setIndexTypeName] = useState(getIndexTypeNameFromUrl());

  const handleChangeIndexTypeName = (nextIndexTypeName: string) => {
    updateQueryString([], nextIndexTypeName);
    setIndexTypeName(nextIndexTypeName);
  };

  const handleChangeSlices = (nextSlices: SliceQuery[]) => {
    updateQueryString(nextSlices, indexTypeName);
  };

  useEffect(() => {
    const handlePopState = () => {
      initialSlices = getSlicesFromUrl();
      setKey((k) => k + 1);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <ErrorBoundary>
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
        <div style={{ margin: 20 }}>
          <ContextTypeSelect
            value={indexTypeName}
            onChange={handleChangeIndexTypeName}
            useContextBuilderV2
            title="Dimension type"
          />
        </div>
        <div
          style={{ margin: 20, display: "flex", height: "calc(100vh - 146px)" }}
        >
          <SliceTable
            key={key}
            index_type_name={indexTypeName}
            getInitialState={() => ({ initialSlices })}
            onChangeSlices={handleChangeSlices}
          />
        </div>
      </PlotlyLoaderProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
