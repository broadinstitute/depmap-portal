import plotToLookupTable from "../plotToLookupTable";
import { DataExplorerPlotResponse } from "@depmap/types";

const data: DataExplorerPlotResponse = {
  index_type: "depmap_model",
  index_labels: ["ACH-000001", "ACH-000147", "ACH-000535", "ACH-000552"],
  index_aliases: [
    {
      label: "Cell Line Name",
      slice_id: "slice/cell_line_display_name/all/label",
      values: ["NIHOVCAR3", "T47D", "BXPC3", "HT29"],
    },
  ],
  dimensions: {
    x: {
      axis_label: "SOX10 Gene Effect (Chronos)",
      dataset_id: "Chronos_Combined",
      dataset_label: "CRISPR (DepMap Internal 24Q2 v2+Score, Chronos)",
      slice_type: "gene",
      values: [
        -0.3744230115088182,
        -0.07708969563580259,
        -0.2240249435738731,
        -0.15866922788538937,
      ],
    },
  },
  filters: {},
  metadata: {
    color_property: {
      label: "Lineage",
      slice_id: "slice/lineage/1/label",
      values: ["Ovary/Fallopian Tube", "Breast", "Pancreas", "Bowel"],
    },
  },
};

describe("plotToLookupTable", () => {
  it("should format data properly", () => {
    const { formattedData } = plotToLookupTable(data);

    expect(formattedData).toEqual({
      '"SOX10 Gene Effect (Chronos) CRISPR (DepMap Internal 24Q2 v2+Score, Chronos)"': [
        -0.3744230115088182,
        -0.07708969563580259,
        -0.2240249435738731,
        -0.15866922788538937,
      ],
      "Cell Line Name": ["NIHOVCAR3", "T47D", "BXPC3", "HT29"],
      Lineage: ["Ovary/Fallopian Tube", "Breast", "Pancreas", "Bowel"],
      model: ["ACH-000001", "ACH-000147", "ACH-000535", "ACH-000552"],
    });
  });
});
