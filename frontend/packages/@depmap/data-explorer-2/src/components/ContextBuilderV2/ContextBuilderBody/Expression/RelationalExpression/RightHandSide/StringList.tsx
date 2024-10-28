import React, { useRef } from "react";
import cx from "classnames";
import Select, { Props as ReactSelectProps } from "react-select";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import { scrollParentIntoView } from "../../../../utils/domUtils";
import OptimizedSelectOption from "../../../../../OptimizedSelectOption";
import styles from "../../../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: string[] | null;
  path: (string | number)[];
  domain: { unique_values: string[] } | null;
  isLoading: boolean;
}

const selectStyles: ReactSelectProps["styles"] = {
  control: (base) => ({
    ...base,
    fontSize: 12,
  }),
  menu: (base) => ({
    ...base,
    fontSize: 12,
    minWidth: "100%",
    width: 250,
  }),
};

function StringList({ expr, path, domain, isLoading }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { dispatch, shouldShowValidation } = useContextBuilderState();

  const options = domain
    ? domain.unique_values.map((value) => ({ value, label: value }))
    : [];

  // TODO: Implement copy/paste
  return (
    <div
      className={styles.ListSelect}
      ref={ref}
      // onCopy={handleCopy}
      // onPaste={handlePaste}
    >
      <Select
        isMulti
        isClearable={false}
        isLoading={isLoading}
        className={cx({
          [styles.invalidSelect]:
            shouldShowValidation && (!expr || expr?.length === 0),
        })}
        styles={selectStyles}
        value={
          expr ? expr.map((value: string) => ({ value, label: value })) : null
        }
        onChange={(val) => {
          const selections = val as { value: string }[] | null;

          const nextValue =
            selections && selections.length > 0
              ? selections.map(({ value }) => value)
              : null;

          dispatch({
            type: "update-value",
            payload: {
              path,
              value: nextValue,
            },
          });

          scrollParentIntoView(ref.current);
        }}
        options={options}
        isDisabled={!options}
        placeholder="Select values…"
        menuPortalTarget={
          document.querySelector("#modal-container") as HTMLElement
        }
        components={{ Option: OptimizedSelectOption }}
      />
    </div>
  );
}

export default StringList;
