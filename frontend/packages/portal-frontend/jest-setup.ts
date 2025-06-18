// https://jestjs.io/docs/en/configuration#setuptestframeworkscriptfile-string
// according to the docs for setupFiles, this runs before each test file

// https://jestjs.io/docs/en/jest-object.html#jestmockmodulename-factory-options
// see example creating virtual mocks, to mock modules that don't exist. for us, these are libraries that we pull in via CDNs, e.g. plotly.
// declare const jest: any;
// declare const beforeEach: any;
// declare const afterEach: any;

import * as Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });

jest.mock(
  "plotly.js",
  () => {
    // virtual mocks modules that don't exist (plotly is pulled in via a CDN). see link to docs above
  },
  { virtual: true }
);

const portalApiProxyTarget: Record<string | symbol, unknown> = {};
const breadboxApiProxyTarget: Record<string | symbol, unknown> = {};

const createApiMock = (
  label: string,
  importName: string,
  target: Record<string | symbol, unknown>
) => {
  return new Proxy(target, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }

      const message = [
        "-".repeat(80),
        `Some application code is trying to access the ${label} from this test.`,
        "You'll need to provide a mock response. Please add this to your test:\n",
        `  ${importName}.${String(prop)} = jest`,
        `    .fn<ReturnType<typeof ${importName}.${String(prop)}>, []>()`,
        "    .mockResolvedValue(/* some value */);",
        "",
        "(You don't need to reset the mock after the test runs. All mocks are",
        "automatically reset after each test.)",
        "-".repeat(80),
      ].join("\n");

      throw new Error(message);
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
};

jest.mock("@depmap/api", () => ({
  cached: (api: unknown) => api,

  legacyPortalAPI: createApiMock(
    "Portal API",
    "legacyPortalAPI",
    portalApiProxyTarget
  ),

  breadboxAPI: createApiMock(
    "Breadbox API",
    "breadboxAPI",
    breadboxApiProxyTarget
  ),
}));

afterEach(() => {
  for (const key of Object.keys(portalApiProxyTarget)) {
    delete portalApiProxyTarget[key];
  }

  for (const key of Object.keys(breadboxApiProxyTarget)) {
    delete breadboxApiProxyTarget[key];
  }

  jest.resetAllMocks();
});
