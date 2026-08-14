import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { PanelGroup } from "react-bootstrap";
import { useLocation } from "react-router-dom";
import { Markdown, Spinner } from "@depmap/common-components";
import { breadboxAPI, cached } from "@depmap/api";
import { CmsMenu, CmsPost, CmsPostSummary } from "@depmap/types";
import styles from "src/resourcesV3/styles/ResourcesV3Page.scss";
import MenuTreeNode from "./MenuTreeNode";

// A custom hook that builds on useLocation to parse
// the query string for you. (See: https://v5.reactrouter.com/web/example/query-parameters)
function useQuery() {
  const { search } = useLocation();

  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResourcesV3Page() {
  const query = useQuery();
  const selectedPostSlug = query.get("post");

  const [menus, setMenus] = useState<CmsMenu[] | null>(null);
  const [postSummaries, setPostSummaries] = useState<CmsPostSummary[] | null>(
    null
  );
  const [error, setError] = useState(false);
  const [postCache, setPostCache] = useState<Record<string, CmsPost>>({});
  const [selectedPostContentLoading, setSelectedPostContentLoading] = useState(
    false
  );

  useEffect(() => {
    (async () => {
      try {
        const [menuData, postSummaryData] = await Promise.all([
          cached(breadboxAPI).getCmsMenu(),
          cached(breadboxAPI).getCmsPosts(),
        ]);
        setMenus(menuData);
        setPostSummaries(postSummaryData);
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, []);

  const slugToPostSummary = useMemo(() => {
    const map: Record<string, CmsPostSummary> = {};
    (postSummaries || []).forEach((post) => {
      map[post.slug] = post;
    });
    return map;
  }, [postSummaries]);

  const selectedPostSummary = selectedPostSlug
    ? slugToPostSummary[selectedPostSlug]
    : undefined;

  useEffect(() => {
    if (!selectedPostSummary || postCache[selectedPostSummary.id]) {
      return;
    }

    let isCurrent = true;
    setSelectedPostContentLoading(true);

    (async () => {
      try {
        const post = await cached(breadboxAPI).getCmsPost(
          selectedPostSummary.id
        );

        if (isCurrent) {
          setPostCache((prev) => ({ ...prev, [post.id]: post }));
        }
      } catch (e) {
        window.console.error(e);
        if (isCurrent) {
          setError(true);
        }
      } finally {
        if (isCurrent) {
          setSelectedPostContentLoading(false);
        }
      }
    })();

    // eslint-disable-next-line consistent-return
    return () => {
      isCurrent = false;
    };
  }, [selectedPostSummary, postCache]);

  const selectedPost = selectedPostSummary
    ? postCache[selectedPostSummary.id]
    : undefined;

  if (error) {
    return (
      <div className={styles.ResourcesV3PageContainer}>
        <p>Sorry, there was a problem loading resources.</p>
      </div>
    );
  }

  if (!menus || !postSummaries) {
    return <Spinner />;
  }

  return (
    <div className={styles.ResourcesV3PageContainer}>
      <div className={styles.resourcesPageHeader}>
        <h1>Depmap Resources</h1>
        <h3>
          Browse resource categories for information and frequently asked
          questions
        </h3>
      </div>

      <section className={styles.postsNavList}>
        <PanelGroup>
          {menus.map((menu) => (
            <MenuTreeNode
              key={menu.slug}
              menu={menu}
              slugToPostSummary={slugToPostSummary}
              selectedPostSlug={selectedPostSlug}
            />
          ))}
        </PanelGroup>
      </section>
      <section className={styles.postContentContainer}>
        {selectedPostSummary && (
          <div className={styles.postContent}>
            <div className={styles.postDate}>
              <p>Posted: {selectedPostSummary.created_at}</p>
              <p>Updated: {selectedPostSummary.updated_at}</p>
            </div>
            <h2>{selectedPostSummary.title}</h2>
            {selectedPost ? (
              <Markdown>{selectedPost.content}</Markdown>
            ) : (
              selectedPostContentLoading && <Spinner />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
