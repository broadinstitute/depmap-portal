import * as compute from "./resources/compute";
import * as data_types from "./resources/data_types";
import * as dataset_v2 from "./resources/dataset_v2";
import * as datasets from "./resources/datasets";
import * as downloads from "./resources/downloads";
import * as groups from "./resources/groups";
import * as metadata from "./resources/metadata";
import * as task from "./resources/task";
import * as temp from "./resources/temp";
import * as types from "./resources/types";
import * as uploads from "./resources/uploads";
import * as user from "./resources/user";

export const breadboxAPI = {
  ...compute,
  ...data_types,
  ...dataset_v2,
  ...datasets,
  ...downloads,
  ...groups,
  ...metadata,
  ...task,
  ...temp,
  ...types,
  ...uploads,
  ...user,
};

type Api = typeof breadboxAPI;

export type BreadboxApiResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof Api]: Api[P] extends (...args: any) => any
    ? Awaited<ReturnType<Api[P]>>
    : Api[P];
};
