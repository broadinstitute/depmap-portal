import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { enabledFeatures } from "@depmap/globals";

import {
  ResistanceInfo,
  ResistanceOrigin,
  ResistanceScreenRows,
} from "src/cellLine/components/PairedScreensTile";

// ---------------------------------------------------------------------------
// Row shapes as they come back from Breadbox.
//
// The CSV column names have ` | Anchor Screen Table` and ` | Resistance Screen
// Table` suffixes (display labels). These types assume Breadbox returns the
// raw column names without the suffix; if it doesn't, normalize at the API
// boundary rather than here.
// ---------------------------------------------------------------------------

interface AnchorRow {
  PairID: string;
  ModelID: string;
}

interface ResistanceRow {
  PairID: string;
  CtrlArmModelID: string;
  CtrlArmStrippedCellLineName: string;
  TestArmModelID: string;
  TestArmStrippedCellLineName: string;
  CulturedDrugResistance: string | null;
  EngineeredModelDetails: string | null;
  ComparisonType: "drug adapted" | "genetic knock-in" | string;
}

// ---------------------------------------------------------------------------
// Public hook output
// ---------------------------------------------------------------------------

export interface PairedScreensData {
  anchorRowIds?: string[];
  resistanceRows?: ResistanceScreenRows;
  resistance?: ResistanceInfo;
}

export interface PairedScreensState {
  data: PairedScreensData | null;
  loading: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
const bb = cached(breadboxAPI);

const getAnchorScreenTable = async () => {
  const data = await bb.getTabularDatasetData("PairedAnchorScreenTable", {
    columns: ["ModelID"],
  });

  return Object.entries(data.ModelID).map(([PairID, ModelID]) => ({
    PairID,
    ModelID,
  })) as AnchorRow[];
};

const getResistanceScreenTable = async () => {
  const data = await bb.getTabularDatasetData("PairedResScreenTable", {
    columns: [
      "CtrlArmModelID",
      "CtrlArmStrippedCellLineName",
      "TestArmModelID",
      "TestArmStrippedCellLineName",
      "CulturedDrugResistance",
      "EngineeredModelDetails",
      "ComparisonType",
    ],
  });

  return Object.keys(data.ComparisonType).map((PairID) => ({
    PairID,
    CtrlArmModelID: data.CtrlArmModelID[PairID],
    CtrlArmStrippedCellLineName: data.CtrlArmStrippedCellLineName[PairID],
    TestArmModelID: data.TestArmModelID[PairID],
    TestArmStrippedCellLineName: data.TestArmStrippedCellLineName[PairID],
    CulturedDrugResistance: data.CulturedDrugResistance[PairID],
    EngineeredModelDetails: data.EngineeredModelDetails[PairID],
    ComparisonType: data.ComparisonType[PairID],
  })) as ResistanceRow[];
};

export function usePairedScreensData(modelId: string): PairedScreensState {
  const [data, setData] = useState<PairedScreensData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!enabledFeatures.anchor_and_resistance_screen_dashboards) {
      setLoading(false);
      setData(null);

      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    setError(null);

    Promise.all([getAnchorScreenTable(), getResistanceScreenTable()])
      .then(([anchorRows, resistanceRows]) => {
        if (!mounted) {
          return;
        }
        setData(derivePairedScreensData(modelId, anchorRows, resistanceRows));
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }
        setError(err);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [modelId]);

  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Pure inference (exported for testing)
// ---------------------------------------------------------------------------

export function derivePairedScreensData(
  modelId: string,
  anchorRows: AnchorRow[],
  resistanceRows: ResistanceRow[]
): PairedScreensData {
  // Anchor: a model can appear in many rows (one per drug/concentration combo).
  // Each appearance is its own PairID; the dashboard highlights all of them.
  const anchorRowIds = anchorRows
    .filter((r) => r.ModelID === modelId)
    .map((r) => r.PairID);

  // Resistance: derivative <-> parental relationships are encoded across two
  // columns. The same model can in principle appear on either side; we
  // collect both and let the tile render one link per non-empty role.
  const testRows = resistanceRows.filter((r) => r.TestArmModelID === modelId);
  const ctrlRows = resistanceRows.filter((r) => r.CtrlArmModelID === modelId);

  const resistanceRowIds: ResistanceScreenRows = {};
  if (testRows.length > 0) {
    resistanceRowIds.test = testRows.map((r) => r.PairID);
  }
  if (ctrlRows.length > 0) {
    resistanceRowIds.ctrl = ctrlRows.map((r) => r.PairID);
  }

  // Resistance metadata describes what kind of derivative this model IS, so
  // it only applies when the model is on the Test side. Parental lines (Ctrl
  // side) don't get a metadata block — they're the baseline.
  let resistance: ResistanceInfo | undefined;
  if (testRows.length > 0) {
    // FIXME: if a derivative ever appears in multiple Test rows (different
    // parents, or repeated experiments), this picks the first arbitrarily.
    // Confirm with Barbara whether that case can actually happen and how she
    // wants it presented.
    const row = testRows[0];
    resistance = {
      origin: deriveOrigin(row),
      parentalLine: {
        id: row.CtrlArmModelID,
        name: row.CtrlArmStrippedCellLineName,
      },
    };
  }

  return {
    anchorRowIds: anchorRowIds.length > 0 ? anchorRowIds : undefined,
    resistanceRows:
      resistanceRowIds.test || resistanceRowIds.ctrl
        ? resistanceRowIds
        : undefined,
    resistance,
  };
}

function deriveOrigin(row: ResistanceRow): ResistanceOrigin | undefined {
  if (row.ComparisonType === "drug adapted" && row.CulturedDrugResistance) {
    return { type: "cultured", description: row.CulturedDrugResistance };
  }

  if (row.ComparisonType === "genetic knock-in" && row.EngineeredModelDetails) {
    return { type: "engineered", description: row.EngineeredModelDetails };
  }

  return undefined;
}
