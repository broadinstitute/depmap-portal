import { getUrlPrefix, isElara } from "@depmap/globals";
import createJsonClient from "../createJsonClient";

const {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
} = createJsonClient(`${getUrlPrefix()}${isElara ? "" : "/breadbox"}`);

export {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
};
