import React, { useEffect, useMemo, useRef } from "react";
import { Button } from "react-bootstrap";
import { WordBreaker } from "@depmap/common-components";
import SliceTable from "@depmap/slice-table";
import initialSlices from "../json/initialSlices.json";
import useMetadata from "src/pairedScreens/hooks/useMetadata";
import useUrlHighlights from "src/pairedScreens/hooks/useUrlHighlights";
import getCustomColumns from "./getCustomColumns";

function ResistanceScreenTable() {
  const metadata = useMetadata();
  const sliceTableRef = useRef<{ forceInitialize: () => void }>(null);
  const { highlights, clearHighlights } = useUrlHighlights();

  const customColumns = useMemo(() => {
    return getCustomColumns(metadata);
  }, [metadata]);

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
      customColumns={customColumns}
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
      implicitFilter={({ getValue }) => {
        const comparisonType = getValue({
          dataset_id: "PairedResScreenTable",
          identifier_type: "column",
          identifier: "ComparisonType",
        }) as string;

        return [
          "drug adapted",
          "genetic knock out",
          "genetic knock-in",
        ].includes(comparisonType);
      }}
      getColumnDisplayOptions={(sliceQuery) => {
        const header = () => <WordBreaker text={sliceQuery.identifier} />;

        switch (sliceQuery.identifier) {
          case "PairID":
            return { width: 100 };

          case "CtrlArmModelID":
          case "TestArmModelID":
            return { header, width: 125 };

          case "CtrlArmStrippedCellLineName":
          case "TestArmStrippedCellLineName":
          case "OncotreeLineage":
          case "CulturedDrugResistance":
          case "EngineeredModelDetails":
          case "ComparisonType":
            return { header };

          default:
            return null;
        }
      }}
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
  );
}

export default ResistanceScreenTable;
