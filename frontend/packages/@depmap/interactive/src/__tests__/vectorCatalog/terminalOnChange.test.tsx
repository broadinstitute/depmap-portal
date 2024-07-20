import * as React from "react";
import { shallow } from "enzyme";
import { VectorCatalog } from "../../components/VectorCatalog";

describe("terminalOnChange", () => {
  it("should create a new dropdown list that is shorter than the old one, when a dropdown in the middle of the list is changed", () => {
    // when a dropdown in the middle of list is changed and the new selected option is terminal, we get delegated into terminalOnChange
    const newSelected = {
      label: "terminal",
      id: "terminal",
      optionValue: "terminal",
      terminal: true,
      url: null,
    };
    const firstDropdown = {
      dropdownId: "root",
      isLoading: false,
      numInputRequests: 0,
      selected: {
        label: "not terminal",
        id: "not terminal",
        optionValue: "not terminal",
        terminal: false,
        url: null,
      },
      options: [
        {
          label: "not terminal",
          id: "not terminal",
          optionValue: "not terminal",
          terminal: false,
          url: null,
        },
        newSelected,
      ],
      type: "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const initialDropdowns = [
      firstDropdown,
      {
        dropdownId: "not terminal",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "not terminal child",
          id: "not terminal child",
          optionValue: "not terminal child",
          terminal: true,
          url: null,
        },
        options: [
          {
            label: "not terminal child",
            id: "not terminal child",
            optionValue: "not terminal child",
            terminal: true,
            url: null,
          },
        ],
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];
    expect(initialDropdowns.length).toEqual(2);

    const catalog = shallow(
      <VectorCatalog
        onSelection={() => {}}
        initialDropdowns={initialDropdowns}
      />
    );

    catalog.instance().terminalOnChange(firstDropdown, newSelected);

    return expect(catalog.instance().state.dropdowns.length).toEqual(1);
  });
});
