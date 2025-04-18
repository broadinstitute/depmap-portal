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
            Below is a table of the anchor screens which have data analyzed and
            loaded into the portal. The “volcano” links will show a volcano plot
            of the differential analysis produced by “Chronos compare.” The
            “scatter” links will show a scatter plot of the drug arm vs the
            control arm.
          </p>
          <p>
            <b>Note</b>: the screens shown in the scatter plot are from
            processing all screens together with Chronos, whereas the Chronos
            compare volcano plots processed only the anchor screens. As a
            result, the differential effect size in the volcano plot should be
            similar but not exactly the same as the difference shown in the
            scatter plot.
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
