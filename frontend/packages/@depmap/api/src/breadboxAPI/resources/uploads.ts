import { UploadFileResponse } from "@depmap/types";
import { postMultipart } from "../client";

export function postFileUpload(fileArgs: { file: File | Blob }) {
  return postMultipart<UploadFileResponse>("/uploads/file/", fileArgs);
}
