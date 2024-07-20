import * as React from "react";
import { shallow } from "enzyme";
import { withContext } from "shallow-with-context";
import { VectorCatalog } from "../../components/VectorCatalog";

import {
  DropdownState,
  OptionsInfo,
  Catalog,
  DropdownOption,
} from "../../models/interactive";

describe("updateDownstreamDropdowns", () => {
  // for these tests, we return the expect statement because promises are asynchronous and we need to tell jest to wait
  // https://jestjs.io/docs/en/expect.html#resolves
  // e.g. return expect(catalog.instance().updateDownstreamDropdowns(

  // dropdowns are alphabetical (A, B, etc) and options are numerical (1, 2)

  it("should update options and select the option with a matching optionValue when such an option is available", () => {
    // should select the new A option since it has the same optionValue
    const catalog = shallow<VectorCatalog>(
      <VectorCatalog
        catalog="continuous"
        onSelection={() => {}}
        initialDropdowns={[]}
      />
    );
    const dropdownsAfterModified: Array<DropdownState> = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A1",
          id: "A1",
          optionValue: "same value",
          terminal: true,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A1",
            id: "A1",
            optionValue: "same value",
            terminal: true,
            url: null,
          } as DropdownOption,
        ],
        type: "static" as "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];

    const newOptions: OptionsInfo = {
      children: [
        {
          label: "A2",
          id: "A2",
          optionValue: "same value",
          terminal: true, // test the simple path that ends in terminal
          url: null, // test the simple path that ends in terminal
        } as DropdownOption,
      ],
      type: "static" as "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const expectedDropdowns: Array<DropdownState> = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A2",
          id: "A2",
          optionValue: "same value",
          terminal: true,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A2",
            id: "A2",
            optionValue: "same value",
            terminal: true,
            url: null,
          } as DropdownOption,
        ],
        type: "static" as "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];

    return expect(
      catalog.instance().updateDownstreamDropdowns(
        dropdownsAfterModified,
        {
          id: "someId",
          label: "some id",
          optionValue: "some other value",
          terminal: true,
          url: null,
        } as DropdownOption,
        newOptions
      )
    ).resolves.toEqual(expectedDropdowns);
  });

  it("should add dropdowns until adding an unselected dropdown with multiple options, when the newly selected option is not terminal", () => {
    const dropdownsAfterModified: Array<DropdownState> = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A1",
          id: "A1",
          optionValue: "same value",
          terminal: true,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A1",
            id: "A1",
            optionValue: "same value",
            terminal: true,
            url: null,
          } as DropdownOption,
        ],
        type: "static" as "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];

    const newOptions: OptionsInfo = {
      children: [
        {
          label: "A2",
          id: "A2",
          optionValue: "same value",
          terminal: false, // now the final is not terminal
          url: null, // now the final is not terminal
        } as DropdownOption,
      ],
      type: "static" as "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const optionsB: OptionsInfo = {
      children: [
        {
          label: "B one option",
          id: "B",
          optionValue: "B",
          terminal: false,
          url: null,
        } as DropdownOption,
      ],
      type: "static" as "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const optionsC: OptionsInfo = {
      children: [
        {
          label: "C1",
          id: "C1",
          optionValue: "C1",
          terminal: false,
          url: null,
        } as DropdownOption,
        {
          label: "C2",
          id: "C2",
          optionValue: "C2",
          terminal: false, // now the final is not terminal
          url: null, // now the final is not terminal
        } as DropdownOption,
      ],
      type: "static" as "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const mockGetVectorCatalogOptions = (
      catalog: Catalog,
      id: string,
      prefix = ""
    ): Promise<OptionsInfo> => {
      if (id == "A2") {
        return new Promise((resolve) => resolve(optionsB));
      } else {
        return new Promise((resolve) => resolve(optionsC));
      }
    };

    const context = {
      getVectorCatalogApi: () => ({
        getVectorCatalogOptions: mockGetVectorCatalogOptions,
      }),
    };

    const VectorCatalogWithContext = withContext(VectorCatalog, context);

    // Should add a B dropdown with the new options since the new A selection is not terminal
    // If this B dropdown has only one option, it should select that option and ask for the children of B's selection
    // Since C has more than one option, it just adds an unselected dropdown
    const catalog = shallow<VectorCatalog>(
      <VectorCatalogWithContext
        catalog="continuous"
        onSelection={() => {}}
        initialDropdowns={[]}
      />,
      { context }
    );

    const expectedDropdowns = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A2",
          id: "A2",
          optionValue: "same value",
          terminal: false,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A2",
            id: "A2",
            optionValue: "same value",
            terminal: false,
            url: null,
          } as DropdownOption,
        ],
        type: "static" as "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
      {
        dropdownId: "A2",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "B one option",
          id: "B",
          optionValue: "B",
          terminal: false,
          url: null,
        } as DropdownOption,
        options: optionsB.children,
        type: optionsB.type,
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
      {
        dropdownId: "B",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "",
          id: "",
          optionValue: "",
          terminal: false,
          url: null,
        } as DropdownOption,
        options: optionsC.children,
        type: optionsC.type,
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];

    return expect(
      catalog.instance().updateDownstreamDropdowns(
        dropdownsAfterModified,
        {
          id: "someId",
          label: "some id",
          optionValue: "some other value",
          terminal: true,
          url: null,
        } as DropdownOption,
        newOptions
      )
    ).resolves.toEqual(expectedDropdowns);
  });

  it("should propagate selecting existing options down for multiple children when all have still-valid options", () => {
    const dropdownsAfterModified = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A1",
          id: "A1",
          optionValue: "same value A",
          terminal: false,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A1",
            id: "A1",
            optionValue: "same value A",
            terminal: false,
            url: null,
          } as DropdownOption,
        ],
        type: "static" as "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
      {
        dropdownId: "A1",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "B1",
          id: "B1",
          optionValue: "same value B",
          terminal: true,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "B1",
            id: "B1",
            optionValue: "same value B",
            terminal: true,
            url: null,
          } as DropdownOption,
        ],
        type: "static" as "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];

    const newOptions = {
      children: [
        {
          label: "A2",
          id: "A2",
          optionValue: "same value A",
          terminal: false,
          url: null,
        } as DropdownOption,
      ],
      type: "static" as "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const optionsOfNewSelected = {
      children: [
        {
          label: "B2",
          id: "B2",
          optionValue: "same value B",
          terminal: true,
          url: null,
        } as DropdownOption,
      ],
      type: "static" as "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const mockGetVectorCatalogOptions = jest.fn();
    mockGetVectorCatalogOptions.mockResolvedValue(optionsOfNewSelected);

    const context = {
      getVectorCatalogApi: () => ({
        getVectorCatalogOptions: mockGetVectorCatalogOptions,
      }),
    };

    const VectorCatalogWithContext = withContext(VectorCatalog, context);

    // should update selection for both A and B dropdowns
    const catalog = shallow<VectorCatalog>(
      <VectorCatalogWithContext
        catalog="continuous"
        onSelection={() => {}}
        initialDropdowns={[]}
      />,
      { context }
    );

    const expectedDropdowns = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A2",
          id: "A2",
          optionValue: "same value A",
          terminal: false,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A2",
            id: "A2",
            optionValue: "same value A",
            terminal: false,
            url: null,
          } as DropdownOption,
        ],
        type: "static" as "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
      {
        dropdownId: "A2",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "B2",
          id: "B2",
          optionValue: "same value B",
          terminal: true,
          url: null,
        } as DropdownOption,
        options: optionsOfNewSelected.children,
        type: optionsOfNewSelected.type,
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];

    return expect(
      catalog
        .instance()
        .updateDownstreamDropdowns(
          dropdownsAfterModified,
          { id: "someId" },
          newOptions
        )
    ).resolves.toEqual(expectedDropdowns);
  });

  it("should truncate downstream dropdowns and clear the selection, when a selection is now invalid", () => {
    const catalog = shallow<VectorCatalog>(
      <VectorCatalog onSelection={() => {}} initialDropdowns={[]} />
    );
    const dropdownsAfterModified = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A1",
          id: "A1",
          optionValue: "A1", // different from optionValues of new options
          terminal: false,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A1",
            id: "A1",
            optionValue: "A1",
            terminal: false,
            url: null,
          } as DropdownOption,
        ],
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
      {
        dropdownId: "A1",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "B1",
          id: "B1",
          optionValue: "B1",
          terminal: true,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "B1",
            id: "B1",
            optionValue: "B1",
            terminal: true,
            url: null,
          } as DropdownOption,
        ],
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];

    const newOptions = {
      children: [
        {
          label: "A2",
          id: "A2",
          optionValue: "A2 and not A1",
          terminal: false,
          url: null,
        } as DropdownOption,
        {
          label: "A2 other option", // so that it doesn't just select the only option
          id: "A2 other option",
          optionValue: "A2 other option",
          terminal: false,
          url: null,
        } as DropdownOption,
      ],
      type: "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const expectedDropdowns = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "", // selected should be cleared
          id: "",
          optionValue: "",
          terminal: false,
          url: null,
        } as DropdownOption,
        options: newOptions.children, // should be the new A2 options
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      }, // the second option should be removed
    ];

    return expect(
      catalog
        .instance()
        .updateDownstreamDropdowns(
          dropdownsAfterModified,
          { id: "someId" },
          newOptions
        )
    ).resolves.toEqual(expectedDropdowns);
  });

  /*
   * Tests for persist selection if not found
   */
  it("should create and select a not found dropdown if persistSelectedIfNotFound is true and the selected is not found in new options", () => {
    const catalog = shallow<VectorCatalog>(
      <VectorCatalog
        catalog="continuous"
        onSelection={() => {}}
        initialDropdowns={[]}
      />
    );
    const dropdownsAfterModified = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A1",
          id: "A1",
          optionValue: "A1", // different from optionValues of new options
          terminal: false,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A1",
            id: "A1",
            optionValue: "A1",
            terminal: false,
            url: null,
          } as DropdownOption,
        ],
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: true,
      },
    ];

    const newOptions = {
      children: [
        // only one option. the not found should take precedence over one-option defaulting in updateDownstreamDropdowns (i.e. parent was changed and this already exists)
        {
          label: "A2",
          id: "A2",
          optionValue: "A2 and not A1",
          terminal: false,
          url: null,
        } as DropdownOption,
      ],
      type: "static",
      placeholder: "",
      persistSelectedIfNotFound: true,
    };

    const notFoundDropdown = {
      label: "Not found in A1",
      id: "isNotFound",
      optionValue: "A1", // value is A1. if this is true, we know it will switch correctly if future options have an option with this value, by virtue of the test "...select the option with a matching optionValue when such an option is available"
      terminal: true,
      url: null,
      isNotFound: true,
    } as DropdownOption;

    const expectedDropdowns = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: notFoundDropdown,
        options: [newOptions.children[0], notFoundDropdown], // should be the new A2 options
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: true,
      }, // the second option should be removed
    ];

    return expect(
      catalog
        .instance()
        .updateDownstreamDropdowns(
          dropdownsAfterModified,
          { id: "someId" },
          newOptions
        )
    ).resolves.toEqual(expectedDropdowns);
  });

  it("should stick with a not found dropdown if the previously selected was a not found and the optionValue is still not in the new options", () => {
    const catalog = shallow<VectorCatalog>(
      <VectorCatalog
        catalog="continuous"
        onSelection={() => {}}
        initialDropdowns={[]}
      />
    );
    const notFoundDropdown = {
      label: "Not found in A1",
      id: "isNotFound",
      optionValue: "A1",
      terminal: true,
      url: null,
      isNotFound: true,
    } as DropdownOption;

    const dropdownsAfterModified = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: notFoundDropdown,
        options: [notFoundDropdown],
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: true,
      },
    ];

    const newOptions = {
      children: [
        {
          label: "A2",
          id: "A2",
          optionValue: "A2 and not A1", // still not A1
          terminal: false,
          url: null,
        } as DropdownOption,
      ],
      type: "static",
      placeholder: "",
      persistSelectedIfNotFound: true,
    };

    const expectedDropdowns = [
      {
        dropdownId: "someId",
        isLoading: false,
        numInputRequests: 0,
        selected: notFoundDropdown,
        options: [newOptions.children[0], notFoundDropdown], // should be the new A2 options
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: true,
      }, // the second option should be removed
    ];

    return expect(
      catalog
        .instance()
        .updateDownstreamDropdowns(
          dropdownsAfterModified,
          { id: "someId" },
          newOptions
        )
    ).resolves.toEqual(expectedDropdowns);
  });
});
