import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Accordion, OpenCloseSymbol } from "@depmap/interactive";
import styles from "../styles/ContextExplorer.scss";
import {
  ContextNameInfo,
  ContextNode,
  ContextExplorerTree,
  TabTypes,
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
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                    }}
                  >
                    <div style={{ gridColumn: "1/5", textAlign: "left" }}>
                      {primaryDiseaseNode.name}{" "}
                    </div>
                    <div
                      style={{
                        gridColumn: "5/5",
                        textAlign: "end",
                        paddingRight: "24px",
                      }}
                    >
                      {primaryDiseaseNode.model_ids.length}
                    </div>
                  </div>
                </Button>
              )}
              {primaryDiseaseNode.children.length > 0 && (
                <Accordion
                  isOpen
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
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                        }}
                      >
                        <div style={{ gridColumn: "1/2", textAlign: "left" }}>
                          {primaryDiseaseNode.name}{" "}
                        </div>
                        <div style={{ gridColumn: "2/2", textAlign: "end" }}>
                          {primaryDiseaseNode.model_ids.length}
                        </div>
                      </div>
                    </Button>
                  }
                  openCloseSymbol={OpenCloseSymbol.Caret}
                  openingTransition={"max-height 0.1s ease"}
                  openCloseSymbolStyle={{
                    float: "left",
                    marginRight: "5px",
                    marginTop: "1px",
                    position: "relative",
                    lineHeight: "unset",
                    color: "#4479b2",
                  }}
                >
                  {primaryDiseaseNode.children.map(
                    (subtypeNode: ContextNode) => (
                      <Button
                        bsStyle="link"
                        className="accordion_contents"
                        key={subtypeNode.subtype_code}
                        onClick={(e) => {
                          onRefineYourContext(subtypeNode, selectedTree);
                          e.preventDefault();
                        }}
                        value={subtypeNode.model_ids}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                          }}
                        >
                          <div
                            style={{
                              gridColumn: "1/4",
                              textAlign: "left",
                              paddingLeft: "18px",
                            }}
                          >
                            {subtypeNode.name}{" "}
                          </div>
                          <div style={{ gridColumn: "4/4", textAlign: "end" }}>
                            {subtypeNode.model_ids.length}
                          </div>
                        </div>
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
