import React from "react";
import Select, { Props as ReactSelectProps } from "react-select";
import { ContextBuilderReducerAction } from "./contextBuilderReducer";
import styles from "../../styles/ContextBuilder.scss";

interface Props {
  path: (string | number)[];
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  value: "and" | "or";
}

const selectStyles: ReactSelectProps["styles"] = {
  control: (base) => ({
    ...base,
    fontSize: 13,
    width: 78,
  }),
  menu: (base) => ({
    ...base,
    fontSize: 12,
    minWidth: "100%",
    width: "max-content",
  }),
};

const options = [
  {
    label: "all",
    value: "and",
  },
  {
    label: "any",
    value: "or",
  },
];

function AnyAllSelect({ path, value, dispatch }: Props) {
  if (!value) {
    return <div className={styles.AnyAllSelect} />;
  }

  const label = options.find((option) => option.value === value)!.label;

  return (
    <div className={styles.AnyAllSelect}>
      <div style={{ display: "inline-block", marginRight: 8 }}>
        <Select
          disabled={!value}
          styles={selectStyles}
          value={{ value, label }}
          options={options}
          onChange={(option) =>
            dispatch({
              type: "update-bool-op",
              payload: {
                path,
                value: option!.value as "and" | "or",
              },
            })
          }
          placeholder="Select…"
          menuPortalTarget={
            document.querySelector("#modal-container") as HTMLElement
          }
        />
      </div>
      {value === "and" ? (
        <span>
          of the following {path.length > 0 ? "sub-conditions " : "conditions "}
          <b>must</b> be met:
        </span>
      ) : (
        <span>
          of the following {path.length > 0 ? "sub-conditions " : "conditions "}
          <i>can</i> be met:
        </span>
      )}
    </div>
  );
}
export default AnyAllSelect;
