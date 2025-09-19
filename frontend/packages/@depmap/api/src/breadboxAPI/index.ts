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

(Object.keys(breadboxAPI) as Array<keyof Api>).forEach((name) => {
  const originalFn = breadboxAPI[name];

  breadboxAPI[name] = async (...args: Parameters<typeof originalFn>) => {
    const callSiteError = new Error(`breadboxAPI method "${name}" failed`);

    try {
      // @ts-expect-error 2556
      return await originalFn(...args);
    } catch (error) {
      const lines = callSiteError.stack?.split("\n") || [];
      let stack = "";

      const occurrences = lines
        .map((line, i) => (line.includes(name) ? i : -1))
        .filter((i) => i !== -1);

      if (occurrences.length < 2) {
        stack = callSiteError.stack || "";
      } else {
        const idx = occurrences[1] + 1;
        stack = [lines[0], ...lines.slice(idx)].join("\n");
      }

      window.console.warn(stack);
      throw error;
    }
  };
});

export type BreadboxApiResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof Api]: Api[P] extends (...args: any) => any
    ? Awaited<ReturnType<Api[P]>>
    : Api[P];
};
