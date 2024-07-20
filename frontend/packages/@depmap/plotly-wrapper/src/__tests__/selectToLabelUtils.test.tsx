import * as utils from "../utilities/selectToLabelUtils";

describe("modifyPlotlyParamsConfig", () => {
  it("Turns on annotationTail while preserving the existing config", () => {
    const plotlyParams: any = {
      data: [{ x: [1] }],
      layout: { hovermode: "closest" },
      config: {
        displaylogo: false,
        edits: { axisTitleText: false },
      },
    };
    const expectedPlotlyParams = {
      data: [{ x: [1] }],
      layout: { hovermode: "closest" },
      config: {
        displaylogo: false,
        edits: {
          axisTitleText: false,
          annotationTail: true,
        },
      },
    };
    expect(utils.modifyPlotlyParamsConfig(plotlyParams)).toEqual(
      expectedPlotlyParams
    );
  });
});

describe("getNewVisibleLabels", () => {
  it("Gets the subset of visible labels that still exist in the plotly params", () => {
    const prevVisibleLabels = new Set(["orange", "apple", "pear"]);
    const plotlyParams: any = {
      layout: {
        annotations: [
          { badKey: "pear", x: 1 },
          { selectToLabelAnnotationKey: "orange", x: 2 },
          { selectToLabelAnnotationKey: "cherry", x: 3 },
        ],
      },
    };
    expect(utils.getNewVisibleLabels(prevVisibleLabels, plotlyParams)).toEqual(
      new Set(["orange"])
    );
  });

  it("Preserves object identity if the resulting set is the same", () => {
    const prevVisibleLabels = new Set(["orange"]);
    const plotlyParams: any = {
      layout: {
        annotations: [
          { badKey: "pear", x: 1 },
          { selectToLabelAnnotationKey: "orange", x: 2 },
          { selectToLabelAnnotationKey: "cherry", x: 3 },
        ],
      },
    };
    // note that .toBe tests object identity
    expect(utils.getNewVisibleLabels(prevVisibleLabels, plotlyParams)).toBe(
      prevVisibleLabels
    );
  });
});

describe("getLabelsToToggle", () => {
  it("Retrieves the keys of points in the event", () => {
    const event = {
      points: [
        { customdata: { selectToLabelAnnotationKey: "point1" } },
        { customdata: { selectToLabelAnnotationKey: "point2" } },
        { otherProperty: { selectToLabelAnnotationKey: "invalid" } },
        { customdata: { otherProperty: "invalid" } },
        { customdata: { selectToLabelAnnotationKey: "point3" } },
      ],
    };

    expect(utils.getLabelsToToggle(event as any)).toEqual([
      "point1",
      "point2",
      "point3",
    ]);
  });
});

describe("getPlotlyRestyleUpdate", () => {
  it("Correctly formats the Plotly.restyle update object", () => {
    const visibleLabels = new Set(["orange", "apple"]);
    const plotlyParams: any = {
      layout: {
        annotations: [
          { badKey: "pear", x: 1, visible: true }, // should ignore this
          { selectToLabelAnnotationKey: "orange", x: 2, visible: true }, // this should be included in the update even though it is already true
          { selectToLabelAnnotationKey: "cherry", x: 3 }, // this should be set to false
          { selectToLabelAnnotationKey: "apple", x: 3 }, // this should be set to true
        ],
      },
    };
    const expectedUpdate = {
      "annotations[1].visible": true,
      "annotations[2].visible": false,
      "annotations[3].visible": true,
    };
    expect(utils.getPlotlyRestyleUpdate(visibleLabels, plotlyParams)).toEqual(
      expectedUpdate
    );
  });
});
