import * as React from "react";
import { useState } from "react";
import { ListGroup, ListGroupItem, Panel } from "react-bootstrap";
import { Link } from "react-router-dom";
import { CmsMenu, CmsPostSummary } from "@depmap/types";
import styles from "src/resourcesV3/styles/ResourcesV3Page.scss";
import { menuContainsPostSlug } from "src/resourcesV3/utils/menuTree";

// Only indent up to this many nesting levels (0-indexed); anything deeper
// than this just reuses the deepest level's indentation.
const MAX_INDENT_DEPTH = 3;
const INDENT_PER_DEPTH_PX = 15;

interface MenuTreeNodeProps {
  menu: CmsMenu;
  slugToPostSummary: Record<string, CmsPostSummary>;
  selectedPostSlug: string | null;
  depth?: number;
}

export default function MenuTreeNode({
  menu,
  slugToPostSummary,
  selectedPostSlug,
  depth = 0,
}: MenuTreeNodeProps) {
  const isDefaultExpanded = menuContainsPostSlug(menu, selectedPostSlug);
  const [isOpen, setIsOpen] = useState(isDefaultExpanded);
  const indentPx = Math.min(depth, MAX_INDENT_DEPTH) * INDENT_PER_DEPTH_PX;
  // Posts belong to this menu, one level deeper than its own title, so they
  // always end up indented further than the menu heading they're under.
  const postIndentPx =
    Math.min(depth + 1, MAX_INDENT_DEPTH + 1) * INDENT_PER_DEPTH_PX;

  return (
    <Panel
      eventKey={menu.slug}
      defaultExpanded={isDefaultExpanded}
      onToggle={(e) => {
        setIsOpen(e);
      }}
    >
      <Panel.Heading>
        <Panel.Toggle componentClass="div" className={styles.panelHeading}>
          <span
            className={styles.headingTitle}
            style={{ paddingLeft: indentPx }}
          >
            {menu.title}
          </span>
          <span
            className={
              isOpen ? "glyphicon glyphicon-minus" : "glyphicon glyphicon-plus"
            }
            aria-hidden="true"
            style={{
              gridArea: "glyph-symbol",
              float: "right",
              alignSelf: "center",
            }}
          />
        </Panel.Toggle>
      </Panel.Heading>
      <Panel.Collapse>
        <>
          {menu.child_menus.map((child: CmsMenu) => (
            <MenuTreeNode
              key={child.slug}
              menu={child}
              slugToPostSummary={slugToPostSummary}
              selectedPostSlug={selectedPostSlug}
              depth={depth + 1}
            />
          ))}
          <ListGroup>
            {menu.posts.map((postSlug: string) => {
              const post = slugToPostSummary[postSlug];

              if (!post) {
                return null;
              }

              return (
                <Link
                  key={postSlug}
                  to={`?menu=${menu.slug}&post=${postSlug}`}
                  style={{ textDecoration: "none", marginLeft: postIndentPx }}
                >
                  <ListGroupItem
                    className={styles.navPostItem}
                    style={{ borderRadius: "0px" }}
                    active={selectedPostSlug === postSlug}
                  >
                    {post.title}
                  </ListGroupItem>
                </Link>
              );
            })}
          </ListGroup>
        </>
      </Panel.Collapse>
    </Panel>
  );
}
