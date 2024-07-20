import React, { useCallback, useState } from "react";
import cx from "classnames";
import debounce from "lodash.debounce";
import { FormControl } from "react-bootstrap";
import {
  floor,
  ceil,
  round,
} from "src/data-explorer-2/components/ContextBuilder/contextBuilderUtils";
import styles from "src/data-explorer-2/styles/ContextBuilder.scss";

function NumberExpr({
  expr,
  path,
  options,
  dispatch,
  shouldShowValidation,
}: any) {
  const [value, setValue] = useState(expr || floor(options.min));

  const { min, max } = options;
  const step = round((max - min) / 100);
  const pathAsString = JSON.stringify(path);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledDispatch = useCallback(
    debounce((nextValue: number) => {
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
        onChange={(e: any) => {
          const nextValue = Number.isNaN(e.target.valueAsNumber)
            ? null
            : e.target.valueAsNumber;
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
