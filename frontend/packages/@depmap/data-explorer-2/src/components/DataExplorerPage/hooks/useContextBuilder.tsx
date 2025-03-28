import React, { useRef, useState } from "react";
import { isElara } from "@depmap/globals";
import {
  DataExplorerContext,
  DataExplorerPlotConfig,
  ContextPath,
} from "@depmap/types";
import {
  negateContext,
  saveContextToLocalStorageAndPersist,
} from "../../../utils/context";
import ContextBuilderModal from "../../ContextBuilder/ContextBuilderModal";
import ContextBuilderV2 from "../../ContextBuilderV2";
import { plotToQueryString, plotsAreEquivalentWhenSerialized } from "../utils";
import { isCompletePlot } from "../validation";

const ContextBuilder = isElara
  ? (ContextBuilderV2 as any)
  : ContextBuilderModal;

type SaveCallback = (context: DataExplorerContext) => void;
const noop = () => {};

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

    await saveContextToLocalStorageAndPersist(context);
    const queryString = await plotToQueryString(nextPlot);

    setShowContextModal(false);

    if (isNew) {
      setPlot(nextPlot);

      if (isCompletePlot(nextPlot)) {
        window.history.pushState(null, "", queryString);
      }
    } else if (!plotsAreEquivalentWhenSerialized(plot, nextPlot)) {
      setPlot(nextPlot);

      if (isCompletePlot(nextPlot)) {
        window.history.replaceState(null, "", queryString);
      }
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
      <ContextBuilder
        show={showContextModal}
        context={contextToEdit.current}
        onClickSave={onClickSave.current as SaveCallback}
        onHide={() => setShowContextModal(false)}
      />
    ),
  };
}
