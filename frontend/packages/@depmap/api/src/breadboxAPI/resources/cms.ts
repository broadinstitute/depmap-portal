import { CmsMenu, CmsPost, CmsPostSummary } from "@depmap/types";
import { uri } from "../../uriTemplateTag";
import { getJson } from "../client";

export function getCmsMenu() {
  return getJson<CmsMenu[]>("/cms/menu");
}

export function getCmsPosts() {
  // include_content is omitted (defaults to false) so this returns
  // PostSummaryOut[] (no `content` field) instead of the full posts.
  return getJson<CmsPostSummary[]>("/cms/posts");
}

export function getCmsPost(postId: string) {
  return getJson<CmsPost>(uri`/cms/posts/${postId}`);
}
