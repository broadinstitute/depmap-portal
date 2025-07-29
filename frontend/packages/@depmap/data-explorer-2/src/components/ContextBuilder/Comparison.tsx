import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { get_values } from "json-logic-js";
import { deprecatedDataExplorerAPI } from "../../services/deprecatedDataExplorerAPI";
import { isPartialSliceId } from "../../utils/misc";
import {
  Expr,
  floor,
  getOperator,
  getValueType,
  isListOperator,
  isVar,
  OperatorType,
} from "./contextBuilderUtils";
import { ContextBuilderReducerAction } from "./contextBuilderReducer";
import { useContextBuilderContext } from "./ContextBuilderContext";
import Operator from "./Operator";
import Variable from "./Variable";
import Constant from "./Constant";
import List from "./List";
import NumberExpr from "./NumberExpr";
import styles from "../../styles/ContextBuilder.scss";

const LEFT_INDEX = 0;
const RIGHT_INDEX = 1;

interface Props {
  expr: Record<OperatorType, Expr>;
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
  value_type: "categorical" | "list_strings" | "binary";
  unique_values: string[];
}

type Summary = SummaryContinuous | SummaryCategorical;

interface RhsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expr: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any;
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  path: (string | number)[];
  shouldShowValidation: boolean;
}

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
  const { datasets, metadataSlices, isLoading } = useContextBuilderContext();
  const [error, setError] = useState<string | null>(null);

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
  const [left, right] = expr[op] as [Expr, string | string[] | number | null];
  const leftPath = [...path, op, LEFT_INDEX];
  const rightPath = [...path, op, RIGHT_INDEX];
  let slice_id = !isVar(left) || isPartialSliceId(left.var) ? null : left.var;

  if (datasets && slice_id) {
    const encodedId = slice_id.split("/")[1];
    const id = decodeURIComponent(encodedId);

    datasets.forEach((d) => {
      if (id === d.id && d.given_id !== null) {
        // Prefer to use `given_id` over datasets regular ID
        slice_id = slice_id!.replace(encodedId, d.given_id);
      }
    });
  }

  const value_type = getValueType(
    metadataSlices,
    isVar(left) ? left.var : null
  );

  let RhsComponent: React.FC<RhsProps> = isListOperator(op) ? List : Constant;
  let options: object | object[] | undefined;

  if (summary?.value_type === "continuous") {
    RhsComponent = NumberExpr;

    options = {
      min: summary.min,
      max: summary.max,
    };
  } else if (summary?.value_type === "binary" && isVar(left)) {
    const dataset_id = (slice_id || left.var).split("/")[1];
    // For binary datasets, we hide the fact that values are stored as 0 and 1
    // and instead present the user with a set of features to choose from. When
    // a feature is selected, the RHS of the expression is automatically set to
    // 1.
    options = summary.unique_values.map((label: string) => ({
      value: `slice/${dataset_id}/${encodeURIComponent(label)}/label`,
      label,
    }));
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
    if (value_type === "binary" && isVar(left)) {
      (async () => {
        const dataset_id = left.var.split("/")[1];

        try {
          const data = await deprecatedDataExplorerAPI.fetchDimensionLabelsOfDataset(
            null,
            dataset_id
          );
          setSummary({
            value_type: "binary",
            unique_values: data.labels,
          });
        } catch (e) {
          setError(`Invalid dataset_id "${dataset_id}".`);
          window.console.error(e);
        }
      })();
    } else if (slice_id) {
      (async () => {
        setSummary(null);

        try {
          if (slice_id === "entity_label") {
            const data = await deprecatedDataExplorerAPI.fetchDimensionLabels(
              slice_type
            );
            const labels = data.labels.sort(collator.compare);
            setSummary({
              value_type: "categorical",
              unique_values: labels,
            });
          } else {
            const fetchedOptions = await deprecatedDataExplorerAPI.fetchUniqueValuesOrRange(
              slice_id
            );
            setSummary(fetchedOptions);
          }
        } catch (e) {
          setError((e as { error: { message: string } }).error.message);
          window.console.error(e);
        }
      })();
    } else {
      setSummary(null);
    }
  }, [slice_type, slice_id, left, value_type]);

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

  // If a specific binary slice has been selected, initialize the RHS to a
  // value of 1. The logic behind this is pretty convoluted but I'll try to
  // explain. One-hot encoded slices are typically used to visualize an
  // ingroup/outgroup relationship. Forcing the user to say "SOME_FEATURE == 1"
  // is awkward. Instead we show the list of features, have the user select
  // one, and then automatically set the value to 1 behind the scenes. The
  // features can thus be thought of a set of pseudo-categories.
  useEffect(() => {
    if (value_type === "binary" && slice_id && right === null) {
      dispatch({
        type: "update-value",
        payload: { path: [...path, op, RIGHT_INDEX], value: 1 },
      });
    }
  }, [dispatch, slice_id, op, right, path, value_type]);

  let rhsExpr = right;
  let rhsPath = rightPath;

  if (summary?.value_type === "binary") {
    rhsExpr = slice_id;
    rhsPath = [...path, op, LEFT_INDEX, "var"];
  }

  const variableValue =
    isVar(left) && isPartialSliceId(left.var) ? left.var : slice_id;

  if (error) {
    return (
      <div className={styles.ComparisonError}>
        <div>❗ Error</div>
        <div>{error}</div>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ scrollMargin: 22 }}>
      <Variable
        // HACK: This temp property fills a hole in the data model. We're
        // dependent on a slice ID (or at least part of one) to figure out what
        // "source" (annotation vs matrix dataset) the selected dataset comes
        // from. Because we first prompt the user to choose a data source, so
        // we need a placeholder to keep track of that selection.
        placeholderDataSource={(left as any)?.placeholderDataSource}
        value={variableValue}
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
        value_type={summary?.value_type || null}
        isLoading={isLoading || (Boolean(slice_id) && !summary)}
      />
      <RhsComponent
        expr={rhsExpr}
        path={rhsPath}
        dispatch={dispatch}
        options={options}
        shouldShowValidation={shouldShowValidation}
      />
    </div>
  );
}

export default Comparison;
