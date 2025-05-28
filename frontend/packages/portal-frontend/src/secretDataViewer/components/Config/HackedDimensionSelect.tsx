import React, { useEffect, useRef } from "react";
import { DimensionSelect } from "@depmap/data-explorer-2";

type Props = React.ComponentProps<typeof DimensionSelect>;

// This observes the dropdowns and watches them for changes so that the Stats
// panel can be kept in sync.
// eslint-disable-next-line react/require-default-props
export default function HackedDimensionSelect(props: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dataTypeContainer = ref.current!.querySelector(
        "div:first-child > div"
      );

      const select = dataTypeContainer!.querySelector(
        "span > div:nth-child(2) > div > div > div"
      );

      let dataType = null;

      if (select && !select.classList[0].includes("placeholder")) {
        dataType = select!.textContent || null;
      }

      const event = new CustomEvent("data_type_changed", {
        detail: dataType,
      });

      window.dispatchEvent(event);
    });

    if (ref.current) {
      observer.observe(ref.current, { subtree: true, childList: true });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref}>
      <DimensionSelect {...props} />
    </div>
  );
}
