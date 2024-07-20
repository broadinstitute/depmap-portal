import React, { useEffect, useRef } from "react";

export function usePrevious(value: any) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

// from https://itnext.io/reusing-the-ref-from-forwardref-with-react-hooks-4ce9df693dd
export function useCombinedRefs(...refs: any[]) {
  const targetRef = React.useRef<any>();

  React.useEffect(() => {
    refs.forEach((ref) => {
      if (!ref) return;

      if (typeof ref === "function") {
        ref(targetRef.current);
      } else {
        // eslint-disable-next-line no-param-reassign
        ref.current = targetRef.current;
      }
    });
  }, [refs]);

  return targetRef;
}
