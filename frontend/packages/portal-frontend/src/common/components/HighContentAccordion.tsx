import { Panel, PanelGroup } from "react-bootstrap";
import React, { useCallback, useState } from "react";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { FeatureInfo } from "src/predictabilityPrototype/models/types";

interface HighContentAccordionProps {
  title: string;
  childMeta: {
    identifier: string; // for fetching the data
    headerContent: React.JSX.Element;
    parentName: string;
  }[];
  getContent: (
    childMeta: any,
    modelName: string,
    index: number,
    data?: any
  ) => Promise<{
    bodyContent: React.JSX.Element;
  }>;
  data?: any;
}

export const HighContentAccordion = ({
  title,
  getContent,
  childMeta,
  data = undefined,
}: HighContentAccordionProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleItemClick = (index: number) => {
    console.log(index);
    setActiveIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  const [content, setContent] = useState<{
    bodyContent: React.JSX.Element;
  } | null>(null);

  return (
    <div>
      {childMeta && (
        <PanelGroup
          accordion
          id="accordion-example"
          onSelect={(index) => handleItemClick(index)}
          activeKey={activeIndex}
        >
          {childMeta &&
            childMeta.map((child, index) => (
              <Panel
                eventKey={index}
                onClick={async () => {
                  const modelName =
                    child.parentName !== ""
                      ? child.parentName
                      : child.identifier;
                  const newContent = await getContent(
                    child,
                    modelName,
                    index,
                    data
                  );
                  setContent(newContent);
                }}
                key={title ? `${index}${title}` : index}
              >
                <Panel.Heading>
                  <Panel.Title toggle>
                    <div>{child.headerContent}</div>
                  </Panel.Title>
                </Panel.Heading>
                <Panel.Body collapsible>
                  {!content && <PlotSpinner />}
                  {content && <div>{content.bodyContent}</div>}
                </Panel.Body>
              </Panel>
            ))}
        </PanelGroup>
      )}
    </div>
  );
};
