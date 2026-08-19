import React from "react";
import { render, screen } from "@testing-library/react";
import { SliceQuery } from "@depmap/types";
import SlicePreview from "..";

jest.mock("../../useData", () => jest.fn());
jest.mock("../CategoricalDataPreview", () => ({
  __esModule: true,
  default: ({ dataValues }: { dataValues: unknown[] }) => (
    <div data-testid="categorical-preview">{dataValues.join(",")}</div>
  ),
}));
jest.mock("../ContinuousDataPreview", () => ({
  __esModule: true,
  default: () => <div data-testid="continuous-preview" />,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const useData = require("../../useData") as jest.Mock;

// The always-injected root "label" column (screen_nextgen's own label) and
// the chained "label" column (reached via ModelConditionID into
// modelcondition_metadata) share the bare identifier "label" — this is
// exactly the scenario from the reported bug.
const rootLabelSliceQuery: SliceQuery = {
  dataset_id: "screen_nextgen_metadata",
  identifier_type: "column",
  identifier: "label",
};

const chainedLabelSliceQuery: SliceQuery = {
  dataset_id: "modelcondition_metadata",
  identifier_type: "column",
  identifier: "label",
  reindex_through: {
    dataset_id: "screen_nextgen_metadata",
    identifier: "ModelConditionID",
    identifier_type: "column",
  },
};

const makeColumn = (id: string, sliceQuery: SliceQuery) => ({
  id,
  meta: {
    idLabel: id,
    units: "",
    datasetName: "",
    value_type: "text",
    sliceQuery,
  },
});

describe("SlicePreview", () => {
  it("plots the chained column's own data, not the always-fetched root label column it shares an identifier with", () => {
    useData.mockReturnValue({
      error: null,
      loading: false,
      entityLabel: "",
      data: [
        { id: "R1", label: "RootLabelA", chainkey: "ModelConditionLabelA" },
        { id: "R2", label: "RootLabelB", chainkey: "ModelConditionLabelB" },
      ],
      columns: [
        makeColumn("label", rootLabelSliceQuery),
        makeColumn("chainkey", chainedLabelSliceQuery),
      ],
    });

    render(
      <SlicePreview
        index_type_name="screen_nextgen"
        value={chainedLabelSliceQuery}
        PlotlyLoader={(() => null) as never}
      />
    );

    const preview = screen.getByTestId("categorical-preview");
    expect(preview.textContent).toBe(
      "ModelConditionLabelA,ModelConditionLabelB"
    );
  });
});
