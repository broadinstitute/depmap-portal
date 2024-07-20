import * as React from "react";
import { shallow } from "enzyme";
import { VectorCatalog } from "../../components/VectorCatalog";

describe("nonterminalOnChange", () => {
  it("should not trigger onSelection if ", () => {
    // when a dropdown in the middle of list is changed and the new selected option is terminal, we get delegated into terminalOnChange
    const newSelected = {
      label: "real option",
      id: "real option",
      optionValue: "real option",
      terminal: true,
      url: null,
    };
    const firstDropdown = {
      dropdownId: "root",
      isLoading: false,
      numInputRequests: 0,
      selected: {
        label: "not found in some previous dataset",
        id: "isNotFound",
        optionValue: "some previous dataset",
        terminal: true,
        url: null,
        isNotFound: true,
      },
      options: [
        {
          label: "not found in some previous dataset",
          id: "isNotFound",
          optionValue: "some previous dataset",
          terminal: true,
          url: null,
          isNotFound: true,
        },
        newSelected,
      ],
      type: "static",
      placeholder: "",
      persistSelectedIfNotFound: true, // set to true
    };

    const initialDropdowns = [firstDropdown];
    expect(initialDropdowns[0].options.length).toEqual(2);

    const catalog = shallow(
      <VectorCatalog
        onSelection={() => {}}
        initialDropdowns={initialDropdowns}
      />
    );

    const [
      newDropdowns,
      modifiedDropdownIndex,
    ] = catalog
      .instance()
      .createDropdownsUntilAndIncludingModified(firstDropdown, newSelected);

    expect(modifiedDropdownIndex).toEqual(0);
    expect(newDropdowns[modifiedDropdownIndex].options.length).toEqual(1);
    expect(newDropdowns[modifiedDropdownIndex].options[0].id).toEqual(
      "real option"
    );
  });
});
