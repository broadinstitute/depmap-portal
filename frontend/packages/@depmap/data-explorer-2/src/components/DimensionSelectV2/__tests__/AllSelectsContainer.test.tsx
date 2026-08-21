import React from "react";
import { render } from "@testing-library/react";
import AllSelectsContainer from "../AllSelectsContainer";

// The grid alignment rests on two properties of React.Children that are easy
// to assume and awkward to debug if wrong. Pin them.
const Hidden = () => null;
const Shown = () => <span>shown</span>;

const cells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-dimension-select] > div"));

describe("AllSelectsContainer in grid mode", () => {
  it("gives a cell to a control that renders nothing", () => {
    // This is the whole trick: React.Children sees the ELEMENT, not what it
    // renders, so a hidden control still holds its row open. Without this, a
    // control missing from one axis pulls everything below it up on that axis
    // only, which is the misalignment the grid exists to fix.
    const { container } = render(
      <AllSelectsContainer removeWrapperDiv={false} asGridRows>
        <Shown />
        <Hidden />
        <Shown />
      </AllSelectsContainer>
    );

    expect(cells(container)).toHaveLength(3);
    // The cell exists but holds nothing, so `:empty` can opt it out of the
    // spacing the other cells get.
    expect(cells(container)[1].childNodes).toHaveLength(0);
  });

  it("treats a Fragment as one cell, so grouped controls share a row", () => {
    // How two mutually exclusive controls ask to share a row. If
    // React.Children flattened Fragments, they'd land in separate rows and the
    // grouping in AllSelects would silently do nothing.
    const { container } = render(
      <AllSelectsContainer removeWrapperDiv={false} asGridRows>
        <Shown />
        <>
          <Hidden />
          <Shown />
        </>
      </AllSelectsContainer>
    );

    expect(cells(container)).toHaveLength(2);
  });

  it("adds no cells when grid mode is off", () => {
    // The five other consumers of DimensionSelectV2 must see no DOM change.
    const { container } = render(
      <AllSelectsContainer removeWrapperDiv={false}>
        <Shown />
        <Hidden />
      </AllSelectsContainer>
    );

    expect(cells(container)).toHaveLength(0);
    expect(container.querySelectorAll("span")).toHaveLength(1);
  });
});
