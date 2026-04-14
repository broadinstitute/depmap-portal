import React from "react";
import { DepMap } from "@depmap/globals";
import { DataExplorerContextV2 } from "@depmap/types";
import {
  capitalize,
  getDimensionTypeLabel,
} from "../../../../../../utils/misc";
import PlotConfigSelect from "../../../../../PlotConfigSelect";
import ContextSelectorV2 from "../../../../../ContextSelectorV2";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";

interface Props {
  expr: { context: string | null } | null;
  path: (string | number)[];
  domain: { references: string } | null;
  isLoading: boolean;
}

function EmbeddedContext({ expr, path, domain, isLoading }: Props) {
  const {
    dispatch,
    shouldShowValidation,
    embeddedContexts,
    setEmbeddedContext,
  } = useContextBuilderState();

  const value = expr?.context ? embeddedContexts[expr.context] : null;

  const dimension_type = domain?.references;
  const label = capitalize(getDimensionTypeLabel(dimension_type)) + " Context";

  if (!dimension_type) {
    return (
      <PlotConfigSelect
        label={label}
        show
        enable={false}
        options={[]}
        value={{ label: "Loading...", value: "" }}
        onChange={() => {}}
      />
    );
  }

  const handleChange = (
    context: DataExplorerContextV2 | null,
    hash: string | null
  ) => {
    if (context && hash) {
      setEmbeddedContext(hash, context);
    }

    setTimeout(() => {
      dispatch({
        type: "update-value",
        payload: { path, value: { context: hash } },
      });
    });
  };

  return (
    <ContextSelectorV2
      show
      label={label}
      enable={!isLoading}
      value={value}
      hasError={shouldShowValidation && !expr}
      dimension_type={dimension_type}
      onChange={handleChange}
      onClickCreateContext={() => {
        DepMap.saveNewContext({ dimension_type }, null, handleChange);
      }}
      onClickSaveAsContext={() => {
        DepMap.saveNewContext(value!, null, () => {
          setEmbeddedContext(expr!.context!, value!);
        });
      }}
    />
  );
}

export default EmbeddedContext;
