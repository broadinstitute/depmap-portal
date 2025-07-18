import React from "react";
import { ToggleSwitch } from "@depmap/common-components";
import { useContextBuilderState } from "../../state/ContextBuilderState";
import styles from "../../../../styles/ContextBuilderV2.scss";

interface Props {
  path: (string | number)[];
  value: "and" | "or";
}

type ToggleOption = { label: string; value: "and" | "or" };

const toggleOptions = [
  { label: "all", value: "and" },
  { label: "any", value: "or" },
] as [ToggleOption, ToggleOption];

function AnyAllToggle({ path, value }: Props) {
  const { dispatch } = useContextBuilderState();

  return (
    <div className={styles.AnyAllToggle}>
      <div style={{ display: "inline-block", marginRight: 4 }}>
        <ToggleSwitch
          value={value}
          onChange={(nextValue) =>
            dispatch({
              type: "update-bool-op",
              payload: { path, value: nextValue },
            })
          }
          options={toggleOptions}
        />
      </div>
      {value === "and" ? (
        <span>
          of the following {path.length > 0 ? "grouped rules " : "rules "}
          <b>must</b> match:
        </span>
      ) : (
        <span>
          of the following {path.length > 0 ? "grouped rules " : "rules "}
          <i>may</i> match:
        </span>
      )}
    </div>
  );
}
export default AnyAllToggle;
