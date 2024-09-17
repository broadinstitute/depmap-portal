import React, { useCallback, useRef } from "react";
import cx from "classnames";
import ReactSelect from "react-select";
import { getConfirmation } from "@depmap/common-components";
import OptimizedSelectOption from "../OptimizedSelectOption";
import styles from "../../styles/ContextBuilder.scss";

const selectStyles = {
  control: (base: any) => ({
    ...base,
    fontSize: 13,
  }),
  menu: (base: any) => ({
    ...base,
    fontSize: 12,
    minWidth: "100%",
    width: 250,
  }),
};

const confirmPasteUnknownTokens = (unknownTokens: string[]) => {
  return getConfirmation({
    title: "Unknown data detected",
    message: (
      <div>
        <div>No DepMap data could be found for the following values:</div>
        {unknownTokens.map((token) => (
          <div key={token}>{token}</div>
        ))}
        <br />
        <div>Are you sure you want to paste those values?</div>
      </div>
    ),
    yesText: "Yes, I know what I’m doing",
    noText: "No, discard them",
    showModalBackdrop: false,
  });
};

async function pastedTextToSliceLabels(
  pastedText: string,
  options: { label: string }[]
) {
  const text = pastedText.trim();
  let separator: string | RegExp = /\s+/;

  if (/\r?\n/.test(text)) {
    separator = /\r?\n/;
  }

  if (text.includes(",")) {
    separator = ",";
  }

  if (text.includes("\t")) {
    separator = "\t";
  }

  const setOfOptions = new Set(options.map((o) => o.label));

  const tokens = text
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);

  const filtered = tokens.filter((s) => setOfOptions.has(s));

  if (filtered.length > 50000) {
    // eslint-disable-next-line no-alert
    window.alert("Sorry, too many values.");
    return [];
  }

  if (filtered.length < tokens.length) {
    const unknownTokens = tokens.filter((s) => !setOfOptions.has(s));
    const ok = await confirmPasteUnknownTokens(unknownTokens);

    return ok ? tokens : filtered;
  }

  return filtered;
}

function List({ expr, path, dispatch, options, shouldShowValidation }: any) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleCopy = useCallback(
    (e: any) => {
      if (expr) {
        e.clipboardData.setData("text/plain", expr.join("\r\n"));
      }

      e.preventDefault();
    },
    [expr]
  );

  const handlePaste = useCallback(
    async (e: any) => {
      const pastedText = (
        e.clipboardData || (window as any).clipboardData
      ).getData("text");

      e.preventDefault();
      e.currentTarget.blur();

      const pastedLabels = await pastedTextToSliceLabels(pastedText, options);
      const uniqueLabels = new Set([...(expr || []), ...pastedLabels]);

      if (uniqueLabels.size > 0) {
        dispatch({
          type: "update-value",
          payload: {
            path,
            value: [...uniqueLabels],
          },
        });
      }
    },
    [expr, path, options, dispatch]
  );

  return (
    <div
      className={styles.listSelectContainer}
      onCopy={handleCopy}
      onPaste={handlePaste}
      ref={ref}
    >
      <ReactSelect
        isMulti
        isClearable={false}
        className={cx(styles.listSelect, {
          [styles.invalidSelect]: shouldShowValidation && !expr,
        })}
        styles={selectStyles}
        value={
          expr ? expr.map((value: string) => ({ value, label: value })) : null
        }
        onChange={(selections: any) => {
          const nextValue =
            selections?.length > 0
              ? selections.map(({ value }: any) => value)
              : null;

          dispatch({
            type: "update-value",
            payload: {
              path,
              value: nextValue,
            },
          });

          setTimeout(() => {
            if (ref.current) {
              ref.current.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              });
            }
          }, 0);
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

export default List;
