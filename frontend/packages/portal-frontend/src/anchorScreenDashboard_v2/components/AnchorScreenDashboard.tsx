import React from "react";
import SliceTable from "@depmap/slice-table";
import initialSlices from "./initialSlices.json";
import PlotLinksHeader from "./PlotLinksHeader";
import PlotLinksCell from "./PlotLinksCell";
import HeaderCell from "./HeaderCell";
import useMetadata from "./useMetadata";
import styles from "../styles/AnchorScreenDashboard.scss";

function AnchorScreenDashboard() {
  const metadata = useMetadata();

  return (
    <div className={styles.AnchorScreenDashboard}>
      <h2>Anchor Screen Dashboard</h2>
      <div className={styles.description}>
        <p>
          This dashboard will help you navigate the CRISPR drug anchor screens
          which have data analyzed and loaded into the portal.
        </p>
        <p>
          <b>Note</b>: the gene effects shown in the scatter plot are from
          co-processing all screens with Chronos (ScreenGeneEffect), whereas the
          Chronos-compare volcano plots are from processing each anchor screen
          individually. As a result, the differential effect size in the volcano
          plot should be similar but not exactly the same as the difference
          shown in the scatter plot.
        </p>
      </div>
      <div className={styles.tableContainer}>
        <SliceTable
          index_type_name="anchor_experiment"
          getInitialState={() => ({ initialSlices })}
          hideIdColumn
          hideLabelColumn
          headerCellRenderer={HeaderCell}
          customColumns={[
            {
              header: PlotLinksHeader,
              cell: ({ row }) => (
                <PlotLinksCell experimentId={row.id} metadata={metadata} />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

export default AnchorScreenDashboard;
