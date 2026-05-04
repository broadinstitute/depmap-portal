import { getUrlPrefix, isPortal } from "@depmap/globals";
import createJsonClient from "../createJsonClient";

const {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
} = createJsonClient(`${getUrlPrefix()}${isPortal ? "/breadbox" : ""}`);

export {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
};
