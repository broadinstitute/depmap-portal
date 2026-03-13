import React from "react";
import SliceTable from "@depmap/slice-table";
import initialSlices from "./initialSlices.json";
import useMetadata from "./useMetadata";
import PlotLinksHeader from "./PlotLinksHeader";
import PlotLinksCell from "./PlotLinksCell";
import styles from "../styles/ResistanceScreenDashboard.scss";

function ResistanceScreenDashboard() {
  const metadata = useMetadata();

  return (
    <div className={styles.ResistanceScreenDashboard}>
      <h2>Resistance Screen Dashboard</h2>
      <div className={styles.description}>
        <p>
          This dashboard will help you navigate the CRISPR drug resistance
          screens which have data analyzed and loaded into the portal.
        </p>
        <p>
          <b>Note</b>: the gene effects shown in the scatter plot are from
          co-processing all screens with Chronos (ScreenGeneEffect), whereas the
          Chronos-compare volcano plots are from processing each resistance
          screen individually. As a result, the differential effect size in the
          volcano plot should be similar but not exactly the same as the
          difference shown in the scatter plot.
        </p>
      </div>
      <div className={styles.tableContainer}>
        <SliceTable
          index_type_name="screen_pair"
          isLoading={!metadata}
          getInitialState={() => ({ initialSlices })}
          downloadFilename="resistance_screen_dashboard.csv"
          hideLabelColumn
          hiddenDatasets={
            new Set([
              "screen_pair_metadata",
              "PairedAnchorScreenTable",
              "PairedAnchorGeneEffectDiff",
              "PairedAnchorGeneEffectFDR",
            ])
          }
          implicitFilter={({ id }) => {
            if (!metadata) {
              return false;
            }

            return [
              "drug adapted",
              "genetic knock out",
              "genetic knock-in",
            ].includes(metadata.ComparisonType[id]);
          }}
          getColumnDisplayOptions={(sliceQuery) => {
            switch (sliceQuery.identifier) {
              case "PairID":
                return { width: 100 };

              case "CtrlArmModelID":
              case "TestArmModelID":
                return { width: 125 };

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

export default ResistanceScreenDashboard;
