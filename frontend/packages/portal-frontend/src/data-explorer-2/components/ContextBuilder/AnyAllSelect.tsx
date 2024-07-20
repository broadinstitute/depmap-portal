import React from "react";
import Select from "react-windowed-select";
import styles from "src/data-explorer-2/styles/ContextBuilder.scss";

const selectStyles = {
  control: (base: any) => ({
    ...base,
    fontSize: 13,
    width: 78,
  }),
  menu: (base: any) => ({
    ...base,
    fontSize: 12,
    minWidth: "100%",
    width: "max-content",
  }),
};

const toOptions = (labels: string[]) =>
  Object.entries(labels).map(([value, label]) => ({
    value,
    label,
  }));

function AnyAllSelect({ path, value, dispatch }: any) {
  const labels = { and: "all", or: "any" } as any;

  if (!value) {
    return <div className={styles.AnyAllSelect} />;
  }

  return (
    <div className={styles.AnyAllSelect}>
      <div style={{ display: "inline-block", marginRight: 8 }}>
        <Select
          disabled={!value}
          styles={selectStyles}
          value={{ value, label: labels[value] }}
          options={toOptions(labels)}
          onChange={(option: any) =>
            dispatch({
              type: "update-bool-op",
              payload: {
                path,
                value: option.value,
              },
            })
          }
          placeholder="Select…"
          menuPortalTarget={document.querySelector("#modal-container")}
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
