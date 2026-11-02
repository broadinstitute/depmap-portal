import buildCategoryCsvColumns from "../categoryCsv";
import { CategoryRow } from "../bestCategories";

const rows: CategoryRow[] = [
  { category: "Lung", count: 12, score: 3.5, meanX: 0.25, meanY: -1.5 },
  { category: "Skin", count: 4, score: 1.25, meanX: -0.75, meanY: 2 },
  { category: "Bone", count: 3, score: 0.5, meanX: 0.1, meanY: 0.2 },
];

describe("buildCategoryCsvColumns", () => {
  it("puts the columns in the order downloadCsv will keep them", () => {
    const columns = buildCategoryCsvColumns({
      rows,
      axisLabels: ["Gene Effect", "Expression"],
      selected: new Set(["Lung"]),
    });

    expect(Object.keys(columns)).toEqual([
      "Category",
      "Selected",
      "Points",
      "Score",
      "Mean Gene Effect",
      "Mean Expression",
    ]);
  });

  it("names the mean columns after the axes, and omits an absent one", () => {
    const columns = buildCategoryCsvColumns({
      rows,
      axisLabels: ["Gene Effect"],
      selected: new Set(),
    });

    expect(Object.keys(columns)).toEqual([
      "Category",
      "Selected",
      "Points",
      "Score",
      "Mean Gene Effect",
    ]);
    expect(columns["Mean Gene Effect"]).toEqual([0.25, -0.75, 0.1]);
  });

  it("marks the selected rows", () => {
    const columns = buildCategoryCsvColumns({
      rows,
      axisLabels: [],
      selected: new Set(["Lung", "Bone"]),
    });

    expect(columns.Category).toEqual(["Lung", "Skin", "Bone"]);
    expect(columns.Selected).toEqual(["Yes", "No", "Yes"]);
  });

  it("follows the display order, dropping rows the table is not showing", () => {
    const columns = buildCategoryCsvColumns({
      rows,
      axisLabels: ["Gene Effect"],
      // As the table reports it: filtered down to two rows, sorted by score
      // descending rather than in the array's alphabetical order.
      displayOrder: ["Skin", "Bone"],
      selected: new Set(["Skin"]),
    });

    expect(columns.Category).toEqual(["Skin", "Bone"]);
    expect(columns.Points).toEqual([4, 3]);
    expect(columns.Selected).toEqual(["Yes", "No"]);
  });

  it("leaves a missing mean undefined for downloadCsv to render as NA", () => {
    const columns = buildCategoryCsvColumns({
      rows: [{ category: "Lung", count: 2, score: 0 }],
      axisLabels: ["Gene Effect", "Expression"],
      selected: new Set(),
    });

    expect(columns["Mean Gene Effect"]).toEqual([undefined]);
    expect(columns["Mean Expression"]).toEqual([undefined]);
  });

  it("carries raw values rather than the table's formatted ones", () => {
    const columns = buildCategoryCsvColumns({
      rows: [
        { category: "Lung", count: 2, score: Infinity, meanX: 0.123456789 },
      ],
      axisLabels: ["Gene Effect"],
      selected: new Set(),
    });

    expect(columns.Score).toEqual([Infinity]);
    expect(columns["Mean Gene Effect"]).toEqual([0.123456789]);
  });
});
