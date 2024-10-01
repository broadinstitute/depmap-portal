import React from "react";
import ReactSelect from "react-select";
import { Expr, isListOperator, opLabels } from "./contextBuilderUtils";
import { ContextBuilderReducerAction } from "./contextBuilderReducer";
import styles from "../../styles/ContextBuilder.scss";

type OperatorType = keyof typeof opLabels;
type ValueType = "continuous" | "categorical" | "list_strings" | null;

const toOperatorLabel = (value_type: ValueType, op: OperatorType) => {
  if (value_type === "continuous" && op === "==") {
    return "=";
  }

  return opLabels[op];
};

const toOperatorOptions = (
  value_type: ValueType,
  operators: OperatorType[]
) => {
  return operators.map((op) => {
    return {
      value: op,
      label: toOperatorLabel(value_type, op),
    };
  });
};

type Props = {
  expr: Expr;
  path: (string | number)[];
  op: OperatorType;
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  value_type: ValueType;
  isLoading: boolean;
};

const getNextValue = (expr: Expr, op: OperatorType, nextOp: OperatorType) => {
  const [lhs, rhs] = (expr as Record<OperatorType, Expr[]>)[op];
  let nextValue = [lhs, rhs];

  if (isListOperator(op)) {
    const firstElement = Array.isArray(rhs) && rhs.length > 0 ? rhs[0] : null;
    nextValue = [lhs, firstElement];
  }

  if (isListOperator(nextOp)) {
    let nextRhs = rhs || null;

    if (rhs && !Array.isArray(rhs)) {
      nextRhs = [rhs];
    }

    nextValue = [lhs, nextRhs];
  }

  return {
    [nextOp]: nextValue,
  };
};

function Operator({ expr, op, path, dispatch, value_type, isLoading }: Props) {
  let options: OperatorType[] = [];

  if (value_type === "continuous") {
    options = [">", "<", ">=", "<="];
  }

  if (value_type === "categorical") {
    options = ["==", "!=", "in", "!in"];
  }

  if (value_type === "list_strings") {
    options = ["has_any", "!has_any"];
  }

  const label = toOperatorLabel(value_type, op);

  return (
    <ReactSelect
      className={styles.opSelect}
      styles={{
        control: (base: React.CSSProperties) => ({
          ...base,
          minWidth: label.length < 9 ? 100 : 124,
        }),
      }}
      isLoading={isLoading}
      isDisabled={!isLoading && !value_type}
      value={value_type && !isLoading ? { value: op, label } : null}
      options={value_type ? toOperatorOptions(value_type, options) : []}
      onChange={(option) => {
        dispatch({
          type: "update-value",
          payload: {
            path,
            value: getNextValue(
              expr,
              op,
              (option as { value: OperatorType }).value
            ),
          },
        });
      }}
      menuPortalTarget={
        document.querySelector("#modal-container") as HTMLElement
      }
      placeholder=""
    />
  );
}

export default Operator;
