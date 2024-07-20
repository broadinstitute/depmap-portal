import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import DimensionSelect from "../index";
import { NULL_MAPPING } from "../useDimensionStateManager/useData";
import * as api from "../../../api";

jest.mock("../../../api");

test("hides the aggregation select for the special case of correlation", async () => {
  jest
    .spyOn(api, "fetchDatasetsByIndexType")
    .mockResolvedValue({ depmap_model: [] });

  jest
    .spyOn(api, "fetchEntityToDatasetsMapping")
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
        axis_type: "context",
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
