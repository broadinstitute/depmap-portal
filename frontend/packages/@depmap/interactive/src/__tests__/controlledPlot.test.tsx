/**
 * @jest-environment jsdom
 */

import * as React from "react";
import { shallow } from "enzyme";
import { withContext } from "shallow-with-context";
import {
  ControlledPlot,
  ControlledPlotApi,
} from "../components/ControlledPlot";
import { CellLineSelectorLines } from "@depmap/cell-line-selector";

import { enabledFeatures } from "@depmap/globals";

(window as any).enabledFeaturesOverrides.data_explorer_2 = true;
(window as any).enabledFeaturesOverrides.precomputed_associations = true;
(window as any).enabledFeaturesOverrides.use_taiga_urls = true;

const defaultMockDapi: Partial<ControlledPlotApi> = {
  getDatasets: () => {
    return Promise.resolve([{ label: "label", value: "value" }]);
  },

  getAssociations: () => Promise.resolve([] as any),

  getCellLineSelectorLines: () => {
    return new Promise<CellLineSelectorLines>(() => {
      return {
        data: [],
        cols: [],
      };
    });
  },
};

let mockDapi: any;
let mockGetVectorCatalogOptions: any;
let getSelectedCellLineListName: any = () => "None";

beforeEach(() => {
  // when no props are provided, these endpoints are hit in the shallow rendering of ControlledPlot
  mockGetVectorCatalogOptions = jest.fn();
  mockGetVectorCatalogOptions.mockResolvedValue({
    children: [],
    type: "static",
    placeholder: "",
    persistSelectedIfNotFound: false,
  });

  mockDapi = {
    ...defaultMockDapi,
    getFeaturePlot: () =>
      Promise.resolve({
        linreg_by_group: [],
        depmap_ids: [],
        features: [],
        group_by: "",
        groups: [],
      }),
  };
});

describe("onAssociationViewClick", () => {
  it("should update state on y, ask for the path, and ask for new points", () => {
    // does not currently test that dropdowns have been set on the vectorcatalog, see pivotal #164644597
    const mockGetFeaturePlot = jest.fn();
    mockGetFeaturePlot.mockResolvedValue({
      plotFeatures: null,
    });
    mockDapi = {
      ...defaultMockDapi,
      getFeaturePlot: mockGetFeaturePlot,
    };

    const mockGetVectorCatalogPath = jest.fn();
    mockGetVectorCatalogPath.mockResolvedValue([]);

    const context = {
      getApi: () => mockDapi,
      getVectorCatalogApi: () => ({
        getVectorCatalogPath: mockGetVectorCatalogPath,
        getVectorCatalogOptions: mockGetVectorCatalogOptions,
      }),
    };

    // See https://github.com/enzymejs/enzyme/issues/1908#issuecomment-565565385
    const ControlledPlotWithContext = withContext(ControlledPlot, context);

    const controlledPlot = shallow(
      <ControlledPlotWithContext showCustomAnalysis />,
      { context }
    );

    controlledPlot.instance().vectorCatalogs = {
      x: { setDropdownsState: () => {}, state: { dropdowns: [] } },
      y: { setDropdownsState: () => {}, state: { dropdowns: [] } },
    };

    expect(controlledPlot.instance().state.y).toEqual({
      id: "",
      isDisabled: false,
      links: [],
    });

    controlledPlot.instance().onAssociationViewClick("y_id");

    expect(controlledPlot.instance().state.y.id).toEqual("y_id");
    expect(mockGetFeaturePlot).toHaveBeenCalled();
    expect(mockGetVectorCatalogPath).toHaveBeenCalled();
  });
});

describe("overrideExists", () => {
  it("correctly returns whether there is any override, agnostic of override property names", () => {
    const context = {
      getApi: () => mockDapi,
      getVectorCatalogApi: () => ({
        getVectorCatalogOptions: mockGetVectorCatalogOptions,
      }),
    };

    // See https://github.com/enzymejs/enzyme/issues/1908#issuecomment-565565385
    const ControlledPlotWithContext = withContext(ControlledPlot, context);

    const controlledPlot = shallow(
      <ControlledPlotWithContext showCustomAnalysis />,
      { context }
    ).instance() as any;

    controlledPlot.setState({
      override: {
        color: "",
        filter: null,
        some_property: "old filter id",
      },
    });
    expect(controlledPlot.overrideExists()).toEqual(true);

    controlledPlot.setState({
      override: {
        color: "",
        filter: null,
      },
    });
    expect(controlledPlot.overrideExists()).toEqual(false);
  });
});

describe("getSectionId", () => {
  it("should work for sections with and without overrides, and respond with the normal state.section unless a state.overrides.section is set", () => {
    const context = {
      getApi: () => mockDapi,
      getVectorCatalogApi: () => ({
        getVectorCatalogOptions: mockGetVectorCatalogOptions,
      }),
    };

    // See https://github.com/enzymejs/enzyme/issues/1908#issuecomment-565565385
    const ControlledPlotWithContext = withContext(ControlledPlot, context);

    const controlledPlot = shallow(
      <ControlledPlotWithContext showCustomAnalysis />,
      { context }
    ).instance() as any;

    const state = {
      x: {
        id: "x id", // no override available
        links: [] as any,
      },
      color: {
        id: "should be overriden",
        links: [] as any,
      },
      filter: {
        id: "filter id",
        links: [] as any,
      },
      override: {
        color: "overriden color id",
        filter: "",
      },
    };

    // check that we are indeed testing a case with no override available, as an indicator if we ever give x an override
    expect(
      Object.prototype.hasOwnProperty.call(
        controlledPlot.state.override.hasOwnProperty,
        "x"
      )
    ).toBe(false);
    // check that the above statement works
    expect(
      Object.prototype.hasOwnProperty.call(
        controlledPlot.state.override,
        "color"
      )
    ).toBe(true);

    controlledPlot.setState(state);
    expect(controlledPlot.getSectionId("x")).toEqual("x id");
    expect(controlledPlot.getSectionId("color")).toEqual("overriden color id");
    expect(controlledPlot.getSectionId("filter")).toEqual("filter id");

    const stateNullOverride = {
      override: {
        color: "overriden color id",
        filter: null,
      } as any,
    };
    controlledPlot.setState(stateNullOverride);
    expect(controlledPlot.state.override.filter).toEqual(null);
    expect(controlledPlot.getSectionId("filter")).toEqual("filter id");
  });
});
