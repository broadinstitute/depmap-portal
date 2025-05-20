import React, { useRef } from "react";
import { Spinner } from "@depmap/common-components";
import WideTable from "@depmap/wide-table";
import useData from "src/anchorScreenDashboard/hooks/useData";
import useTableHeight from "src/anchorScreenDashboard/hooks/useTableHeight";
import tableConfig from "src/anchorScreenDashboard/components/tableConfig";
import styles from "src/anchorScreenDashboard/styles/AnchorScreenDashboard.scss";

function AnchorScreenDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const { error, isLoading, data } = useData();
  const { fixedHeight } = useTableHeight(ref);

  return (
    <div className={styles.AnchorScreenDashboard}>
      <div ref={ref} className={styles.staticContent}>
        <h1>Anchor Screen Dashboard</h1>
        <div className={styles.description}>
          <p>
            This dashboard will help you navigate the CRISPR drug anchor screens
            which have data analyzed and loaded into the portal.
          </p>
          <ul>
            <li>
              The “volcano” links will show a volcano plot of the differential
              dependency analysis produced by Chronos-compare. The x-axis shows
              difference in gene effect, negative values indicate greater
              dependency in the drug vs. control arm.
            </li>
            <li>
              The “scatter” links will show a scatter plot of the drug vs the
              control arm gene effects.
            </li>
            <li>
              The table includes cumulative population doublings (CPD) for each
              screen arm; we have observed that there is little to no
              significant differential dependency when the gap in CPDs between
              the control and drug arm is less than 20% (% CPD change {">"}{" "}
              -20), presumably due to low drug effect.
            </li>
          </ul>
          <p>
            <b>Note</b>: the gene effects shown in the scatter plot are from
            co-processing all screens with Chronos (ScreenGeneEffect), whereas
            the Chronos-compare volcano plots are from processing each anchor
            screen individually. As a result, the differential effect size in
            the volcano plot should be similar but not exactly the same as the
            difference shown in the scatter plot.
          </p>
        </div>
      </div>
      {isLoading && <Spinner />}
      {!isLoading && !error && (
        <WideTable
          {...tableConfig}
          data={data}
          fixedHeight={fixedHeight}
          downloadURL="../partials/data_table/anchor_screen_metadata"
        />
      )}
      {error && (
        <div className={styles.error}>
          Sorry, there was an error loading table data 😔
        </div>
      )}
    </div>
  );
}

export default AnchorScreenDashboard;
