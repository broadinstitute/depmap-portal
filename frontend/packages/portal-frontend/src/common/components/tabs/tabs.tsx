/* eslint react/jsx-props-no-spreading: "off" */
/* eslint react/require-default-props: "off" */
/* eslint react/prop-types: "off" */
import React from "react";
import cx from "classnames";
import { createDescendantContext } from "@chakra-ui/descendant";
import {
  determineLazyBehavior,
  getValidChildren,
  normalizeEventKey,
  useUniquePrefix,
} from "./utils";
import styles from "./styles.scss";

interface TabsPropsBasic {
  /**
   * An optional id that will be set on the underlying <div> element.
   */
  id?: string;
  /**
   * Performance 🚀:
   * If `true`, rendering of the tab panel's will be deferred until it is selected.
   *
   * @default false
   */
  isLazy?: boolean;
  /**
   * If `true`, the tabs will be manually activated and
   * display its panel by pressing Space or Enter.
   *
   * If `false`, the tabs will be automatically activated
   * and their panel is displayed when they receive focus.
   *
   * @default false
   */
  isManual?: boolean;
  /**
   * Performance 🚀:
   * The lazy behavior of tab panels' content when not active.
   * Only works when `isLazy={true}`
   *
   * - "unmount": The content of inactive tab panels are always unmounted.
   * - "keepMounted": The content of inactive tab panels is initially unmounted,
   * but stays mounted when selected.
   *
   * @default "unmount"
   */
  lazyBehavior?: "unmount" | "keepMounted";
  /**
   * The orientation of the tab list.
   * @default "horizontal"
   */
  orientation?: "vertical" | "horizontal";
  /**
   * You can render any elements within `Tabs` but it expects `TabList` and
   * `TabPanels` to appear somewhere as children. The order doesn't matter, you
   * can have `TabList` at the top, at the bottom, or both.
   */
  children: React.ReactNode;
}

interface TabPropsControlled extends TabsPropsBasic {
  /**
   * The index of the selected tab in controlled mode. Required in controlled
   * mode.
   */
  index: number;
  /**
   * Callback when the index changes. Required in controlled mode.
   */
  onChange: (index: number) => void;
  /**
   * (Not allowed in controlled mode)
   */
  defaultIndex?: never;
}

interface TabPropsUncontrolled extends TabsPropsBasic {
  /**
   * The initial index of the selected tab in uncontrolled mode.
   *
   * @default 0
   */
  defaultIndex?: number;
  /**
   * Callback when the index changes. Optional in uncontrolled mode.
   */
  onChange?: (index: number) => void;
  /**
   * (Not allowed in uncontrolled mode)
   */
  index?: never;
}

type DivProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>;

type ButtonProps = React.DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>;

export type TabsProps = (TabPropsControlled | TabPropsUncontrolled) &
  Omit<DivProps, "onChange">;

const focus = (element: HTMLElement) => element.focus({ preventScroll: true });

const [
  TabsDescendantsProvider,
  useTabsDescendantsContext,
  useTabsDescendants,
  useTabsDescendant,
] = createDescendantContext<HTMLButtonElement>();

// eslint-disable-next-line no-spaced-func
const TabsContext = React.createContext<{
  id: string;
  selectedIndex: number;
  focusedIndex: number;
  onChange: (index: number) => void;
  setFocusedIndex: (index: number) => void;
  isManual?: boolean;
  isLazy?: boolean;
  lazyBehavior?: "unmount" | "keepMounted";
}>({
  id: "",
  selectedIndex: 0,
  focusedIndex: 0,
  onChange: () => {},
  setFocusedIndex: () => {},
  isManual: false,
  isLazy: false,
  lazyBehavior: "unmount",
});

export const Tabs = (props: TabsProps) => {
  const {
    id,
    index,
    isLazy,
    isManual,
    onChange,
    className,
    defaultIndex,
    lazyBehavior,
    orientation,
    children,
    ...divProps
  } = props;

  const generatedId = useUniquePrefix("tabs");
  const [selectedIndex, setSelectedIndex] = React.useState(defaultIndex ?? 0);

  const handleChange = (nextIndex: number) => {
    setSelectedIndex(nextIndex);
    onChange?.(nextIndex);
  };

  const [focusedIndex, setFocusedIndex] = React.useState(defaultIndex ?? 0);

  React.useEffect(() => {
    if (index != null) {
      setFocusedIndex(index);
    }
  }, [index]);

  const descendants = useTabsDescendants();

  return (
    <TabsDescendantsProvider value={descendants}>
      <TabsContext.Provider
        value={{
          id: id || generatedId,
          selectedIndex: index ?? selectedIndex,
          focusedIndex,
          setFocusedIndex,
          onChange: handleChange,
          isManual: isManual || false,
          isLazy: isLazy || false,
          lazyBehavior: lazyBehavior || "unmount",
        }}
      >
        <div
          id={id}
          {...divProps}
          className={cx(
            styles.Tabs,
            {
              [styles.horizontal]: orientation === "horizontal",
              [styles.vertical]: orientation === "vertical",
            },
            className
          )}
        >
          {children}
        </div>
      </TabsContext.Provider>
    </TabsDescendantsProvider>
  );
};

// TabList should only have Tab elements as children
export const TabList = (props: DivProps) => {
  const { onKeyDown, children, ...divProps } = props;
  const { focusedIndex } = React.useContext(TabsContext);
  const descendants = useTabsDescendantsContext();

  const handleKeyDown = React.useCallback(
    (event: any) => {
      const nextTab = () => {
        const next = descendants.nextEnabled(focusedIndex);
        if (next) focus(next.node);
      };
      const prevTab = () => {
        const prev = descendants.prevEnabled(focusedIndex);
        if (prev) focus(prev.node);
      };
      const firstTab = () => {
        const first = descendants.firstEnabled();
        if (first) focus(first.node);
      };
      const lastTab = () => {
        const last = descendants.lastEnabled();
        if (last) focus(last.node);
      };

      const eventKey = normalizeEventKey(event);

      const keyMap: Record<string, () => void> = {
        ArrowLeft: () => prevTab(),
        ArrowRight: () => nextTab(),
        ArrowUp: () => prevTab(),
        ArrowDown: () => nextTab(),
        Home: firstTab,
        End: lastTab,
      };

      const action = keyMap[eventKey];

      if (action) {
        event.preventDefault();
        action();
      }

      if (onKeyDown) {
        onKeyDown(event);
      }
    },
    [descendants, focusedIndex, onKeyDown]
  );

  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
      {...divProps}
      className={cx(styles.TabList, divProps.className)}
    >
      {children}
    </div>
  );
};

export const Tab = (props: ButtonProps) => {
  const {
    className,
    disabled,
    onClick,
    onFocus,
    children,
    id, // unusued but we want to exclude this from `buttonProps`
    ...buttonProps
  } = props;

  const tabs = React.useContext(TabsContext);
  const { index, register } = useTabsDescendant({ disabled });

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (index !== tabs.selectedIndex) {
        tabs.onChange(index);

        if (onClick) {
          onClick(e);
        }
      }
    },
    [index, onClick, tabs]
  );

  const handleFocus = React.useCallback(
    (e: React.FocusEvent<HTMLButtonElement>) => {
      tabs.setFocusedIndex(index);

      const shouldSelect = !tabs.isManual && !disabled;

      if (shouldSelect) {
        tabs.onChange(index);
      }

      if (onFocus) {
        onFocus(e);
      }
    },
    [disabled, index, onFocus, tabs]
  );

  return (
    <button
      role="tab"
      type="button"
      ref={register}
      disabled={disabled}
      onClick={handleClick}
      onFocus={handleFocus}
      id={`${tabs.id}--tab-${index}`}
      className={cx(styles.Tab, className)}
      tabIndex={index === tabs.selectedIndex ? 0 : -1}
      aria-selected={index === tabs.selectedIndex}
      aria-controls={`${tabs.id}--tabpanel-${index}`}
      {...buttonProps}
    >
      {children}
    </button>
  );
};

// TabPanels should only have TabPanel elements as children
export const TabPanels = ({ className, children, ...divProps }: DivProps) => {
  const tabs = React.useContext(TabsContext);

  const enhancedChildren = getValidChildren(children).map((child, index) =>
    React.cloneElement(child, {
      isSelected: index === tabs.selectedIndex,
      id: `${tabs.id}--tabpanel-${index}`,
      "aria-labelledby": `${tabs.id}--tab-${index}`,
    })
  );

  return (
    <div className={cx(styles.TabPanels, className)} {...divProps}>
      {enhancedChildren}
    </div>
  );
};

export const TabPanel = React.forwardRef(
  (props: DivProps, ref: React.Ref<HTMLDivElement>) => {
    const {
      id,
      isSelected,
      className,
      children,
      ...divProps
    } = props as DivProps & {
      id: number;
      isSelected: boolean;
    };

    const hasBeenSelected = React.useRef(false);
    if (isSelected) {
      hasBeenSelected.current = true;
    }

    const { isLazy, lazyBehavior } = React.useContext(TabsContext);

    const shouldRenderChildren = determineLazyBehavior({
      hasBeenSelected: hasBeenSelected.current,
      isSelected,
      isLazy,
      lazyBehavior,
    });

    return (
      <div
        id={id}
        ref={ref}
        role="tabpanel"
        hidden={!isSelected}
        className={cx(styles.TabPanel, className)}
        {...divProps}
      >
        {shouldRenderChildren ? children : null}
      </div>
    );
  }
);
