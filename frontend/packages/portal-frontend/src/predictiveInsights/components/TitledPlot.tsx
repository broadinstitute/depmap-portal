import React from "react";
import InfoIcon from "src/common/components/InfoIcon";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  title: string;
  tooltip: React.ReactNode;
  children: React.ReactNode;
}

export default function TitledPlot({ title, tooltip, children }: Props) {
  return (
    <div className={styles.titledPlot}>
      <h4 className={styles.plotTitle}>
        {title}
        <InfoIcon
          popoverContent={<p>{tooltip}</p>}
          popoverId={`plot-info-${title.replace(/\W+/g, "-")}`}
          trigger={["hover", "focus"]}
        />
      </h4>
      {children}
    </div>
  );
}
