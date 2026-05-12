// https://jestjs.io/docs/en/configuration#setuptestframeworkscriptfile-string
// according to the docs for setupFiles, this runs before each test file

// https://jestjs.io/docs/en/jest-object.html#jestmockmodulename-factory-options
// see example creating virtual mocks, to mock modules that don't exist. for us, these are libraries that we pull in via CDNs, e.g. plotly.
declare const jest: any;
declare const afterEach: any;

import * as Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
jest.mock(
  "plotly.js",
  () => {
    // virtual mocks modules that don't exist (plotly is pulled in via a CDN). see link to docs above
  },
  { virtual: true }
);

Enzyme.configure({
  adapter: new Adapter(),
});

afterEach(() => {
  jest.resetAllMocks();
});
