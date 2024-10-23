import * as React from "react";
import { useMemo } from "react";
import { PanelGroup } from "react-bootstrap";
import { useLocation } from "react-router-dom";
import styles from "src/resources/styles/ResourcesPage.scss";
import { Subcategory, Topic } from "../models/Category";
import SubcategoryPanel from "./SubcategoryPanel";

interface ResourcesPageProps {
  subcategories: Subcategory[];
  defaultTopic: Topic | null;
}

// A custom hook that builds on useLocation to parse
// the query string for you. (See: https://v5.reactrouter.com/web/example/query-parameters)
function useQuery() {
  const { search } = useLocation();

  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResourcesPage(props: ResourcesPageProps) {
  const { subcategories, defaultTopic } = props;
  const query = useQuery();
  const querySubcategory = query.get("subcategory");

  // If window location url has query params at the start, find the post to show
  const initOrSelectedPost = useMemo(() => {
    const subcategory = subcategories.find(
      (sub: Subcategory) => sub.slug === query.get("subcategory")
    );
    let post;
    if (subcategory) {
      const topic = subcategory.topics.find(
        (t: Topic) => t.slug === query.get("topic")
      );
      post = topic;
    } else {
      post = defaultTopic;
    }
    return post;
  }, [subcategories, query, defaultTopic]);

  return (
    <div className={styles.ResourcesPageContainer}>
      <div className={styles.resourcesPageHeader}>
        <h1>Depmap Resources</h1>
        <h3>
          Browse resource categories for information and frequently asked
          questions
        </h3>
      </div>

      <section className={styles.postsNavList}>
        <PanelGroup>
          {subcategories.map((subcategory: Subcategory) => {
            let isDefaultExpandedSubcategory: boolean;
            if (querySubcategory) {
              isDefaultExpandedSubcategory =
                subcategory.slug === querySubcategory;
            } else {
              isDefaultExpandedSubcategory = !!subcategory.topics.find(
                (t: Topic) => t.slug === defaultTopic?.slug
              );
            }

            return (
              <SubcategoryPanel
                key={subcategory.id}
                subcategory={subcategory}
                isDefaultExpandedSubcategory={isDefaultExpandedSubcategory}
                selectedTopic={initOrSelectedPost}
              />
            );
          })}
        </PanelGroup>
      </section>
      <section className={styles.postContentContainer}>
        {initOrSelectedPost ? (
          <div className={styles.postContent}>
            <div className={styles.postDate}>
              <p>Posted: {initOrSelectedPost.creation_date}</p>
              <p>Updated: {initOrSelectedPost.update_date}</p>
            </div>
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{
                __html: initOrSelectedPost.post_content,
              }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
