import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { dataExplorerAPI } from "../../../services/dataExplorerAPI";
import { deprecatedDataExplorerAPI } from "../../../services/deprecatedDataExplorerAPI";
import DimensionSelect from "../index";
import { NULL_MAPPING } from "../useDimensionStateManager/useData";

test("hides the aggregation select for the special case of correlation", async () => {
  dataExplorerAPI.fetchDatasetsByIndexType = jest
    .fn<ReturnType<typeof dataExplorerAPI.fetchDatasetsByIndexType>, []>()
    .mockResolvedValue({ depmap_model: [] });

  deprecatedDataExplorerAPI.fetchDimensionLabelsToDatasetsMapping = jest
    .fn<
      ReturnType<
        typeof deprecatedDataExplorerAPI.fetchDimensionLabelsToDatasetsMapping
      >,
      []
    >()
    .mockResolvedValue(NULL_MAPPING);

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
