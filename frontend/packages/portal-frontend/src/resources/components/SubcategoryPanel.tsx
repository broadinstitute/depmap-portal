import * as React from "react";
import { useState } from "react";
import { ListGroup, ListGroupItem, Panel } from "react-bootstrap";
import { Link } from "react-router-dom";
import styles from "src/resources/styles/ResourcesPage.scss";
import { Subcategory, Topic } from "../models/Category";

/**
 * Make Panel into a controlled component so that we can keep track of each Panel's toggle state and render the correct glyphicon symbol for open/close
 */

interface SubcategoryPanelProps {
  subcategory: Subcategory;
  isDefaultExpandedSubcategory: boolean;
  selectedTopic?: Topic | null;
}

export default function SubcategoryPanel({
  subcategory,
  isDefaultExpandedSubcategory,
  selectedTopic = undefined,
}: SubcategoryPanelProps) {
  const [isOpen, setIsOpen] = useState(isDefaultExpandedSubcategory);

  return (
    <Panel
      key={subcategory.id}
      eventKey={subcategory.slug}
      defaultExpanded={isDefaultExpandedSubcategory}
      onToggle={(e) => {
        setIsOpen(e);
      }}
    >
      <Panel.Heading>
        <Panel.Toggle componentClass="div" className={styles.panelHeading}>
          <span className={styles.headingTitle}>{subcategory.title}</span>
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
        <ListGroup>
          {subcategory.topics.map((topic: Topic) => {
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
                    selectedTopic ? selectedTopic.slug === topic.slug : false
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
}
