import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { get_values } from "json-logic-js";
import {
  fetchSliceLabels,
  fetchUniqueValuesOrRange,
  isPartialSliceId,
} from "@depmap/data-explorer-2";
import { useContextBuilderContext } from "src/data-explorer-2/components/ContextBuilder/ContextBuilderContext";
import {
  floor,
  getOperator,
  getValueType,
  isListOperator,
} from "src/data-explorer-2/components/ContextBuilder/contextBuilderUtils";
import Variable from "src/data-explorer-2/components/ContextBuilder/Variable";
import Operator from "src/data-explorer-2/components/ContextBuilder/Operator";
import List from "src/data-explorer-2/components/ContextBuilder/List";
import Constant from "src/data-explorer-2/components/ContextBuilder/Constant";
import NumberExpr from "src/data-explorer-2/components/ContextBuilder/NumberExpr";
import { ContextBuilderReducerAction } from "src/data-explorer-2/components/ContextBuilder/contextBuilderReducer";

interface Props {
  expr: any;
  path: (string | number)[];
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  slice_type: string;
  shouldShowValidation: boolean;
}

interface SummaryContinuous {
  value_type: "continuous";
  min: number;
  max: number;
}

interface SummaryCategorical {
  value_type: "categorical" | "list_strings";
  unique_values: string[];
}

type Summary = SummaryContinuous | SummaryCategorical;

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function Comparison({
  expr,
  path,
  dispatch,
  slice_type,
  shouldShowValidation,
}: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [, forceRender] = useState<null>();
  const ref = useRef<HTMLDivElement | null>(null);
  const { metadataSlices, isLoading } = useContextBuilderContext();

  useLayoutEffect(() => forceRender(null), []);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, []);

  const op = getOperator(expr);
  const [left, right] = expr[op];
  const leftPath = [...path, op, 0];
  const rightPath = [...path, op, 1];
  const slice_id = isPartialSliceId(left?.var) ? null : left?.var;

  let RhsComponent = isListOperator(op) ? List : Constant;
  let options = null;

  if (summary?.value_type === "continuous") {
    RhsComponent = NumberExpr;

    options = {
      min: summary.min,
      max: summary.max,
    };
  } else {
    options = summary?.unique_values.map((value: string) => ({
      value,
      label: value,
    }));
  }

  const handleChangeDataSelect = useCallback(
    (option: { value: string } | null) => {
      const selectedSlice = option!.value;
      const valueType = getValueType(metadataSlices, selectedSlice);
      const operator = valueType === "list_strings" ? "has_any" : "==";
      const operands = [{ var: selectedSlice }, null];
      const nextValue = { [operator]: operands };

      dispatch({
        type: "update-value",
        payload: {
          path,
          value: nextValue,
        },
      });
    },
    [dispatch, path, metadataSlices]
  );

  useEffect(() => {
    let mounted = true;

    if (slice_id) {
      (async () => {
        setSummary(null);

        try {
          if (slice_id === "slice_label") {
            const data = await fetchSliceLabels(slice_type);
            const labels = data.labels.sort(collator.compare);
            setSummary({
              value_type: "categorical",
              unique_values: labels,
            });
          } else {
            const fetchedOptions = await fetchUniqueValuesOrRange(slice_id);
            if (mounted) {
              setSummary(fetchedOptions);
            }
          }
        } catch (e) {
          window.console.error(e);
        }
      })();
    } else {
      setSummary(null);
    }

    return () => {
      mounted = false;
    };
  }, [slice_type, slice_id]);

  useEffect(() => {
    if (summary && summary.value_type === "continuous") {
      const [lhs, rhs] = get_values(expr);

      if (op === ">" && rhs === null) {
        dispatch({
          type: "update-value",
          payload: {
            path,
            value: { ">": [lhs, floor(summary.min)] },
          },
        });
      }
    }
  }, [summary, expr, op, dispatch, path]);

  return (
    <div ref={ref} style={{ scrollMargin: 22 }}>
      <Variable
        value={left?.var || null}
        path={leftPath}
        dispatch={dispatch}
        onChangeDataSelect={handleChangeDataSelect}
        slice_type={slice_type}
        shouldShowValidation={shouldShowValidation}
      />
      <Operator
        expr={expr}
        path={path}
        op={op}
        dispatch={dispatch}
        value_type={getValueType(metadataSlices, slice_id)}
        isLoading={isLoading || (slice_id && !summary)}
      />
      <RhsComponent
        key={slice_id}
        expr={right}
        path={rightPath}
        dispatch={dispatch}
        options={options}
        shouldShowValidation={shouldShowValidation}
      />
    </div>
  );
}

export default Comparison;
