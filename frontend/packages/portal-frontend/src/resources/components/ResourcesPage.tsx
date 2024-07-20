import * as React from "react";
import { useCallback, useState, useMemo } from "react";
import { Col, ListGroup, ListGroupItem } from "react-bootstrap";
import { Accordion } from "@depmap/interactive";
import { Link, useLocation } from "react-router-dom";
import styles from "src/resources/styles/ResourcesPage.scss";
// import { CollapsiblePanel } from "src/dataPage/components/CollapsiblePanel";

interface ResourcesPageProps {
  subcategories: any;
  title: string;
}

// A custom hook that builds on useLocation to parse
// the query string for you. (See: https://v5.reactrouter.com/web/example/query-parameters)
function useQuery() {
  const { search } = useLocation();

  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResourcesPage(props: ResourcesPageProps) {
  const { subcategories, title } = props;
  console.log(subcategories);
  const query = useQuery();

  // If window location url has query params at the start, find the post to show
  const initPost = useCallback(() => {
    const subcategory = subcategories.find(
      (sub: any) => sub.slug === query.get("subcategory")
    );
    let post = null;
    if (subcategory) {
      const topic = subcategory.topics.find(
        (t: any) => t.slug === query.get("topic")
      );
      post = topic;
    }
    return post;
  }, [subcategories, query]);

  const [selectedPost, setSelectedPost] = useState(initPost());

  function handleSelect(post: any) {
    // sets the post content to show on click
    setSelectedPost(post);
  }

  return (
    <div>
      <h1 style={{ marginBottom: "30px" }}>{title}</h1>
      <Col xs={12} md={4} className={styles.PostList}>
        {subcategories.map((subcategory: any) => {
          return (
            <Accordion key={subcategory.id} title={subcategory.title}>
              <ListGroup>
                {subcategory.topics.map((topic: any) => {
                  return (
                    <Link
                      key={topic.id}
                      onClick={() => handleSelect(topic)}
                      to={`?subcategory=${subcategory.slug}&topic=${topic.slug}`}
                      state={{ postHtml: topic }}
                      style={{ textDecoration: "none" }}
                    >
                      <ListGroupItem
                        style={{ borderRadius: "0px" }}
                        active={
                          selectedPost
                            ? selectedPost.slug === topic.slug
                            : false
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
        {/* {subcategories.map((subcategory: any) => {
         const topicList = (<ListGroup>
                  {subcategory.topics.map((topic: any) => {
                    return (
                        <Link
                          key={topic.id}
                          onClick={() => handleSelect(topic)}
                          to={`?subcategory=${subcategory.slug}&topic=${topic.slug}`}
                          state={{ postHtml: topic }}
                          style={{ textDecoration: "none"}}
                        >
                    <ListGroupItem>
                          {topic.title}
                </ListGroupItem>
                  </Link>
              );
            })}
          </ListGroup>)
          return <CollapsiblePanel key={subcategory.id} headerContent={subcategory.title} bodyContent={topicList} openPanelOnLoad={false} keyPrefix={subcategory.id} keySuffix={subcategory.id}/>
        })} */}
      </Col>
      <Col xs={12} md={8}>
        {selectedPost ? (
          <div className={styles.PostContent}>
            <div className={styles.postDate}>
              <p>Posted: {selectedPost.creation_date}</p>
              <p>Updated: {selectedPost.update_date}</p>
            </div>
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: selectedPost.post_content }}
            />
          </div>
        ) : null}
      </Col>
    </div>
  );
}
