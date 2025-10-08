import React, { useCallback, useEffect, useRef, useState } from "react";
import qs from "qs";
import { Tabs, Tab, TabList, TabsProps } from "./tabs";
import { getValidChildren } from "./utils";

// TabsWithHistory extends the Tabs component. It synchronize its state with
// the browser's history via a configurable query parameter.
type TabsWithHistoryProps = {
  /**
   * The name of the query parameter that should control which tab is currently
   * selected.
   *
   * @default "tab"
   */
  queryParamName?: string;
  /**
   * An optional handler if you need custom behavior when the current tab
   * changes. This cannot be used to control the component.
   */
  onChange?: (index: number) => void;
  /**
   * An optional handler if you need custom behavior when the current tab
   * first loads its initial index. This cannot be used to control the component.
   */
  onSetInitialIndex?: (index: number) => void;
  /**
   * ID of the tab that should be initially selected when the query parameter is not present. By default, this will be
   * the first tab.
   */
  defaultId?: string;
} & Omit<TabsProps, "index" | "defaultIndex">;

// Take a ReactNode `tabsChildren`, finds all its <Tab> ancestors, and invokes
// `callback` with each tab's id and index.
function forEachTab(
  tabsChildren: React.ReactNode,
  callback: (tabId: string, tabIndex: number) => void
) {
  getValidChildren(tabsChildren).forEach((child) => {
    if (child.type === TabList) {
      getValidChildren(child.props.children)
        .filter((grandChild) => grandChild.type === Tab)
        .forEach((tab, tabIndex) => callback(tab.props.id, tabIndex));
    }
  });
}

// Finds the initial tab index based on the query string.
function getInitialTabIndex(
  tabsChildren: React.ReactNode,
  queryParamName: string,
  defaultId: string | undefined
) {
  const params = qs.parse(window.location.search.substr(1));
  const targetId = params[queryParamName] || defaultId;
  let index = 0;

  forEachTab(tabsChildren, (tabId, tabIndex) => {
    if (tabId === targetId) {
      index = tabIndex;
    }
  });

  return index;
}

// eslint-disable-next-line import/prefer-default-export
export const TabsWithHistory = ({
  children,
  queryParamName = "tab",
  onChange = () => {},
  onSetInitialIndex = undefined,
  defaultId = undefined,
  ...otherProps
}: TabsWithHistoryProps) => {
  const initialIndex = useRef<number | null>(null);

  // Initialize the tab index based on the query string.
  const [index, setIndex] = useState(() =>
    getInitialTabIndex(children, queryParamName, defaultId)
  );

  useEffect(() => {
    if (onSetInitialIndex) {
      initialIndex.current = getInitialTabIndex(
        children,
        queryParamName,
        defaultId
      );
      if (initialIndex.current) {
        onSetInitialIndex(initialIndex.current);
      }
    }
  }, [children, queryParamName, defaultId, onSetInitialIndex]);

  // We store the tab IDs (i.e. the `id` prop that each <Tab> is given) in a
  // map so that we can look them up by index.
  const tabIndexMap = useRef<Record<number, string>>({});

  // Update `tabIndexMap` based on the `children` of this component.
  useEffect(() => {
    tabIndexMap.current = {};

    forEachTab(children, (tabId, tabIndex) => {
      if (tabId) {
        tabIndexMap.current[tabIndex] = tabId;
      } else {
        window.console.warn(
          "Warning: You are using <TabsWithHistory> without defining tab IDs." +
            "\n\n" +
            "Each <Tab> should have a unique `id` that maps to a valid value " +
            `for the "?${queryParamName}=" query parameter.` +
            "\n"
        );
      }
    });

    // Handle the special case where the query parameter is not present in the
    // URL. This might happen on page load, for instance. We replace the
    // history entry with a new one containing the parameter. This way,
    // navigating back in the browser's history will take you to the proper
    // tab.
    const existingParams = qs.parse(window.location.search.substr(1));
    if (!existingParams[queryParamName]) {
      const queryString = qs.stringify({
        ...existingParams,
        [queryParamName]: defaultId || tabIndexMap.current[0],
      });

      window.history.replaceState({}, "", `?${queryString}`);
    }
  }, [children, queryParamName, defaultId]);

  // When the tab index changes, store that in local state and also reflect the
  // change in the browser's history.
  const handleChangeTabIndex = useCallback(
    (nextIndex: number) => {
      setIndex(nextIndex);
      onChange(nextIndex);

      const existingParams = qs.parse(window.location.search.substr(1));
      const queryString = qs.stringify({
        ...existingParams,
        [queryParamName]: tabIndexMap.current[nextIndex],
      });

      window.history.pushState({}, "", `?${queryString}`);

      // Only dispatch the event for the tab being shown. Plotly improperly
      // sized the Enriched Lineages Tile box plots if the plots attempted to load
      // while the overview tab was hidden. This dispatches an event so that the box
      // plots will resize on selection of the tab via incrementing the state of the components key.
      // Note: A similar technique is used for the Compound Page tabs here: portal-backend/depmap/static/js/sticky/stickyTabs.js
      window.dispatchEvent(
        new CustomEvent(`changeTab:${tabIndexMap.current[nextIndex]}`)
      );
    },
    [setIndex, onChange, queryParamName]
  );

  // Set up a listener for a custom "clickTab" event and update local state
  // when it fires.
  useEffect(() => {
    const onTabLinkClicked = (event: CustomEvent) => {
      // Remove a leading # which may be present on links from gene page tiles.
      // That was a convention used by the older, pre-React tabs component.
      const targetId = event.detail.tabId.replace(/^#/, "");
      const targetQueryParam = event.detail.queryParamName || "tab";

      Object.entries(tabIndexMap.current).forEach(([tabIndex, tabId]) => {
        if (tabId === targetId && queryParamName === targetQueryParam) {
          handleChangeTabIndex(Number(tabIndex));
        }
      });
    };

    window.addEventListener("clickTab" as any, onTabLinkClicked);
    return () =>
      window.removeEventListener("clickTab" as any, onTabLinkClicked);
  }, [handleChangeTabIndex, queryParamName]);

  // Set up a listener for the browser history's "popstate" event and update
  // local state when it fires.
  useEffect(() => {
    const onPopState = () => {
      const params = qs.parse(window.location.search.substr(1));

      Object.entries(tabIndexMap.current).forEach(([tabIndex, tabId]) => {
        if (tabId === params[queryParamName]) {
          setIndex(Number(tabIndex));
        }
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [queryParamName]);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Tabs index={index} onChange={handleChangeTabIndex} {...otherProps}>
      {children}
    </Tabs>
  );
};
