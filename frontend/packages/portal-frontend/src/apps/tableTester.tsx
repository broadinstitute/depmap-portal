import "src/public-path";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import qs from "qs";
import { Button } from "react-bootstrap";
import { showInfoModal } from "@depmap/common-components";
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

function dedent(str: string) {
  const lines = str.split("\n");
  const indent = Math.min(
    ...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length)
  );
  return lines
    .map((l) => l.slice(indent))
    .join("\n")
    .trim();
}

function indentBlock(str: string, spaces: number) {
  return str
    .split("\n")
    .map((line, i) => (i === 0 ? line : " ".repeat(spaces) + line))
    .join("\n");
}

function showCodeSnippet(indexTypeName: string) {
  const sliceJson = JSON.stringify(initialSlices, null, 2);

  const snippet = dedent(`
    import React from "react";
    import SliceTable from "@depmap/slice-table";

    function MyTable() {
      return (
        <SliceTable
          index_type_name="${indexTypeName}"
          getInitialState={() => ({
            initialSlices: ${indentBlock(sliceJson, 12)},
          })}
        />
      );
    }

    export default MyTable;
  `);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
  };

  showInfoModal({
    title: "Export as React component",
    content: (
      <div style={{ position: "relative", maxHeight: "calc(100vh - 210px)" }}>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            cursor: "pointer",
          }}
        >
          Copy to clipboard
        </button>
        <pre>
          <code>{snippet}</code>
        </pre>
      </div>
    ),
  });
}

const App = () => {
  const [key, setKey] = useState(0);
  const [indexTypeName, setIndexTypeName] = useState(getIndexTypeNameFromUrl());

  const handleChangeIndexTypeName = (nextIndexTypeName: string) => {
    updateQueryString([], nextIndexTypeName);
    setIndexTypeName(nextIndexTypeName);
  };

  const handleChangeSlices = (nextSlices: SliceQuery[]) => {
    updateQueryString(nextSlices, indexTypeName);
    initialSlices = getSlicesFromUrl();
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
            renderCustomActions={() => {
              return (
                <Button onClick={() => showCodeSnippet(indexTypeName)}>
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg"
                    height="20"
                    alt="convert to react component"
                  />{" "}
                  Export as React component
                </Button>
              );
            }}
          />
        </div>
      </PlotlyLoaderProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
