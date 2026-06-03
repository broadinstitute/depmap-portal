import React, { useEffect, useRef } from "react";
import { Button } from "react-bootstrap";
import { WordBreaker } from "@depmap/common-components";
import { toPortalLink } from "@depmap/globals";
import SliceTable from "@depmap/slice-table";
import DownloadDataSvg from "src/common/components/svgs/DownloadDataSvg";
import DependencyLinksHeader from "src/pairedScreens/components/DependencyLinksHeader";
import DependencyLinksCell from "src/pairedScreens/components/DependencyLinksCell";
import useMetadata from "src/pairedScreens/hooks/useMetadata";
import useUrlHighlights from "src/pairedScreens/hooks/useUrlHighlights";
import initialSlices from "../json/initialSlices.json";
import PercentCPDChangeHeader from "./PercentCPDChangeHeader";
import CompoundLink from "./CompoundLink";
import styles from "src/pairedScreens/styles/sharedDashboard.scss";

function AnchorScreenDashboard() {
  const metadata = useMetadata();
  const sliceTableRef = useRef<{ forceInitialize: () => void }>(null);
  const { highlights, clearHighlights } = useUrlHighlights();

  // Re-initialize the table when highlights change (clear button or
  // back/forward navigation). The first render is skipped because the table
  // initializes itself with the current highlights on mount.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    sliceTableRef.current?.forceInitialize();
  }, [highlights]);

  return (
    <div>
      <div className={styles.header}>
        <h2>Anchor Screen Dashboard</h2>
        <span className={styles.download}>
          <DownloadDataSvg />
          <a
            target="_blank"
            rel="noreferrer"
            href={toPortalLink(
              "data_page/?" +
                new URLSearchParams({
                  tab: "allData",
                  releasename: "Anchor Screens 26Q1",
                  filename: "PairedAnchorScreenTable.csv",
                }).toString()
            )}
          >
            Download files
          </a>
        </span>
      </div>
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
          sliceTableRef={sliceTableRef}
          isLoading={!metadata}
          getInitialState={() => ({
            initialSlices,
            initialRowSelection: Object.fromEntries(
              highlights.map((id) => [id, true])
            ),
          })}
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
            const header = () => <WordBreaker text={sliceQuery.identifier} />;

            switch (sliceQuery.identifier) {
              case "PairID":
                return { header, width: 100 };

              case "ModelID":
                return { header, width: 125 };

              case "StrippedCellLineName":
              case "OncotreeLineage":
              case "DrugConcentration":
                return { header };

              case "Drug":
                return { header, cell: CompoundLink };

              case "TestArmAvgCPD":
                return { header, width: 140, numericPrecision: 3 };

              case "ControlArmAvgCPD":
                return { header, width: 140, numericPrecision: 3 };

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
              header: () => (
                <DependencyLinksHeader
                  heading={<>Comparing drug to control condition</>}
                  tooltipTitle="Comparing drug to control condition"
                  tooltipContent={
                    <ul>
                      <li>
                        The “volcano” links will show a volcano plot of the
                        differential dependency analysis produced by
                        Chronos-compare. The x-axis shows difference in gene
                        effect, negative values indicate greater dependency in
                        the drug vs. control arm.
                      </li>
                      <br />
                      <li>
                        The “scatter” links will show a scatter plot of the drug
                        vs the control arm gene effects.
                      </li>
                    </ul>
                  }
                />
              ),
              cell: ({ row }) => (
                <DependencyLinksCell
                  pairId={row.id}
                  metadata={metadata}
                  volcanoXDataset="PairedAnchorGeneEffectDiff"
                  volcanoYDataset="PairedAnchorGeneEffectFDR"
                />
              ),
            },
          ]}
          renderCustomActions={() => {
            if (highlights.length === 0) {
              return null;
            }

            return (
              <Button onClick={clearHighlights}>
                <i className="glyphicon glyphicon-erase" />
                <span>
                  {" "}
                  Clear highlighted {highlights.length === 1 ? "row" : "rows"}
                </span>
              </Button>
            );
          }}
        />
      </div>
    </div>
  );
}

export default AnchorScreenDashboard;
