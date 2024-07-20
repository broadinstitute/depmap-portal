import React, { useRef } from "react";
import { DataExplorerPlotConfig } from "@depmap/types";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

interface Props {
  imgSrc: string;
  title: string;
  plot: DataExplorerPlotConfig;
  description: React.ReactNode;
}

function StartScreenExample({ imgSrc, title, description, plot }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleClick = () => {
    const el = ref.current!.closest("#dx2_start_screen");
    window.history.replaceState({ startScreenScrollTop: el!.scrollTop }, "");

    window.dispatchEvent(
      new CustomEvent("dx2_example_clicked", {
        detail: plot,
      })
    );
  };

  return (
    <div ref={ref} className={styles.StartScreenExample}>
      <span>
        <figure>
          <button type="button" tabIndex={-1} onClick={handleClick}>
            <img src={imgSrc} alt="" />
          </button>
        </figure>
        <dt>
          <button type="button" onClick={handleClick}>
            {title}
          </button>
        </dt>
      </span>
      <dd>{description}</dd>
    </div>
  );
}

export default StartScreenExample;
