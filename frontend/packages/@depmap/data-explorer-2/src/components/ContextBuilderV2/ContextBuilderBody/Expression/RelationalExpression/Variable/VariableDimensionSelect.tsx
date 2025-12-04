import React, { useMemo } from "react";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import DimensionSelectV2 from "../../../../../DimensionSelectV2";
import useDimensionType from "../../../../hooks/useDimensionType";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";

interface Props {
  varName: string;
}

function MatrixDataSelect({ varName }: Props) {
  const { dimension_type, vars, setVar } = useContextBuilderState();
  const { getDimensionTypeAsync } = useDimensionType();
  const variable = vars[varName] || null;

  const dimension = useMemo(() => {
    if (!variable) {
      return null;
    }

    const exprVarName = ["sample_label", "feature_label"].includes(
      variable.identifier_type || ""
    )
      ? "entity_label"
      : "given_id";

    return {
      axis_type: "raw_slice",
      aggregation: "first",
      slice_type: variable.slice_type,
      dataset_id: variable.dataset_id,
      context: variable.identifier
        ? {
            dimension_type: variable.slice_type || null,
            name: variable.label || variable.identifier,
            expr: { "==": [{ var: exprVarName }, variable.identifier] },
            vars: {},
          }
        : undefined,
    } as Partial<DataExplorerPlotConfigDimensionV2>;
  }, [variable]);

  return (
    <DimensionSelectV2
      mode="entity-only"
      removeWrapperDiv
      allowNullFeatureType
      allowTextValueType
      allowCategoricalValueType
      allowListStringsValueType
      index_type={dimension_type}
      value={dimension}
      onChange={async (nextDimension) => {
        const dimensionType = await getDimensionTypeAsync();

        const expr = nextDimension?.context?.expr;
        type EqExpr = { "==": [{ var: string }, string] };
        const nextVar = expr ? (expr as EqExpr)["=="][0]?.var : undefined;
        const identifier = expr ? (expr as EqExpr)["=="][1] : undefined;

        let identifier_type: typeof variable["identifier_type"] =
          dimensionType.axis === "sample" ? "feature_id" : "sample_id";

        // For backward compatibility with legacy contexts.
        if (nextVar === "entity_label") {
          identifier_type =
            dimensionType.axis === "sample" ? "feature_label" : "sample_label";
        }

        setVar(varName, {
          dataset_id: nextDimension.dataset_id,
          identifier,
          identifier_type,
          source: "custom",
          slice_type: nextDimension.slice_type,
          label: nextDimension.context?.name,
        });
      }}
    />
  );
}

export default MatrixDataSelect;
