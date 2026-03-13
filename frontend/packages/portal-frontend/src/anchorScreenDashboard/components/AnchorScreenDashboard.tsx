import React from "react";
import SliceTable from "@depmap/slice-table";
import initialSlices from "./initialSlices.json";
import PlotLinksHeader from "./PlotLinksHeader";
import PlotLinksCell from "./PlotLinksCell";
import PercentCPDChangeHeader from "./PercentCPDChangeHeader";
import CompoundLink from "./CompoundLink";
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
          index_type_name="screen_pair"
          isLoading={!metadata}
          getInitialState={() => ({ initialSlices })}
          downloadFilename="anchor_screen_dashboard.csv"
          hideLabelColumn
          hiddenDatasets={
            new Set([
              "screen_pair_metadata",
              "PairedResScreenTable",
              "PairedResGeneEffectDiff",
              "PairedResGeneEffectFDR",
            ])
          }
          implicitFilter={({ id }) => {
            if (!metadata) {
              return false;
            }

            return metadata.ComparisonType[id] === "drug-anchor";
          }}
          getColumnDisplayOptions={(sliceQuery) => {
            switch (sliceQuery.identifier) {
              case "PairID":
                return { width: 100 };

              case "ModelID":
                return { width: 125 };

              case "Drug":
                return {
                  cell: CompoundLink,
                };

              case "TestArmAvgCPD":
                return { width: 140 };

              case "ControlArmAvgCPD":
                return { width: 140 };

              case "PercentCPDChange":
                return {
                  width: 180,
                  numericPrecision: 2,
                  header: PercentCPDChangeHeader,
                };

              default:
                return null;
            }
          }}
          customColumns={[
            {
              width: 148,
              header: PlotLinksHeader,
              cell: ({ row }) => (
                <PlotLinksCell pairId={row.id} metadata={metadata} />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

export default AnchorScreenDashboard;
