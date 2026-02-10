import React from "react";
import { InfoTip, WordBreaker } from "@depmap/common-components";
import { SliceQuery } from "@depmap/types";
import styles from "../styles/AnchorScreenDashboard.scss";

function HeaderCell({
  label,
  sliceQuery,
  defaultElement,
}: {
  label: string;
  sliceQuery: SliceQuery;
  defaultElement: React.ReactNode;
}) {
  if (sliceQuery.identifier !== "PercentCPDChange") {
    return defaultElement;
  }

  return (
    <div className={styles.infotip}>
      <WordBreaker text={label} />
      <InfoTip
        id="percent-cpd-change"
        title={label}
        placement="left"
        content={
          <div>
            The table includes cumulative population doublings (CPD) for each
            screen arm; we have observed that there is little to no significant
            differential dependency when the gap in CPDs between the control and
            drug arm is less than 20% (% CPD change {">"} -20), presumably due
            to low drug effect.
          </div>
        }
      />
    </div>
  );
}

export default HeaderCell;
