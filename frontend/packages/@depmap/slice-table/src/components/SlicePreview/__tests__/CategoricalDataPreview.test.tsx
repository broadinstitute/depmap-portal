import React from "react";
import { render, screen } from "@testing-library/react";
import CategoricalDataPreview from "../CategoricalDataPreview";
import { TRUNCATED_CATEGORY_COUNT } from "../getCategoricalPreviewMode";

jest.mock("../BarChart", () => ({
  __esModule: true,
  default: ({ data }: { data: { x: string[]; y: number[] } }) => (
    <div data-testid="bar-chart" data-bars={data.x.join(",")}>
      {data.x.length}
    </div>
  ),
}));

const renderPreview = (
  dataValues: (string | number | string[])[],
  initiallyShowNulls = false
) =>
  render(
    <CategoricalDataPreview
      dataValues={dataValues}
      xAxisTitle="Some column"
      hoverLabel="Some column"
      entityLabel="Model"
      initiallyShowNulls={initiallyShowNulls}
    />
  );

const barCount = () => Number(screen.getByTestId("bar-chart").textContent);

const bars = () =>
  screen.getByTestId("bar-chart").getAttribute("data-bars")!.split(",");

describe("CategoricalDataPreview", () => {
  it("plots an ordinary categorical column", () => {
    const dataValues = Array.from(
      { length: 1000 },
      (_, i) => `lineage_${i % 20}`
    );

    renderPreview(dataValues);

    expect(barCount()).toBe(20);
    expect(screen.queryByText(/most common of/)).toBe(null);
  });

  it("omits the plot when the column is ~1-to-1 with the ID column", () => {
    const dataValues = Array.from({ length: 1000 }, (_, i) => `ACH-${i}`);

    const { container } = renderPreview(dataValues);

    expect(screen.queryByTestId("bar-chart")).toBe(null);
    expect(container.querySelector("[data-preview-mode='omit']")).toBeTruthy();
    expect(container.textContent).toContain(
      "1,000 distinct values across 1,000 models"
    );
  });

  it("plots a fixed window of the most common values when there are too many categories", () => {
    // 400 distinct values whose counts vary: value_0 is the most common, and
    // the counts fall off from there.
    const dataValues: string[] = [];
    for (let i = 0; i < 400; i += 1) {
      for (let j = 0; j < 400 - i; j += 1) {
        dataValues.push(`value_${i}`);
      }
    }

    const { container } = renderPreview(dataValues);

    expect(
      container.querySelector("[data-preview-mode='truncate']")
    ).toBeTruthy();
    // Exactly at the limit, which is what keeps BarChart's range slider (the
    // control that locks up the browser) from appearing at all.
    expect(barCount()).toBe(TRUNCATED_CATEGORY_COUNT);
    expect(bars()[0]).toBe("value_0");
    expect(bars()).not.toContain("value_399");
    expect(container.textContent).toContain(
      `Showing the ${TRUNCATED_CATEGORY_COUNT} most common of 400 values`
    );
  });

  it("keeps the truncated window at the limit when the N/A bar is shown", () => {
    const dataValues: (string | undefined)[] = [];
    for (let i = 0; i < 400; i += 1) {
      for (let j = 0; j < 400 - i; j += 1) {
        dataValues.push(`value_${i}`);
      }
    }
    // Enough nulls to land in the middle of the truncated window.
    for (let i = 0; i < 390; i += 1) {
      dataValues.push(undefined);
    }

    renderPreview(dataValues as (string | number)[], true);

    expect(barCount()).toBe(TRUNCATED_CATEGORY_COUNT);
    expect(bars()).toContain("N/A");
  });
});
