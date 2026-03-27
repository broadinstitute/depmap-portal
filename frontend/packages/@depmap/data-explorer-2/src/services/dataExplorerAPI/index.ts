import * as identifiers from "./identifiers";
import * as variables from "./variables";
import * as breadboxMethods from "./breadboxMethods";

export const dataExplorerAPI = {
  ...identifiers,
  ...variables,
  ...breadboxMethods,
};

type Api = typeof dataExplorerAPI;

export type DataExplorerApiResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof Api]: Api[P] extends (...args: any) => any
    ? Awaited<ReturnType<Api[P]>>
    : Api[P];
};
