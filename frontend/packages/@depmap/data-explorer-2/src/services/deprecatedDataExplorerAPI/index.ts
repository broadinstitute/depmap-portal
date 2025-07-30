import { isBreadboxOnlyMode } from "../../isBreadboxOnlyMode";
import * as portalMethods from "./portalMethods";

if (isBreadboxOnlyMode) {
  // TODO: make all of these methods throw
  // See `createAutoFailClient` for ideas.
}

export const deprecatedDataExplorerAPI = {
  ...portalMethods,
};

type Api = typeof deprecatedDataExplorerAPI;

export type DeprecatedDataExplorerApiResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof Api]: Api[P] extends (...args: any) => any
    ? Awaited<ReturnType<Api[P]>>
    : Api[P];
};
