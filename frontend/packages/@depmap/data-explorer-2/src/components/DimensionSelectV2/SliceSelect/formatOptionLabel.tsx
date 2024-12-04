import React from "react";
import { Highlighter, Tooltip, WordBreaker } from "@depmap/common-components";
import { tokenize } from "./utils";
import styles from "../../../styles/DimensionSelect.scss";

interface Option {
  value: string;
  label: string;
  nonLabelProperties: {
    property: string;
    values: string[];
  }[];
  isDisabled: boolean;
  disabledReason: string;
}

function formatOptionLabel(
  option: { label: string },
  { context, inputValue }: { context: "menu" | "value"; inputValue: string }
) {
  if (context === "value") {
    return option.label;
  }

  const nonLabelProperties = (option as Option).nonLabelProperties;
  const disabledReason = (option as Option).disabledReason;

  const MaybeTooltip = ({ children }: { children: React.ReactNode }) => {
    if (!disabledReason) {
      return <div>{children}</div>;
    }

    return (
      <Tooltip
        id={`disabled-option-${option.label}`}
        className={styles.unblockable}
        content={<WordBreaker text={disabledReason} />}
        placement="top"
      >
        <span className={styles.disabledOption}>{children}</span>
      </Tooltip>
    );
  };

  const tokens = tokenize(inputValue);

  return (
    <div>
      <MaybeTooltip>
        <div
          style={{
            fontWeight: nonLabelProperties?.length ? "bold" : "normal",
          }}
        >
          <Highlighter
            text={option.label}
            style={{ color: disabledReason ? "inherit" : "black" }}
            termToHiglight={tokens}
            matchPartialTerms
          />
        </div>
      </MaybeTooltip>
      {nonLabelProperties?.map((match, i) => {
        return (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i}>
            <MaybeTooltip>
              {match.property.replace(/^(.)/, (c: string) => c.toUpperCase())}:{" "}
              <Highlighter
                text={match.values.join(", ")}
                termToHiglight={tokens}
                matchPartialTerms
                style={{ color: disabledReason ? "inherit" : "black" }}
              />
            </MaybeTooltip>
          </div>
        );
      })}
    </div>
  );
}

export default formatOptionLabel;
