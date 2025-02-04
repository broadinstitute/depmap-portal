import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Accordion, OpenCloseSymbol } from "@depmap/common-components";
import styles from "../styles/ContextExplorer.scss";
import {
  ContextNameInfo,
  ContextNode,
  ContextTree,
  TabTypes,
} from "../models/types";

export interface RefineContextTreeProps {
  topContextNameInfo: ContextNameInfo;
  selectedContextName: string;
  contextTrees: { [key: string]: ContextTree };
  onRefineYourContext: (node: ContextNode, tree: ContextTree) => void;
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
  const [selectedTree, setSelectedTree] = useState<ContextTree>();
  const [hasSmallContext, setHasSmallContext] = useState<boolean>(false);

  useEffect(() => {
    if (contextTrees && topContextNameInfo) {
      setSelectedTree(contextTrees[topContextNameInfo.name]);
    }
  }, [contextTrees, topContextNameInfo]);

  useEffect(() => {
    if (selectedTree) {
      for (let index = 0; index < selectedTree.children.length; index++) {
        const node = selectedTree.children[index];
        if (selectedTab === TabTypes.GeneDependency) {
          if (!node.has_gene_dep_data) {
            setHasSmallContext(true);
            break;
          }
        } else if (selectedTab === TabTypes.DrugSensitivity) {
          if (!node.has_drug_data) {
            setHasSmallContext(true);
            break;
          }
        }
        setHasSmallContext(false);
      }
    }
  }, [selectedTree, selectedTab]);

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
                  key={topContextNameInfo.display_name}
                  onClick={() => {
                    onRefineYourContext(selectedTree.root, selectedTree);
                  }}
                  value={selectedTree.root.depmap_ids}
                >
                  {" "}
                  <span
                    style={
                      selectedContextName === topContextNameInfo.display_name
                        ? { fontWeight: "bold" }
                        : { fontWeight: "normal" }
                    }
                  >
                    {topContextNameInfo.display_name} (
                    {selectedTree.children.length})
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
                  value={node.depmap_ids}
                >
                  <p
                    style={
                      selectedContextName === node.display_name
                        ? { fontWeight: "bold" }
                        : { fontWeight: "normal" }
                    }
                  >
                    <span>
                      {node.display_name}
                      {((selectedTab === TabTypes.GeneDependency &&
                        !node.has_gene_dep_data) ||
                        (selectedTab === TabTypes.DrugSensitivity &&
                          !node.has_drug_data)) && (
                        <span
                          style={{ color: "#994299", marginLeft: "3px" }}
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
        {hasSmallContext &&
          topContextNameInfo.name !== "All" &&
          (selectedTab === TabTypes.GeneDependency ||
            selectedTab === TabTypes.DrugSensitivity) && (
            <p style={{ marginTop: "15px" }}>
              <span
                style={{ color: "#994299" }}
                className="glyphicon glyphicon-exclamation-sign"
              />{" "}
              <i>
                Context is too small to compute{" "}
                {selectedTab === TabTypes.GeneDependency
                  ? "gene dependency"
                  : "drug sensitivity"}{" "}
                results.
              </i>
            </p>
          )}
      </div>
    </div>
  );
};
