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
  if (contextTrees && topContextNameInfo) {
    console.log(contextTrees[topContextNameInfo.subtype_code]);
  }
  return (
    <div className="disabled_refine_context_tree">
      {topContextNameInfo.name === "All" && (
        <div className={styles.treeContainerDisabled}>
          <Accordion
            title=""
            openCloseSymbol={OpenCloseSymbol.Caret}
            openCloseSymbolStyle={{
              float: "left",
              marginRight: "10px",
              position: "relative",
              top: "50%",
              lineHeight: "unset",
              color: "#58585880",
            }}
            disabled
          >
            <Button
              bsStyle="link"
              className="accordion_contents"
              value=""
              disabled
            />
          </Accordion>
        </div>
      )}{" "}
      <div className="refine_context_tree">
        {selectedTree && topContextNameInfo.name !== "All" && (
          <div className={styles.treeContainer}>
            <Accordion
              // isOpen
              title={
                <Button
                  bsStyle="link"
                  className="accordion_title_button"
                  key={topContextNameInfo.subtype_code}
                  onClick={() => {
                    onRefineYourContext(selectedTree.root, selectedTree);
                  }}
                  value={selectedTree.root.model_ids}
                >
                  {" "}
                  <span
                    style={
                      selectedContextNode.subtype_code ===
                      topContextNameInfo.subtype_code
                        ? { fontWeight: "bold" }
                        : { fontWeight: "normal" }
                    }
                  >
                    {topContextNameInfo.name}
                  </span>
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
              {selectedTree.children.length > 0 &&
                selectedTree.children.map((primaryDiseaseNode: ContextNode) => (
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
                    {primaryDiseaseNode.children.length > 0 &&
                      primaryDiseaseNode.children.map(
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
                ))}
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
};
