import React, { useCallback } from "react";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import { SlicePreview } from "@depmap/slice-table";
import { DataExplorerContextVariable, SliceQuery } from "@depmap/types";
import { usePlotlyLoader } from "../../../../../../contexts/PlotlyLoaderContext";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import {
  isListOperator,
  OperatorType,
} from "../../../../utils/expressionUtils";

interface Props {
  expr: string | string[] | number | null;
  op: OperatorType;
  path: (string | number)[];
  variable: Partial<DataExplorerContextVariable> | null;
}

type PartialRange = [number | undefined, number | undefined];

function useSlicePreview({ expr, op, path, variable }: Props) {
  const PlotlyLoader = usePlotlyLoader();
  const { dimension_type, dispatch } = useContextBuilderState();

  const handleClickShowSlicePreview = useCallback(async () => {
    let nextValue: unknown = expr;

    const accepted = await promptForValue({
      title: `${variable!.label || variable!.identifier} distribution`,
      acceptButtonText: "Save changes",
      defaultValue: false, // has valid changes
      PromptComponent: ({ onChange }: PromptComponentProps<boolean>) => {
        return (
          <SlicePreview
            value={variable as SliceQuery}
            index_type_name={dimension_type}
            PlotlyLoader={PlotlyLoader}
            getCategoricalFilterProps={() => ({
              selectionMode: isListOperator(op) ? "multiple" : "single",
              initialSelectedValues: new Set(expr != null ? [expr].flat() : []),
              onChangeSelectedValues: (nextSelectedValues) => {
                if (isListOperator(op)) {
                  nextValue = [...nextSelectedValues];
                } else {
                  nextValue = [...nextSelectedValues][0];
                }

                onChange(
                  nextValue !== expr &&
                    nextValue != null &&
                    (!Array.isArray(nextValue) || nextValue.length > 0)
                );
              },
            })}
            getContinuousFilterProps={() => ({
              hasFixedMin: ["<", "<=", "==", "!="].includes(op),
              hasFixedMax: [">", ">=", "==", "!="].includes(op),
              minInclusive: op !== ">",
              maxInclusive: op !== "<",
              initialRange: (op.startsWith("<")
                ? [undefined, expr]
                : [expr, undefined]) as PartialRange,
              onChangeRange: ([min, max]) => {
                nextValue = op.startsWith(">") ? min : max;
                onChange(nextValue !== expr);
              },
            })}
          />
        );
      },
    });

    if (accepted && nextValue != null) {
      const value = Array.isArray(nextValue) ? nextValue.sort() : nextValue;
      dispatch({ type: "update-value", payload: { path, value } });
    }
  }, [PlotlyLoader, dimension_type, dispatch, expr, op, path, variable]);

  return { handleClickShowSlicePreview };
}

export default useSlicePreview;
