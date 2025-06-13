// https://jestjs.io/docs/en/configuration#setuptestframeworkscriptfile-string
// according to the docs for setupFiles, this runs before each test file

// https://jestjs.io/docs/en/jest-object.html#jestmockmodulename-factory-options
// see example creating virtual mocks, to mock modules that don't exist. for us, these are libraries that we pull in via CDNs, e.g. plotly.
import * as Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

jest.mock(
  "plotly.js",
  () => {
    // virtual mocks modules that don't exist (plotly is pulled in via a CDN). see link to docs above
  },
  { virtual: true }
);

Enzyme.configure({ adapter: new Adapter() });

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
  breadboxAPI: createApiMock(
    "Breadbox API",
    "breadboxAPI",
    breadboxApiProxyTarget
  ),

  legacyPortalAPI: new Proxy(
    {},
    {
      get(target, prop) {
        const message = [
          "*".repeat(80),
          "Some application code is trying to access the legacy Portal API",
          "from Elara! This should never happen because Elara is intended to",
          "be deployed in environments where the legacy Portal backend does",
          "not exist.",
          "",
          `Please remove any instances of legacyPortalAPI.${String(prop)}()`,
          "from the Elara codebase.",
          "*".repeat(80),
        ].join("\n");

        throw new Error(message);
      },
    }
  ),
}));

afterEach(() => {
  for (const key of Object.keys(breadboxApiProxyTarget)) {
    delete breadboxApiProxyTarget[key];
  }

  jest.resetAllMocks();
});
