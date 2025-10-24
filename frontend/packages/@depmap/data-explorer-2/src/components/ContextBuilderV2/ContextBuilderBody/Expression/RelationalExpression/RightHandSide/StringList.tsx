import React, {
  ClipboardEventHandler,
  useCallback,
  useMemo,
  useRef,
} from "react";
import cx from "classnames";
import ReactSelect from "react-select";
import WindowedSelect from "react-windowed-select";
import type { Props as ReactSelectProps } from "react-select";
import { getConfirmation } from "@depmap/common-components";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import { scrollParentIntoView } from "../../../../utils/domUtils";
import OptimizedSelectOption from "../../../../../OptimizedSelectOption";
import styles from "../../../../../../styles/ContextBuilderV2.scss";

const Select = (WindowedSelect as unknown) as typeof ReactSelect;

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

function StringList({ expr, path, domain, isLoading }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { dispatch, shouldShowValidation } = useContextBuilderState();

  const options = useMemo(
    () =>
      domain
        ? domain.unique_values?.map((value) => ({ value, label: value }))
        : [],
    [domain]
  );

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
      className={styles.ListSelect}
      ref={ref}
      onCopy={handleCopy}
      onPaste={handlePaste}
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
          Array.isArray(expr)
            ? expr.map((value: string) => ({ value, label: value }))
            : null
        }
        onChange={(val) => {
          const selections = (val as unknown) as { value: string }[] | null;

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
