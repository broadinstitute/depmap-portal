import React, { useCallback, useState } from "react";
import cx from "classnames";
import debounce from "lodash.debounce";
import { FormControl } from "react-bootstrap";
import { floor, ceil } from "./contextBuilderUtils";
import { ContextBuilderReducerAction } from "./contextBuilderReducer";
import styles from "../../styles/ContextBuilder.scss";

interface Props {
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  expr: number | null;
  options: { min: number; max: number };
  path: (string | number)[];
  shouldShowValidation: boolean;
}

function NumberExpr({
  expr,
  path,
  options,
  dispatch,
  shouldShowValidation,
}: Props) {
  const [value, setValue] = useState<number | null>(
    expr === null ? floor(options.min) : expr
  );

  const { min, max } = options;
  const step = ceil(max - min) / 100;
  const pathAsString = JSON.stringify(path);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledDispatch = useCallback(
    debounce((nextValue: number | null) => {
      dispatch({
        type: "update-value",
        payload: {
          path: JSON.parse(pathAsString),
          value: nextValue,
        },
      });
    }, 500),
    [pathAsString]
  );

  return (
    <span>
      <FormControl
        className={cx(styles.numberInput, {
          [styles.invalidNumberInput]: shouldShowValidation && value === null,
        })}
        componentClass="input"
        name="number-expression"
        type="number"
        step={step}
        min={floor(min)}
        max={ceil(max)}
        value={value ?? ""}
        onChange={(e) => {
          const {
            valueAsNumber,
          } = ((e as unknown) as React.ChangeEvent<HTMLInputElement>).target;

          const nextValue = Number.isNaN(valueAsNumber) ? null : valueAsNumber;
          setValue(nextValue);
          throttledDispatch(nextValue);
        }}
        placeholder="Input a number…"
        autoComplete="off"
      />
    </span>
  );
}

export default NumberExpr;
