/* eslint-disable */
import * as React from "react";
import { SectionState, Link } from "../models/interactive";
import Accordion from "./Accordion";

interface PageLinkAccordionProps {
  sections: Array<SectionState>;
}

export class PageLinkAccordion extends React.Component<PageLinkAccordionProps> {
  render() {
    const links: Array<Link> = [];

    for (const section of this.props.sections) {
      for (const link of section.links) {
        if (link.link != null) {
          if (!links.find((e) => e.value == link.value)) {
            // only show each unique dataset/gene/etc once
            links.push(link);
          }
        }
      }
    }

    if (links.length == 0) {
      return <div />;
    }

    const linkNodes = links.map((link, index) => (
      <div key={index} className="page-link-span">
        <a href={link.link || ""} target="_blank" rel="noreferrer">
          {link.label}
        </a>
      </div>
    ));

    return (
      <div>
        <Accordion title="See pages for">{linkNodes}</Accordion>
      </div>
    );
  }
}
