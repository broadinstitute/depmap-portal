import React, { useLayoutEffect, useRef, useState } from "react";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import {
  calcBins,
  categoryToDisplayName,
  LegendKey,
} from "./prototype/plotUtils";
import styles from "../../styles/DataExplorer2.scss";

interface Props {
  data: {
    filters: {
      color1?: { name: string };
      color2?: { name: string };
      facet1?: { name: string };
      facet2?: { name: string };
    };
  };
  continuousBins: ReturnType<typeof calcBins>;
  category: LegendKey;
  // Which triad (color's own, or facet's own via the version-2 default
  // defer) backs this legend — see resolveColorMode. No default: an absent
  // color_by defers to facet_by, so "color" is not a safe universal
  // fallback here.
  target: "color" | "facet";
}

function LegendLabel({ data, continuousBins, category, target }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useLayoutEffect(() => {
    // HACK: This assumes a fixed width.
    if (ref.current && ref.current.offsetWidth > 178) {
      setShowTooltip(true);
    }
  }, []);

  const name = categoryToDisplayName(category, data, continuousBins, target);
  const nameElement =
    typeof name === "string" ? (
      <span>{name}</span>
    ) : (
      <span>
        {name[0]}
        <span style={{ margin: 4 }}> – </span>
        {name[1]}
      </span>
    );

  if (showTooltip) {
    return (
      <Tooltip
        className={styles.legendTooltip}
        id="legend-item-tooltip"
        content={<WordBreaker text={name.toString()} />}
        placement="top"
      >
        {nameElement}
      </Tooltip>
    );
  }

  return <span ref={ref}>{nameElement}</span>;
}

export default LegendLabel;
