import React, { useEffect, useRef, useState } from "react";
import { Tooltip } from "@depmap/common-components";
import styles from "src/secretDataViewer/styles/DataViewer.scss";

interface Props {
  value: React.ReactNode;
  tooltip: React.ReactNode;
  className?: string;
}

function Stat({ value, tooltip, className = "" }: Props) {
  const [placement, setPlacement] = useState<"top" | "left" | "right">("top");

  const Content = () => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (ref.current) {
        const wrapper = ref.current.parentElement!
          .parentElement as HTMLDivElement;

        setTimeout(() => {
          const top = Number(wrapper.style.top.replace("px", ""));
          const left = Number(wrapper.style.left.replace("px", ""));

          if (top < 0) {
            setPlacement("left");
          }

          if (left < 0) {
            setPlacement("right");
          }
        }, 0);
      }
    }, []);

    return (
      <div ref={ref} className={styles.tooltipContent}>
        {tooltip}
      </div>
    );
  };

  return (
    <div className={className}>
      <Tooltip
        id="stat-tooltip"
        className={styles.tooltip}
        content={<Content />}
        placement={placement}
      >
        <span>{value}</span>
      </Tooltip>
    </div>
  );
}

export default Stat;
