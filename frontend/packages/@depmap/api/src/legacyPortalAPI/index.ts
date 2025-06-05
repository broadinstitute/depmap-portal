import * as cell_line from "./resources/cell_line";
import * as celligner from "./resources/celligner";
import * as compound from "./resources/compound";
import * as constellation from "./resources/constellation";
import * as context_explorer from "./resources/context_explorer";
import * as data_page from "./resources/data_page";
import * as download from "./resources/download";
import * as entity_summary from "./resources/entity_summary";
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
  ...interactive,
  ...tda,
  ...misc,
};

type Api = typeof legacyPortalAPI;

export type LegacyPortalApiResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof Api]: Api[P] extends (...args: any) => any
    ? Awaited<ReturnType<Api[P]>>
    : Api[P];
};
