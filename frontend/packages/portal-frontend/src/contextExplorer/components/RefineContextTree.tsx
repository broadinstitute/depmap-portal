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
  selectedContextName: string;
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
    selectedContextName,
    selectedTab,
  } = refineContextTreeProps;
  const [selectedTree, setSelectedTree] = useState<ContextExplorerTree>();

  useEffect(() => {
    if (contextTrees && topContextNameInfo) {
      setSelectedTree(contextTrees[topContextNameInfo.subtype_code]);
    }
  }, [contextTrees, topContextNameInfo]);

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
              isOpen
              title={
                <Button
                  bsStyle="link"
                  className="accordion_title_button"
                  key={topContextNameInfo.name}
                  onClick={() => {
                    onRefineYourContext(selectedTree.root, selectedTree);
                  }}
                  value={selectedTree.root.model_ids}
                >
                  {" "}
                  <span
                    style={
                      selectedContextName === topContextNameInfo.name
                        ? { fontWeight: "bold" }
                        : { fontWeight: "normal" }
                    }
                  >
                    {topContextNameInfo.name} ({selectedTree.children.length})
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
              {selectedTree.children.map((node: ContextNode) => (
                <Button
                  bsStyle="link"
                  className="accordion_contents"
                  key={node.name}
                  onClick={() => {
                    onRefineYourContext(node, selectedTree);
                  }}
                  value={node.model_ids}
                >
                  <p
                    style={
                      selectedContextName === node.name
                        ? { fontWeight: "bold" }
                        : { fontWeight: "normal" }
                    }
                  >
                    <span>
                      {node.name}
                      {((selectedTab === TabTypes.GeneDependency && false) ||
                        (selectedTab === TabTypes.DrugSensitivity &&
                          false)) && (
                        <span
                          style={{
                            color: "#994299",
                            marginLeft: "3px",
                          }}
                          className="glyphicon glyphicon-exclamation-sign"
                        />
                      )}
                    </span>
                  </p>
                </Button>
              ))}
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
};
