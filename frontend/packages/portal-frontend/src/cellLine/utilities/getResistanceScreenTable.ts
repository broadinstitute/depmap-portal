import { breadboxAPI, cached } from "@depmap/api";

export interface ResistanceRow {
  PairID: string;
  CtrlArmModelID: string;
  CtrlArmStrippedCellLineName: string;
  TestArmModelID: string;
  TestArmStrippedCellLineName: string;
  CulturedDrugResistance: string | null;
  EngineeredModelDetails: string | null;
  ComparisonType: "drug adapted" | "genetic knock-in" | string;
}

const getResistanceScreenTable = async () => {
  const data = await cached(breadboxAPI).getTabularDatasetData(
    "PairedResScreenTable",
    {
      columns: [
        "CtrlArmModelID",
        "CtrlArmStrippedCellLineName",
        "TestArmModelID",
        "TestArmStrippedCellLineName",
        "CulturedDrugResistance",
        "EngineeredModelDetails",
        "ComparisonType",
      ],
    }
  );

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

export default getResistanceScreenTable;
