import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cx from "classnames";
import ReactSelect, { Props as ReactSelectProps } from "react-select";
import { Highlighter, Tooltip, WordBreaker } from "@depmap/common-components";
import OptimizedSelectOption from "../components/OptimizedSelectOption";
import styles from "../styles/ExtendedSelect.scss";

export interface ExtendedSelectProps {
  // Styles the component with red border and red text.
  hasError?: boolean;
  // Adds a label above the dropdown.
  label?: React.ReactNode;
  // If true the label will be to left instead of above.
  inlineLabel?: boolean;
  // How wide (in pixels) should the dropdown options list be?
  menuWidth?: number | "max-content";
  // Adds a thin colored bar to left edge of the dropdown. This is intended as
  // visual cue to the user that it's being used to control a color option.
  swatchColor?: string;
  // When enabled, allows a pre-selected value to be edited as text (simulating
  // a vanilla input element)
  isEditable?: boolean;
  // When `isEditable` is true, you can use this to populate the input with an
  // arbitrary value (distinct from the one that'a actually selected).
  editableInputValue?: string;
  // This is called when editable text is changed.
  onEditInputValue?: (editedText: string) => void;
  // Use this if you need access to the container div.
  innerRef?: React.LegacyRef<HTMLDivElement>;
}

const ConditionalTooltip = ({
  showTooltip,
  content,
  onFocus,
  children,
}: {
  showTooltip: boolean | null | undefined;
  content: React.ReactNode;
  onFocus: React.FocusEventHandler<HTMLSpanElement> | undefined;
  children: React.ReactNode;
}) => {
  if (!showTooltip) {
    return children;
  }

  return (
    <span
      onFocus={onFocus}
      onMouseOver={() => {
        const blocker = document.querySelector("#tooltip-blocker");
        if (blocker) {
          blocker.remove();
          document.body.append(blocker);
        }
      }}
    >
      <Tooltip id="extended-select-tooltip" content={content} placement="top">
        <span onFocus={onFocus}>{children}</span>
      </Tooltip>
    </span>
  );
};

// This can be used to replaced the standard <input> element. It uses a
// contentEditable <div> which has the nice property that it will flexibly in
// height as the user types.
function ContentEditableDivInput({
  innerRef,
  placeholder,
  isDisabled,

  // unused props
  clearValue,
  // eslint-disable-next-line @typescript-eslint/no-shadow
  cx,
  extraWidth,
  getValue,
  getStyles,
  isHidden,
  hasValue,
  injectStyles,
  inputClassName,
  inputStyle,
  isMulti,
  isRtl,
  minWidth,
  onAutosize,
  placeholderIsMinWidth,
  selectOption,
  selectProps,
  setValue,
  theme,

  ...inputProps
}: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any) {
  const underlineRef = useRef<HTMLDivElement>(null);
  const isEditing = useRef(false);

  const setTextUnderlines = (contentDiv: HTMLDivElement) => {
    const underlineDiv = underlineRef.current as HTMLDivElement;
    const words = contentDiv.innerText.split(/\s+/);

    if (words.length <= 1) {
      underlineDiv.innerHTML = "";
      return;
    }

    if (contentDiv.scrollHeight <= 32) {
      underlineDiv.style.paddingTop = "7px";
    } else {
      underlineDiv.style.paddingTop = "0";
    }

    underlineDiv.innerHTML = words
      .filter(Boolean)
      .map((word, index) => {
        const color = Highlighter.colors[index % Highlighter.colors.length];

        return [
          `<span style="border-bottom: 2px solid ${color};">`,
          word,
          "</span>",
        ].join("");
      })
      .join(" ");

    if (contentDiv.innerText.endsWith(" ")) {
      underlineDiv.innerHTML += "<span> </span>";
    }
  };

  return (
    <div className={styles.ContentEditableDivInput}>
      <div>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          {...inputProps}
          ref={innerRef}
          disabled={isDisabled}
          contentEditable
          onMouseDown={(e) => {
            if (isEditing.current) {
              e.stopPropagation();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === " ") {
              e.stopPropagation();

              if (
                e.currentTarget.innerText.endsWith(String.fromCharCode(160))
              ) {
                e.preventDefault();
              }
            }
          }}
          onFocus={(e) => {
            const div = e.currentTarget;
            div.style.caretColor = "transparent";

            setTimeout(() => {
              const range = document.createRange();
              range.selectNodeContents(div);
              range.collapse(false);

              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
              div.style.caretColor = "";
            });

            inputProps.onFocus(e);
            isEditing.current = true;
            setTextUnderlines(div);
          }}
          onInput={(e) => {
            const pseudoInput = e.currentTarget as HTMLInputElement;
            pseudoInput.value = e.currentTarget.textContent || "";
            inputProps.onChange(e);
            setTextUnderlines(pseudoInput);
          }}
          onBlur={(e) => {
            const pseudoInput = e.currentTarget as HTMLInputElement;

            setTimeout(() => {
              const valContainer = pseudoInput.parentElement!.parentElement!
                .parentElement as HTMLElement;
              const valContainerItem = valContainer.firstChild as HTMLElement;

              if (valContainerItem.innerHTML.length !== 0) {
                pseudoInput.value = "";
                pseudoInput.textContent = "";
              }
            });

            inputProps.onBlur(e);
            isEditing.current = false;
          }}
        />
        <div ref={underlineRef} className={styles.underlineDiv} />
        {placeholder ? <div>{placeholder}</div> : null}
      </div>
    </div>
  );
}

// Extends the behavior of a given `SelectComponent`. That component should be
// a base ReactSelect or one of its variants (creatable, animated, async, etc).
// In addition to the above options, it also:
// - Styles it with a fixed width.
// - Shows a tooltip when the value has been truncated
// - Automatically set `menuPlacement` to "top" when the dropdown is near the
// bottom of the viewport.
// - Uses a windowed menu list. This allows thousands of options to be
//   displayed performantly (powered by react-windowed-select).
export default function extendReactSelect(
  SelectComponent: Readonly<React.ComponentType>
) {
  const WrappedSelect = SelectComponent as typeof ReactSelect;

  // eslint-disable-next-line react/require-default-props
  return (props: ReactSelectProps & ExtendedSelectProps) => {
    const {
      value,
      onChange,
      isLoading,
      hasError = false,
      inlineLabel = false,
      label = null,
      menuWidth = "max-content",
      placeholder = undefined,
      swatchColor = undefined,
      isEditable = false,
      editableInputValue = undefined,
      onEditInputValue = () => {},
      innerRef = null,
    } = props;

    const dataProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => key.startsWith("data-"))
    );

    const mounted = useRef<boolean>(true);
    const ref = useRef<HTMLElement | null>(null);
    const reactSelectRef = useRef<ReactSelectProps["ref"]>(null);
    const [isTruncated, setIsTruncated] = useState(false);
    const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLElement>(
      props.menuPortalTarget || document.body
    );
    const [menuPlacement, setMenuPlacement] = useState<"top" | "bottom">(
      "bottom"
    );

    useEffect(() => {
      return () => {
        mounted.current = false;
      };
    }, []);

    useEffect(() => {
      if (!props.menuPortalTarget && ref.current?.closest("[role='dialog']")) {
        setMenuPortalTarget(
          ref.current?.closest("[role='dialog']") as HTMLElement
        );
      }
    }, [props.menuPortalTarget]);

    const calcMenuPlacement = useCallback(() => {
      if (ref.current) {
        const offsetTop = ref.current.offsetTop - ref.current.scrollTop;
        const nextMenuPlacement =
          offsetTop > window.innerHeight - 210 ? "top" : "bottom";

        if (menuPlacement !== nextMenuPlacement) {
          setMenuPlacement(nextMenuPlacement);
        }
      }
    }, [menuPlacement, setMenuPlacement]);

    useLayoutEffect(() => {
      if (ref.current) {
        const parent = ref.current.querySelector(
          "span > div > div > div"
        ) as HTMLElement;

        const el = parent.querySelector("div") as HTMLElement;
        setIsTruncated(el.clientWidth > parent.clientWidth - 9);
      } else {
        setIsTruncated(false);
      }
    }, [value, isLoading]);

    const tooltipText = value ? (value as { label: string }).label : null;

    return (
      <div ref={innerRef} className={styles.container} {...dataProps}>
        <span className={styles.ExtendedSelect} ref={ref}>
          {swatchColor && (
            <span className={styles.swatchContainer}>
              <span
                className={styles.swatch}
                style={{
                  backgroundColor: swatchColor,
                  top: label ? 22 : 0,
                }}
              />
            </span>
          )}
          {label && (
            <div
              className={cx(styles.selectorLabel, {
                [styles.inlineLabel]: inlineLabel,
              })}
            >
              <label>{label}</label>
            </div>
          )}
          <ConditionalTooltip
            showTooltip={value && isTruncated}
            content={<WordBreaker text={tooltipText} />}
            onFocus={() => {
              setTimeout(() => {
                reactSelectRef.current?.focus();
                reactSelectRef.current?.onMenuOpen?.();
                setIsTruncated(true);
              }, 0);
            }}
          >
            <WrappedSelect
              {...props}
              ref={reactSelectRef}
              placeholder={
                placeholder && (
                  <span className={styles.placeholder}>{placeholder}</span>
                )
              }
              menuPortalTarget={menuPortalTarget}
              className={cx(styles.Select, props.className, {
                [styles.selectError]: hasError,
                [styles.withSwatch]: Boolean(swatchColor),
              })}
              styles={{
                control: (base) => ({ ...base, fontSize: 12 }),
                menuPortal: (base) => ({ ...base, zIndex: 3 }),
                clearIndicator: (base) => ({ ...base, padding: 2 }),
                dropdownIndicator: (base) => ({ ...base, padding: 4 }),
                loadingIndicator: (base) => ({
                  ...base,
                  position: "absolute",
                  right: 22,
                }),
                menu: (base) => ({
                  ...base,
                  fontSize: 12,
                  minWidth: "100%",
                  width: menuWidth,
                }),
                ...props.styles,
              }}
              backspaceRemovesValue={!isEditable}
              onFocus={(e) => {
                if (isEditable && value?.label) {
                  const editableDiv = e.currentTarget;
                  editableDiv.innerText = editableInputValue || value.label;

                  const valContainerItem = editableDiv.parentElement!
                    .parentElement!.parentElement!.firstChild as HTMLElement;
                  valContainerItem.classList.add(styles.hidden);

                  if (editableInputValue) {
                    reactSelectRef.current.select.onInputChange(
                      editableInputValue
                    );
                  }
                }
              }}
              onBlur={(e) => {
                if (isEditable && value?.label) {
                  const editableDiv = e.currentTarget;
                  editableDiv.innerText = value?.label || "";

                  const valContainerItem = editableDiv.parentElement!
                    .parentElement!.parentElement!.firstChild as HTMLElement;
                  valContainerItem.classList.remove(styles.hidden);
                }
              }}
              onChange={(nextValue, action) => {
                onChange?.(nextValue, action);

                if (isEditable) {
                  const editableDiv = ref.current!.querySelector(
                    "div[contenteditable]"
                  ) as HTMLDivElement;

                  editableDiv.innerText = "";
                }

                if (nextValue === null) {
                  onEditInputValue("");
                }
              }}
              onInputChange={(inputValue, actionMeta) => {
                if (actionMeta?.action === "input-change") {
                  onEditInputValue(inputValue);
                }

                if (props.onInputChange) {
                  props.onInputChange(inputValue, actionMeta);
                }
              }}
              onMenuOpen={() => {
                if (props.onMenuOpen) {
                  props.onMenuOpen();
                }

                calcMenuPlacement();

                const div1 = document.querySelector("#tooltip-blocker");
                if (div1) {
                  div1.remove();
                }

                const div2 = document.createElement("div");
                div2.id = "tooltip-blocker";
                document.body.append(div2);
              }}
              onMenuClose={() => {
                if (props.onMenuClose) {
                  props.onMenuClose();
                }

                reactSelectRef.current?.blur();
                const div = document.querySelector("#tooltip-blocker");

                if (div) {
                  setTimeout(() => {
                    div.remove();
                  }, 0);
                }
              }}
              menuPlacement={props.menuPlacement || menuPlacement}
              components={{
                Option: OptimizedSelectOption,
                ...(isEditable ? { Input: ContentEditableDivInput } : null),
                ...props.components,
              }}
            />
          </ConditionalTooltip>
        </span>
      </div>
    );
  };
}
