import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cx from "classnames";
import ReactSelect, { Props as ReactSelectProps } from "react-select";
import { Tooltip, WordBreaker } from "@depmap/common-components";
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
    <span onFocus={onFocus}>
      <Tooltip id="extended-select-tooltip" content={content} placement="top">
        <span onFocus={onFocus}>{children}</span>
      </Tooltip>
    </span>
  );
};

// Extends the behavior of a given `SelectComponent`. That component should be
// a base ReactSelect or one of its variants (creatable, animated, async, etc).
// In addition to the above options, it also:
// - Styles it with a fixed width.
// - Shows a tooltip when the value has been truncated
// - Automatically set `menuPlacement` to "top" when the dropdown is near the
// bottom of the viewport.
// - Allows a pre-selected value to be edited as text (simulating a vanilla
//   <input> element)
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
      swatchColor = undefined,
    } = props;

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
    const [postSelectTimeoutExpired, setPST] = useState(true);
    const setPostSelectTimeoutExpired = (expired: boolean) => {
      if (mounted.current) {
        setPST(expired);
      }
    };

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

    let { placeholder } = props;

    if (typeof placeholder === "string" && placeholder.length > 25) {
      placeholder = <span style={{ fontSize: 11 }}>{placeholder}</span>;
    }

    return (
      <div className={styles.container}>
        {swatchColor && (
          <span
            className={styles.swatch}
            style={{ backgroundColor: swatchColor }}
          />
        )}
        <span className={styles.ExtendedSelect} ref={ref}>
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
            showTooltip={value && isTruncated && postSelectTimeoutExpired}
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
              placeholder={placeholder}
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
              onFocus={(e) => {
                if (!value?.label) {
                  return;
                }

                // HACK: Make it appear as if the cursor is at the end of the
                // word. This acts as a hint to the user that the value is now
                // editable (which is not the default react-select behavior).
                // This hack is needed because, on initial focus, the <input>
                // element is secretly empty! react-select has a "value
                // container" <div> that makes it appear as if the input has a
                // value. See the `onKeyDown` handler below where the new
                // behavior is implemented.
                const input = e.currentTarget as HTMLInputElement;

                const valContainer = input.parentElement!.parentElement!
                  .parentElement as HTMLElement;
                const valContainerItem = valContainer.firstChild as HTMLElement;
                const inputContainer = valContainerItem.nextSibling as HTMLElement;

                valContainer.style.display = "inline";
                valContainer.style.paddingRight = "0";
                inputContainer.style.display = "inline";

                valContainerItem.style.cssText = `
                  display: inline;
                  margin-right: -2px;
                  overflow: visible;
                  position: static;
                  transform: none;
                  white-space: normal;
                  word-break: break-all;
                `;
              }}
              onKeyDown={(e) => {
                const input = e.currentTarget.querySelector(
                  "input"
                ) as HTMLInputElement;

                // Custom behavior: instead of backspace wiping out the value
                // (setting it null) just remove the last character (as one
                // would expect a vanilla input element to behave).
                if (
                  value?.label &&
                  input.value === "" &&
                  ["Backspace", "ArrowLeft", "ArrowRight"].includes(e.key)
                ) {
                  e.preventDefault();
                  e.stopPropagation();

                  const nextInputValue =
                    e.key === "Backspace"
                      ? value.label.slice(0, -1)
                      : value.label;

                  reactSelectRef.current.select.onInputChange(nextInputValue);

                  // Long strings can overflow the input box. Try to scroll
                  // horizontally so the cursor is visible.
                  setTimeout(() => {
                    input.style.width = "95px";
                    input.scrollTo(input.scrollWidth, 0);
                  });

                  if (e.key === "ArrowLeft") {
                    const { shiftKey } = e;

                    setTimeout(() => {
                      const len = nextInputValue.length;
                      input.setSelectionRange(
                        len - 1,
                        shiftKey ? len : len - 1
                      );
                    });
                  }
                }

                // This is the only case where we actually do want to wipe out
                // the value.
                if (input.value.length === 1 && e.key === "Backspace") {
                  if (props.isClearable) {
                    reactSelectRef.current.select.onInputChange("");
                    reactSelectRef.current.select.onChange(null);
                  } else {
                    e.preventDefault();
                    e.stopPropagation();
                    reactSelectRef.current.select.onInputChange(value?.label);
                  }
                }

                if (props.onKeyDown) {
                  props.onKeyDown(e);
                }
              }}
              onChange={(nextValue, action) => {
                setPostSelectTimeoutExpired(false);
                onChange?.(nextValue, action);

                setTimeout(() => {
                  setPostSelectTimeoutExpired(true);
                }, 500);
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

                setPostSelectTimeoutExpired(false);

                reactSelectRef.current?.blur();
                const div = document.querySelector("#tooltip-blocker");

                if (div) {
                  div.remove();
                }

                setTimeout(() => {
                  setPostSelectTimeoutExpired(true);
                }, 500);
              }}
              menuPlacement={props.menuPlacement || menuPlacement}
              components={{
                Option: OptimizedSelectOption,
                ...props.components,
              }}
            />
          </ConditionalTooltip>
        </span>
      </div>
    );
  };
}
