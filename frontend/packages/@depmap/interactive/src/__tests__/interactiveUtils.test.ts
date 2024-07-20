import { OptionsInfoSelected, Section } from "../models/interactive";
import { formatPathsToDropdowns } from "../utilities/interactiveUtils";

describe("formatPaths", () => {
  it("should match paths to their section and handle when path is null", () => {
    const paths: Array<Array<OptionsInfoSelected>> = [
      [
        {
          placeholder: "type",
          persistSelectedIfNotFound: false,
          selectedId: "x",
          type: "static",
          children: [{ id: "x", terminal: true }],
        },
      ],
      [
        {
          placeholder: "type",
          persistSelectedIfNotFound: false,
          selectedId: "y",
          type: "static",
          children: [{ id: "y", terminal: true }],
        },
      ],
      null,
    ];
    const sections: Array<Section> = ["x", "y", "color"];
    const [initialDropdowns, stateUpdates] = formatPathsToDropdowns(
      paths,
      sections
    );

    expect(initialDropdowns["x"][0].selected.id).toEqual("x");
    expect(initialDropdowns["y"][0].selected.id).toEqual("y");
    expect(initialDropdowns["color"]).toEqual([]);

    expect(stateUpdates["x"].id).toEqual({ $set: "x" });
    expect(stateUpdates["y"].id).toEqual({ $set: "y" });
    expect(stateUpdates).not.toHaveProperty("color");
  });
  it("should output objects with the expected structure", () => {
    const paths: Array<Array<OptionsInfoSelected>> = [
      [
        {
          placeholder: "type",
          persistSelectedIfNotFound: false,
          selectedId: "x_1",
          type: "static",
          children: [
            {
              terminal: false,
              label: "x_1",
              id: "x_1",
              url: null,
              optionValue: "x_1",
            },
            {
              terminal: false,
              label: "x_other",
              id: "x_other",
              url: null,
              optionValue: "x_other",
            },
          ],
        },
        {
          placeholder: "type",
          persistSelectedIfNotFound: false,
          selectedId: "x_2",
          type: "static",
          children: [
            {
              terminal: true,
              label: "x_2",
              id: "x_2",
              url: null,
              optionValue: "x_2",
            },
          ],
        },
      ],
    ];

    const expectedInitialDropdowns = {
      x: [
        {
          placeholder: "type",
          persistSelectedIfNotFound: false,
          dropdownId: "root",
          isLoading: false,
          numInputRequests: 0,
          selected: {
            terminal: false,
            label: "x_1",
            id: "x_1",
            url: null,
            optionValue: "x_1",
          },
          type: "static",
          options: [
            {
              terminal: false,
              label: "x_1",
              id: "x_1",
              url: null,
              optionValue: "x_1",
            },
            {
              terminal: false,
              label: "x_other",
              id: "x_other",
              url: null,
              optionValue: "x_other",
            },
          ],
        },
        {
          placeholder: "type",
          persistSelectedIfNotFound: false,
          dropdownId: "x_1", // id is id of the selected parent
          isLoading: false,
          numInputRequests: 0,
          selected: {
            terminal: true,
            label: "x_2",
            id: "x_2",
            url: null,
            optionValue: "x_2",
          },
          type: "static",
          options: [
            {
              terminal: true,
              label: "x_2",
              id: "x_2",
              url: null,
              optionValue: "x_2",
            },
          ],
        },
      ],
    };

    const [initialDropdowns, stateUpdates] = formatPathsToDropdowns(paths, [
      "x",
    ]);
    expect(initialDropdowns).toEqual(expectedInitialDropdowns);

    // expect stateUpdate set to the latest selected id, since it is terminal
    expect(stateUpdates["x"]["id"]).toEqual({ $set: "x_2" });
    expect(stateUpdates["x"]).toHaveProperty("links");
  });

  it("should not set id on stateUpdates if no terminal has been selected", () => {
    const paths: Array<Array<OptionsInfoSelected>> = [
      [
        {
          placeholder: "type",
          persistSelectedIfNotFound: false,
          selectedId: "x_1",
          type: "static",
          children: [
            {
              terminal: false,
              label: "x_1",
              id: "x_1",
              url: null,
              optionValue: "x_1",
            },
          ],
        },
      ],
    ];
    const [initialDropdowns, stateUpdates] = formatPathsToDropdowns(paths, [
      "x",
    ]);
    expect(stateUpdates["x"]).not.toHaveProperty("id");
    expect(stateUpdates["x"]).toHaveProperty("links");
  });

  it("should create a blank selected dropdown when the path contains an unselected dropdown", () => {
    const paths: Array<Array<OptionsInfoSelected>> = [
      [
        {
          placeholder: "type",
          persistSelectedIfNotFound: false,
          selectedId: "", // nothing selected
          type: "static",
          children: [
            {
              terminal: false,
              label: "x",
              id: "x",
              url: null,
              optionValue: "x",
            },
          ],
        },
      ],
    ];
    const [initialDropdowns, stateUpdates] = formatPathsToDropdowns(paths, [
      "x",
    ]);
    expect(initialDropdowns.x[0].selected.id).toEqual("");
    expect(initialDropdowns.x[0].selected.label).toEqual("");
  });
});
