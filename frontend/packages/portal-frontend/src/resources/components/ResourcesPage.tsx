import * as React from "react";
import { useMemo, useCallback, useState } from "react";
import { ListGroup, ListGroupItem } from "react-bootstrap";
import { Accordion } from "@depmap/interactive";
import { Link, useLocation } from "react-router-dom";
import styles from "src/resources/styles/ResourcesPage.scss";
// import { CollapsiblePanel } from "src/dataPage/components/CollapsiblePanel";

interface ResourcesPageProps {
  subcategories: any;
  defaultTopic: any;
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
  // the subcategory url query param value when the Resources Page is first rendered
  const [initSubcategory] = useState(query.get("subcategory"));

  // If window location url has query params, find the corresponding post to show. If there are no query params, show the default post
  const postToShow = useMemo(() => {
    const subcategory = subcategories.find(
      (sub: any) => sub.slug === query.get("subcategory")
    );
    let post;
    if (subcategory) {
      const topic = subcategory.topics.find(
        (t: any) => t.slug === query.get("topic")
      );
      post = topic;
    } else {
      post = defaultTopic;
    }
    return post;
  }, [subcategories, query, defaultTopic]);

  // Determines whether the accordion for the subcategory should be open. The default state is undefined
  const subcategoryIsOpen = useCallback(
    (subcategory: any) => {
      const welcomeTopic = subcategory.topics.find(
        (topic: any) => defaultTopic.id === topic.id
      );
      // when there are no url query params, this means the default welcome post should be shown. Open accordion for the subcategory of that topic
      if (query.get("subcategory") === null) {
        if (welcomeTopic) {
          return true;
        }

        return undefined;
      }
      // eslint-disable-next-line no-else-return
      else {
        const selectedTopic = subcategory.topics.find(
          (topic: any) => postToShow.id === topic.id
        );
        // Open the accordion for the post that matches the initial url query params at time of component's render
        if (selectedTopic && initSubcategory === subcategory.slug) {
          return true;
        }
        return undefined;
      }
    },
    [defaultTopic.id, postToShow.id, initSubcategory, query]
  );

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
        {subcategories.map((subcategory: any) => {
          return (
            <Accordion
              key={subcategory.id}
              title={subcategory.title}
              isOpen={subcategoryIsOpen(subcategory)}
            >
              <ListGroup style={{ marginBottom: 0, borderRadius: 0 }}>
                {subcategory.topics.map((topic: any) => {
                  return (
                    <Link
                      key={topic.id}
                      to={`?subcategory=${subcategory.slug}&topic=${topic.slug}`}
                      state={{ postHtml: topic }}
                      style={{ textDecoration: "none" }}
                    >
                      <ListGroupItem
                        className={styles.navPostItem}
                        style={{ borderRadius: "0px" }}
                        active={
                          postToShow ? postToShow.slug === topic.slug : false
                        }
                      >
                        {topic.title}
                      </ListGroupItem>
                    </Link>
                  );
                })}
              </ListGroup>
            </Accordion>
          );
        })}
      </section>
      <section className={styles.postContentContainer}>
        {postToShow ? (
          <div className={styles.postContent}>
            <div className={styles.postDate}>
              <p>Posted: {postToShow.creation_date}</p>
              <p>Updated: {postToShow.update_date}</p>
            </div>
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: postToShow.post_content }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
