import * as React from "react";
import { shallow } from "enzyme";
import { withContext } from "shallow-with-context";
import { VectorCatalog } from "../../components/VectorCatalog";
import { OptionsInfo, Catalog, DropdownOption } from "../../models/interactive";

describe("createDownstreamDropdowns", () => {
  it("should return dropdowns, setting selected if there is only one option, until adding a dropdown with more than one option", () => {
    const mockGetVectorCatalogOptions = (
      catalog: Catalog,
      id: string,
      prefix = ""
    ): Promise<OptionsInfo> => {
      return new Promise((resolve) => resolve(optionsB));
    };

    const context = {
      getVectorCatalogApi: () => ({
        getVectorCatalogOptions: mockGetVectorCatalogOptions,
      }),
    };

    const VectorCatalogWithContext = withContext(VectorCatalog, context);

    const catalog = shallow(
      <VectorCatalogWithContext onSelection={() => {}} initialDropdowns={[]} />,
      { context }
    );

    const optionsA: OptionsInfo = {
      children: [
        {
          label: "A", // only one option, not terminal
          id: "A",
          optionValue: "A",
          terminal: false,
          url: null,
        } as DropdownOption,
      ],
      type: "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const optionsB: OptionsInfo = {
      children: [
        {
          label: "B1", // multiple options, not terminal
          id: "B1",
          optionValue: "B1",
          terminal: false,
          url: null,
        } as DropdownOption,
        {
          label: "B2",
          id: "B2",
          optionValue: "B2",
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
        dropdownId: "root",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A",
          id: "A",
          optionValue: "A",
          terminal: false,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A",
            id: "A",
            optionValue: "A",
            terminal: false,
            url: null,
          } as DropdownOption,
        ],
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
      {
        dropdownId: "A",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "",
          id: "",
          optionValue: "",
          terminal: false,
          url: null,
        } as DropdownOption,
        options: optionsB.children,
        type: optionsB.type,
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];

    return expect(
      catalog.instance().createDownstreamDropdowns({ id: "root" }, optionsA)
    ).resolves.toEqual(expectedDropdowns);
  });

  it("should return dropdowns, setting selected if there is only one option, until the selected is terminal", () => {
    const mockGetVectorCatalogOptions = (
      catalog: Catalog,
      id: string,
      prefix = ""
    ): Promise<OptionsInfo> => {
      return new Promise((resolve) => resolve(optionsB));
    };

    const context = {
      getVectorCatalogApi: () => ({
        getVectorCatalogOptions: mockGetVectorCatalogOptions,
      }),
    };

    const VectorCatalogWithContext = withContext(VectorCatalog, context);

    const catalog = shallow(
      <VectorCatalogWithContext onSelection={() => {}} initialDropdowns={[]} />,
      { context }
    );

    const optionsA: OptionsInfo = {
      children: [
        {
          label: "A", // only one option, not terminal
          id: "A",
          optionValue: "A",
          terminal: false,
          url: null,
        } as DropdownOption,
      ],
      type: "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const optionsB: OptionsInfo = {
      children: [
        {
          label: "B", // only one option, terminal
          id: "B",
          optionValue: "B",
          terminal: true,
          url: null,
        } as DropdownOption,
      ],
      type: "static",
      placeholder: "",
      persistSelectedIfNotFound: false,
    };

    const expectedDropdowns = [
      {
        dropdownId: "root",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "A",
          id: "A",
          optionValue: "A",
          terminal: false,
          url: null,
        } as DropdownOption,
        options: [
          {
            label: "A",
            id: "A",
            optionValue: "A",
            terminal: false,
            url: null,
          } as DropdownOption,
        ],
        type: "static",
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
      {
        dropdownId: "A",
        isLoading: false,
        numInputRequests: 0,
        selected: {
          label: "B",
          id: "B",
          optionValue: "B",
          terminal: true,
          url: null,
        } as DropdownOption,
        options: optionsB.children,
        type: optionsB.type,
        placeholder: "",
        persistSelectedIfNotFound: false,
      },
    ];

    return expect(
      catalog.instance().createDownstreamDropdowns({ id: "root" }, optionsA)
    ).resolves.toEqual(expectedDropdowns);
  });
});
