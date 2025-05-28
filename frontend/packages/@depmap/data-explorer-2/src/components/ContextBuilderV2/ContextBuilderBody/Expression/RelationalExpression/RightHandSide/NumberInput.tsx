import React, { useCallback, useEffect, useState } from "react";
import cx from "classnames";
import debounce from "lodash.debounce";
import { FormControl } from "react-bootstrap";
import { ceil, floor } from "../../../../utils/expressionUtils";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import styles from "../../../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: number | null;
  path: (string | number)[];
  domain: { min: number; max: number } | null;
  isLoading: boolean;
}

function NumberInput({ expr, path, domain, isLoading }: Props) {
  const [value, setValue] = useState<number | null>(expr);
  const { dispatch, shouldShowValidation } = useContextBuilderState();

  useEffect(() => setValue(expr), [expr]);

  const min = domain ? domain.min : -Infinity;
  const max = domain ? domain.max : Infinity;
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
    <div className={styles.NumberInput}>
      <label htmlFor={`number-input-${path}`}>Value</label>
      <FormControl
        className={cx({
          [styles.invalidNumber]:
            // FIXME: This will show that the number is out of range but the
            // user can still save the context that way. We should add some
            // more validation logic on the save handler.
            (value !== null && value < floor(min)) ||
            (value !== null && value > ceil(max)) ||
            (value === null && shouldShowValidation),
        })}
        disabled={isLoading || !domain}
        componentClass="input"
        name={`number-input-${path}`}
        type="number"
        step={step}
        min={floor(min)}
        max={ceil(max)}
        value={value === null ? "" : value}
        onChange={(e) => {
          const {
            valueAsNumber,
          } = ((e as unknown) as React.ChangeEvent<HTMLInputElement>).target;

          const nextValue = Number.isNaN(valueAsNumber)
            ? null
            : Math.round(valueAsNumber * 10 ** 5) / 10 ** 5;
          setValue(nextValue);
          throttledDispatch(nextValue);
        }}
        placeholder="Input a number…"
        autoComplete="off"
      />
    </div>
  );
}

export default NumberInput;
