import { CmsMenu } from "@depmap/types";

// Recursively searches a menu (and its descendants) for a post slug.
export function menuContainsPostSlug(
  menu: CmsMenu,
  postSlug: string | null
): boolean {
  if (!postSlug) {
    return false;
  }

  if (menu.posts.includes(postSlug)) {
    return true;
  }

  return menu.child_menus.some((child: CmsMenu) =>
    menuContainsPostSlug(child, postSlug)
  );
}
