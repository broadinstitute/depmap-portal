import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import ModelTab from "src/cellLine/components/ModelTab";
import PairedScreensTile, {
  ResistanceInfo,
} from "src/cellLine/components/PairedScreensTile";
import { derivePairedScreensData } from "src/cellLine/hooks/usePairedScreensData";
import { ResistanceRow } from "src/cellLine/utilities/getResistanceScreenTable";
import { ModelInfo } from "src/cellLine/models/types";

jest.mock("@depmap/globals", () => ({
  toPortalLink: (relativeUrl: string) => relativeUrl,
}));

const modelInfo = ({
  lineage_tree: [],
  molecular_subtype_tree: [],
  aliases: [],
  related_models: [],
  metadata: {},
} as unknown) as ModelInfo;

describe("ModelTab resistance origin", () => {
  it("renders a cultured resistance origin", () => {
    render(
      <ModelTab
        modelInfo={modelInfo}
        resistanceOrigin={{
          type: "cultured",
          description: "Selected in 1 µM afatinib",
        }}
      />
    );

    expect(screen.getByText("Resistance")).toBeInTheDocument();
    expect(screen.getByText("Cultured Resistance")).toBeInTheDocument();
    expect(screen.getByText("Selected in 1 µM afatinib")).toBeInTheDocument();
  });

  it("renders an engineered resistance origin", () => {
    render(
      <ModelTab
        modelInfo={modelInfo}
        resistanceOrigin={{
          type: "engineered",
          description: "EGFR T790M knock-in",
        }}
      />
    );

    expect(screen.getByText("Engineered Resistance")).toBeInTheDocument();
    expect(screen.getByText("EGFR T790M knock-in")).toBeInTheDocument();
  });

  it("renders no resistance group without an origin", () => {
    render(<ModelTab modelInfo={modelInfo} />);

    expect(screen.queryByText("Resistance")).not.toBeInTheDocument();
  });
});

describe("derivePairedScreensData origin inference", () => {
  const baseRow = {
    PairID: "PAIR095",
    CtrlArmModelID: "ACH-002475",
    CtrlArmStrippedCellLineName: "HEC59",
    TestArmModelID: "ACH-002476",
    TestArmStrippedCellLineName: "HEC59MLH1",
    CulturedDrugResistance: null,
    EngineeredModelDetails: "MLH1 13bp deletion",
  };

  it.each(["genetic knock-in", "genetic knock out"])(
    "maps a %s row to an engineered origin",
    (comparisonType) => {
      const row: ResistanceRow = { ...baseRow, ComparisonType: comparisonType };
      const { resistance } = derivePairedScreensData("ACH-002476", [], [row]);

      expect(resistance).toEqual({
        role: "derivative",
        origin: { type: "engineered", description: "MLH1 13bp deletion" },
        parentalLine: { id: "ACH-002475", name: "HEC59" },
      });
    }
  );
});

describe("PairedScreensTile resistance metadata", () => {
  it("shows the parental model link but not the origin", () => {
    const resistance: ResistanceInfo = {
      role: "derivative",
      origin: {
        type: "cultured",
        description: "Selected in 1 µM afatinib",
      },
      parentalLine: { id: "ACH-000219", name: "PC14" },
    };

    render(<PairedScreensTile resistance={resistance} />);

    expect(screen.getByText("Parental Model")).toBeInTheDocument();
    expect(screen.getByText("PC14")).toBeInTheDocument();
    expect(screen.queryByText("Cultured Resistance")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Selected in 1 µM afatinib")
    ).not.toBeInTheDocument();
  });
});
