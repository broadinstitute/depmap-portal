import * as React from "react";
import { useMemo } from "react";
import { ListGroup, ListGroupItem, Panel, PanelGroup } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import styles from "src/resources/styles/ResourcesPage.scss";

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
  console.log(subcategories);
  const query = useQuery();
  const querySubcategory = query.get("subcategory");

  // If window location url has query params at the start, find the post to show
  const initPost = useMemo(() => {
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
          {subcategories.map((subcategory: any) => {
            let isDefaultExpandedSubcategory: boolean;
            if (querySubcategory) {
              isDefaultExpandedSubcategory =
                subcategory.slug === querySubcategory;
            } else {
              isDefaultExpandedSubcategory = !!subcategory.topics.find(
                (t: any) => t.slug === defaultTopic.slug
              );
            }

            return (
              <Panel
                key={subcategory.id}
                eventKey={subcategory.slug}
                defaultExpanded={isDefaultExpandedSubcategory}
              >
                <Panel.Heading className={styles.postHeading}>
                  <Panel.Toggle componentClass="div">
                    {subcategory.title}
                  </Panel.Toggle>
                </Panel.Heading>
                <Panel.Collapse>
                  <ListGroup>
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
                              initPost ? initPost.slug === topic.slug : false
                            }
                          >
                            {topic.title}
                          </ListGroupItem>
                        </Link>
                      );
                    })}
                  </ListGroup>
                </Panel.Collapse>
              </Panel>
            );
          })}
        </PanelGroup>
      </section>
      <section className={styles.postContentContainer}>
        {initPost ? (
          <div className={styles.postContent}>
            <div className={styles.postDate}>
              <p>Posted: {initPost.creation_date}</p>
              <p>Updated: {initPost.update_date}</p>
            </div>
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: initPost.post_content }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
