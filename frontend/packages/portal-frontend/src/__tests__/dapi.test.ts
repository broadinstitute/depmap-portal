// this file must be in a __tests__ folder in order to be recognized as a test to run
import { mockDapi } from "src/common/utilities/mockUtils";
import { getDapi } from "src/common/utilities/context";

describe("a test of mocking", () => {
  test("we can mock getAssociations", () => {
    const mockGetAssociations = jest.fn();
    mockGetAssociations.mockResolvedValue({
      data: [
        {
          other_entity_label: "other_entity",
          other_dataset: "other_dataset",
          other_dataset_name: "other_dataset_name",
          correlation: 0.9,
          p_value: 1e-3,
          z_score: 1,
        },
      ],
      checkboxes: [
        {
          label: "label",
          name: "name",
        },
      ],
      datasetLabel: "dataset label",
      featureLabel: "feature label",
    });

    mockDapi({ getAssociations: mockGetAssociations });

    return getDapi()
      .getAssociations("feature")
      .then((payload) => {
        expect(payload.data.length).toEqual(1);
        expect(payload.checkboxes).toEqual([
          {
            label: "label",
            name: "name",
          },
        ]);
        expect(payload.datasetLabel).toEqual("dataset label");
        expect(payload.featureLabel).toEqual("feature label");
      });
  });

  test("mocks are reset between tests", () => {
    expect(() => getDapi().getAssociations("feature")).toThrow(
      "getDapi has not been mocked"
    );
  });
});
