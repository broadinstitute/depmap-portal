import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import DimensionSelect from "../index";
import { NULL_MAPPING } from "../useDimensionStateManager/useData";

// TODO: mock these methods:
// fetchDatasetsByIndexType: {() => Promise.resolve({ depmap_model: [] })
// fetchDimensionLabelsToDatasetsMapping: () => { return Promise.resolve(NULL_MAPPING); }

test("hides the aggregation select for the special case of correlation", async () => {
  render(
    <DimensionSelect
      mode="entity-or-context"
      index_type="depmap_model"
      includeAllInContextOptions
      onChange={() => {}}
      onClickCreateContext={() => {}}
      onClickSaveAsContext={() => {}}
      value={{
        axis_type: "aggregated_slice",
        aggregation: "correlation",
      }}
    />
  );

  await waitFor(() => {
    return expect(
      screen.getByText("Features to correlate")
    ).toBeInTheDocument();
  });

  expect(screen.queryByText("Method")).not.toBeInTheDocument();
});
