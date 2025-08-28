import * as cell_line from "./resources/cell_line";
import * as celligner from "./resources/celligner";
import * as compound from "./resources/compound";
import * as constellation from "./resources/constellation";
import * as context_explorer from "./resources/context_explorer";
import * as data_page from "./resources/data_page";
import * as download from "./resources/download";
import * as entity_summary from "./resources/entity_summary";
import * as genetea from "./resources/genetea";
import * as interactive from "./resources/interactive";
import * as tda from "./resources/tda";
import * as misc from "./resources/misc";

export const legacyPortalAPI = {
  ...cell_line,
  ...celligner,
  ...compound,
  ...constellation,
  ...context_explorer,
  ...data_page,
  ...download,
  ...entity_summary,
  ...genetea,
  ...interactive,
  ...tda,
  ...misc,
};

type Api = typeof legacyPortalAPI;

(Object.keys(legacyPortalAPI) as Array<keyof Api>).forEach((name) => {
  const originalFn = legacyPortalAPI[name];

  legacyPortalAPI[name] = async (...args: Parameters<typeof originalFn>) => {
    const callSiteError = new Error(`legacyPortalAPI method "${name}" failed`);

    try {
      // @ts-expect-error 2556
      return await originalFn(...args);
    } catch (error) {
      window.console.warn(callSiteError.stack);
      throw error;
    }
  };
});

export type LegacyPortalApiResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof Api]: Api[P] extends (...args: any) => any
    ? Awaited<ReturnType<Api[P]>>
    : Api[P];
};
