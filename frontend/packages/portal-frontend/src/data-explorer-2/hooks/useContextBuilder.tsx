import React, { useRef, useState } from "react";
import { ApiContext } from "@depmap/api";
import {
  ContextBuilderModal,
  negateContext,
  saveContextToLocalStorage,
} from "@depmap/data-explorer-2";
import {
  DataExplorerContext,
  DataExplorerPlotConfig,
  ContextPath,
} from "@depmap/types";
import { getDapi as getApi } from "src/common/utilities/context";
import {
  plotToQueryString,
  plotsAreEquivalentWhenSerialized,
} from "src/data-explorer-2/utils";

type SaveCallback = (context: DataExplorerContext) => void;
const noop = () => {};

const getVectorCatalogApi = () => {
  throw new Error("Vector Catalog API is no longer supported!");
};

export default function useContextBuilder(
  plot: DataExplorerPlotConfig,
  setPlot: (config: DataExplorerPlotConfig) => void
) {
  const [showContextModal, setShowContextModal] = useState(false);
  const contextToEdit = useRef<DataExplorerContext | { context_type: string }>({
    context_type: "depmap_model",
  });
  const onClickSave = useRef<SaveCallback | null>(noop);

  const saveContext = async (
    context: DataExplorerContext,
    path: ContextPath | null,
    isNew: boolean,
    wasNegatedContext: boolean
  ) => {
    let nextPlot = { ...plot };
    const contextToSet = wasNegatedContext ? negateContext(context) : context;

    if (path && path[0] === "dimensions") {
      const dimensionKey = path[1];

      nextPlot = {
        ...nextPlot,
        dimensions: {
          ...plot.dimensions,
          [dimensionKey]: {
            ...plot.dimensions[dimensionKey],
            context: contextToSet,
          },
        },
      };
    }

    if (path && path[0] === "filters") {
      const filterProp = path[1];

      nextPlot = {
        ...nextPlot,
        filters: {
          ...plot.filters,
          [filterProp]: contextToSet,
        },
      };
    }

    await saveContextToLocalStorage(context);
    const queryString = await plotToQueryString(nextPlot);

    setShowContextModal(false);

    if (isNew) {
      window.history.pushState(null, "", queryString);
      setPlot(nextPlot);
    } else if (!plotsAreEquivalentWhenSerialized(plot, nextPlot)) {
      window.history.replaceState(null, "", queryString);
      setPlot(nextPlot);
    }

    window.dispatchEvent(new Event("dx2_contexts_updated"));
  };

  const onClickCreateContext = (path: ContextPath) => {
    let context_type;

    if (path[0] === "dimensions") {
      const [, key] = path;
      const { dimensions } = plot;
      context_type = dimensions[key]!.slice_type;
    } else {
      context_type = plot.index_type;
    }

    contextToEdit.current = { context_type };

    onClickSave.current = (newContext: DataExplorerContext) => {
      saveContext(newContext, path, true, false);
    };

    setShowContextModal(true);
  };

  const onClickSaveAsContext = (
    context: DataExplorerContext,
    path: ContextPath | null
  ) => {
    const isNegated = Boolean(
      typeof context.expr === "object" && context.expr["!"]
    );

    contextToEdit.current = isNegated ? negateContext(context) : context;

    onClickSave.current = (newContext: DataExplorerContext) => {
      saveContext(newContext, path, false, isNegated);
    };

    setShowContextModal(true);
  };

  return {
    onClickCreateContext,
    onClickSaveAsContext,
    ContextBuilder: () => (
      <ApiContext.Provider value={{ getApi, getVectorCatalogApi }}>
        <ContextBuilderModal
          show={showContextModal}
          context={contextToEdit.current}
          onClickSave={onClickSave.current as SaveCallback}
          onHide={() => setShowContextModal(false)}
        />
      </ApiContext.Provider>
    ),
  };
}
