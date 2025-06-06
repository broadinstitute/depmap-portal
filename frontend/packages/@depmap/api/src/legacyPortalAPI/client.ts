import { getUrlPrefix, isElara } from "@depmap/globals";
import createJsonClient from "../createJsonClient";

const createAutoFailClient = () => {
  const fail = () => {
    const stack = new Error().stack;
    let caller = "a legacy portal function";

    if (stack) {
      const lines = stack.split("\n");
      const match = lines[2].match(/at\s+(.+?)\s+\(/);
      if (match && match.length > 1) {
        caller =
          match[1]
            .replace(/Object\.\w+ \[as (\w+)\]/, "Object.$1")
            .replace("Object.", "legacyPortalAPI.") + "()";
      }
    }

    const message = [
      `${caller} is being called from Elara!`,
      "",
      "This should never happen because Elara is intended to be",
      "deployed in environments where the legacy Portal backend",
      "does not exist.",
    ].join("\n");

    throw new Error(message);
  };

  return {
    getJson: fail,
    postJson: fail,
    patchJson: fail,
    deleteJson: fail,
    postMultipart: fail,
    patchMultipart: fail,
  };
};

const {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
} = isElara ? createAutoFailClient() : createJsonClient(getUrlPrefix());

export {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
};
