import React, { ClipboardEventHandler, useCallback, useRef } from "react";
import cx from "classnames";
import Select, { Props as ReactSelectProps } from "react-select";
import { getConfirmation } from "@depmap/common-components";
import OptimizedSelectOption from "../OptimizedSelectOption";
import { ContextBuilderReducerAction } from "./contextBuilderReducer";
import styles from "../../styles/ContextBuilder.scss";

interface Props {
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  expr: string[] | null;
  options: { label: string; value: string }[] | undefined;
  path: (string | number)[];
  shouldShowValidation: boolean;
}

declare global {
  interface Window {
    clipboardData: DataTransfer;
  }
}

const selectStyles: ReactSelectProps["styles"] = {
  control: (base) => ({
    ...base,
    fontSize: 13,
  }),
  menu: (base) => ({
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
  options: { label: string }[] | undefined
) {
  if (!options) {
    return [];
  }

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

function List({ expr, path, dispatch, options, shouldShowValidation }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleCopy: ClipboardEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (expr) {
        e.clipboardData.setData("text/plain", expr.join("\r\n"));
      }

      e.preventDefault();
    },
    [expr]
  );

  const handlePaste: ClipboardEventHandler<HTMLDivElement> = useCallback(
    async (e) => {
      const pastedText = (e.clipboardData || window.clipboardData).getData(
        "text"
      );

      e.preventDefault();
      e.currentTarget?.blur();

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
      <Select
        isMulti
        isClearable={false}
        className={cx(styles.listSelect, {
          [styles.invalidSelect]: shouldShowValidation && !expr,
        })}
        styles={selectStyles}
        value={
          expr ? expr.map((value: string) => ({ value, label: value })) : null
        }
        onChange={(val) => {
          const selections = (val as unknown) as { value: string }[];

          const nextValue =
            selections?.length > 0
              ? selections.map(({ value }) => value)
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
