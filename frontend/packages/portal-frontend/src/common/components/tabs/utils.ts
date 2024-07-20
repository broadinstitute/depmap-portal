import React from "react";

export function useUniquePrefix(readablePrefix = "id") {
  const [id, setId] = React.useState("");

  React.useEffect(() => {
    setId(`${readablePrefix}-${Math.round(Math.random() * 1e5)}`);
  }, [readablePrefix]);

  return id;
}

export function getValidChildren(children: React.ReactNode) {
  return React.Children.toArray(children).filter((child) =>
    React.isValidElement(child)
  ) as React.ReactElement[];
}

export function normalizeEventKey(
  event: Pick<KeyboardEvent, "key" | "keyCode">
) {
  const { key, keyCode } = event;

  const isArrowKey =
    keyCode >= 37 && keyCode <= 40 && key.indexOf("Arrow") !== 0;

  const eventKey = isArrowKey ? `Arrow${key}` : key;

  return eventKey;
}

interface DetermineLazyBehaviorOptions {
  hasBeenSelected?: boolean;
  isLazy?: boolean;
  isSelected?: boolean;
  lazyBehavior?: "unmount" | "keepMounted";
}

export function determineLazyBehavior(options: DetermineLazyBehaviorOptions) {
  const {
    hasBeenSelected,
    isLazy,
    isSelected,
    lazyBehavior = "unmount",
  } = options;

  // if not lazy, always render the disclosure's content
  if (!isLazy) return true;

  // if the diclosure is selected, render the disclosure's content
  if (isSelected) return true;

  // if the disclosure was selected but not active, keep its content active
  if (lazyBehavior === "keepMounted" && hasBeenSelected) return true;

  return false;
}
