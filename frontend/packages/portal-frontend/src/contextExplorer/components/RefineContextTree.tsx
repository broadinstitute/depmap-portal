import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Accordion, OpenCloseSymbol } from "@depmap/interactive";
import {
  TabsWithHistory,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "src/common/components/tabs";
import styles from "../styles/ContextExplorer.scss";
import {
  ContextNameInfo,
  ContextNode,
  ContextExplorerTree,
  TabTypes,
  ContextSelectionTabTypes,
} from "../models/types";

export interface RefineContextTreeProps {
  topContextNameInfo: ContextNameInfo;
  selectedContextNode: ContextNode;
  contextTrees: { [key: string]: ContextExplorerTree };
  onRefineYourContext: (node: ContextNode, tree: ContextExplorerTree) => void;
  selectedTab: TabTypes | null;
}

export const RefineContextTree = (
  refineContextTreeProps: RefineContextTreeProps
) => {
  const {
    topContextNameInfo,
    contextTrees,
    onRefineYourContext,
    selectedContextNode,
    selectedTab,
  } = refineContextTreeProps;
  const [selectedTree, setSelectedTree] = useState<ContextExplorerTree>();

  useEffect(() => {
    if (contextTrees && topContextNameInfo) {
      setSelectedTree(contextTrees[topContextNameInfo.subtype_code]);
    }
  }, [contextTrees, topContextNameInfo]);

  return (
    <div>
      <div className="refine_context_tree">
        {selectedTree &&
          topContextNameInfo.name !== "All" &&
          selectedTree.children.length > 0 &&
          selectedTree.children.map((primaryDiseaseNode: ContextNode) => (
            <div className={styles.treeContainer}>
              {primaryDiseaseNode.children.length == 0 && (
                <Button
                  bsStyle="link"
                  className="top_button"
                  key={primaryDiseaseNode.subtype_code}
                  onClick={() => {
                    onRefineYourContext(primaryDiseaseNode, selectedTree);
                  }}
                  value={primaryDiseaseNode.model_ids}
                >
                  <p>
                    <span>{primaryDiseaseNode.name}</span>
                  </p>
                </Button>
              )}
              {primaryDiseaseNode.children.length > 0 && (
                <Accordion
                  // isOpen={selectedContextNode === primaryDiseaseNode}
                  title={
                    <Button
                      bsStyle="link"
                      className="accordion_title_button"
                      key={primaryDiseaseNode.subtype_code}
                      onClick={() => {
                        onRefineYourContext(primaryDiseaseNode, selectedTree);
                      }}
                      value={primaryDiseaseNode.model_ids}
                    >
                      {" "}
                      <span>{primaryDiseaseNode.name}</span>
                    </Button>
                  }
                  openCloseSymbol={OpenCloseSymbol.Caret}
                  openingTransition={"max-height 0.2s ease"}
                  openCloseSymbolStyle={{
                    float: "left",
                    marginRight: "5px",
                    marginTop: "1px",
                    position: "relative",
                    lineHeight: "unset",
                  }}
                >
                  {primaryDiseaseNode.children.map(
                    (subtypeNode: ContextNode) => (
                      <Button
                        bsStyle="link"
                        className="accordion_contents"
                        key={subtypeNode.subtype_code}
                        onClick={() => {
                          onRefineYourContext(subtypeNode, selectedTree);
                        }}
                        value={subtypeNode.model_ids}
                      >
                        <p>
                          <span>{subtypeNode.name}</span>
                        </p>
                      </Button>
                    )
                  )}
                </Accordion>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};
