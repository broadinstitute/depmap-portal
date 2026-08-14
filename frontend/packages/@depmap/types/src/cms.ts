export interface CmsPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  content_hash: string;
  updated_at: string | null;
  created_at: string | null;
}

export type CmsPostSummary = Omit<CmsPost, "content">;

export interface CmsMenu {
  slug: string;
  title: string;
  child_menus: CmsMenu[];
  posts: string[]; // post slugs
}
