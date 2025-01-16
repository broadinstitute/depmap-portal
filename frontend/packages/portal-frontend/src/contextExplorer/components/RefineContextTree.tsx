import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  contextTree: ContextExplorerTree;
  onRefineYourContext: (
    node: ContextNode | null,
    tree: ContextExplorerTree,
    subtypeCode?: string
  ) => void;
  selectedTab: TabTypes | null;
}

interface ContextSelectorButtonProps {
  node: ContextNode;
  onRefineYourContext: (
    node: ContextNode | null,
    tree: ContextExplorerTree,
    subtypeCode?: string
  ) => void;
  selectedTree: ContextExplorerTree;
  fontWeight?: string;
  fontColor?: string;
}

const ContextSelectorButton = (props: ContextSelectorButtonProps) => {
  const {
    node,
    onRefineYourContext,
    selectedTree,
    fontWeight = "normal",
    fontColor = "#4479b2",
  } = props;
  return (
    <Button
      bsStyle="link"
      className="top_button"
      key={node.subtype_code}
      onClick={() => {
        onRefineYourContext(node, selectedTree);
      }}
      value={node.model_ids}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
        }}
      >
        <div
          style={{
            gridColumn: "1/5",
            textAlign: "left",
            fontWeight,
            color: fontColor,
          }}
        >
          {node.name}{" "}
        </div>
        <div
          style={{
            gridColumn: "5/5",
            textAlign: "end",
            paddingRight: "24px",
            fontWeight,
            color: fontColor,
          }}
        >
          {node.model_ids.length}
        </div>
      </div>
    </Button>
  );
};

interface ContextSelectorAccordionProps {
  node: ContextNode | null;
  onRefineYourContext: (
    node: ContextNode | null,
    tree: ContextExplorerTree,
    subtypeCode?: string
  ) => void;
  selectedTree: ContextExplorerTree;
  parentCodes: string[] | null;
}
const ContextSelectorAccordion = (props: ContextSelectorAccordionProps) => {
  const { node, onRefineYourContext, selectedTree, parentCodes } = props;
  return (
    <>
      {node && node.children.length == 0 ? (
        <ContextSelectorButton
          node={node}
          onRefineYourContext={onRefineYourContext}
          selectedTree={selectedTree}
        />
      ) : (
        <>
          {parentCodes?.map((code, i) => (
            <>
              <Button
                bsStyle="link"
                bsSize="small"
                style={{ color: "darkblue" }}
                value={code}
                onClick={() => {
                  onRefineYourContext(null, selectedTree, code);
                }}
              >
                {code}
              </Button>
              <span style={{ color: "darkblue" }}>/</span>
            </>
          ))}
          {node && (
            <Accordion
              isOpen
              title={
                <ContextSelectorButton
                  node={node}
                  onRefineYourContext={onRefineYourContext}
                  selectedTree={selectedTree}
                  fontWeight={"700"}
                  fontColor={"darkblue"}
                />
              }
              openCloseSymbol={OpenCloseSymbol.Caret}
              openingTransition={"max-height 0.1s ease"}
              openCloseSymbolStyle={{
                float: "left",
                marginRight: "5px",
                marginTop: "1px",
                position: "relative",
                lineHeight: "unset",
                color: "darkblue",
              }}
            >
              {node?.children.map((childNode: ContextNode) => (
                <ContextSelectorButton
                  node={childNode}
                  onRefineYourContext={onRefineYourContext}
                  selectedTree={selectedTree}
                  fontWeight={childNode.children.length > 0 ? "700" : "normal"}
                  fontColor={
                    childNode.children.length > 0 ? "darkblue" : undefined
                  }
                />
              ))}
            </Accordion>
          )}
        </>
      )}
    </>
  );
};

interface ThreeTieredAccordionProps {
  node: ContextNode;
  onRefineYourContext: (
    node: ContextNode | null,
    tree: ContextExplorerTree,
    subtypeCode?: string
  ) => void;
  selectedTree: ContextExplorerTree;
  topContextNameInfo: ContextNameInfo;
  parentCodes: string[] | null;
}

const ThreeTieredAccordion = (props: ThreeTieredAccordionProps) => {
  const {
    node,
    selectedTree,
    topContextNameInfo,
    onRefineYourContext,
    parentCodes,
  } = props;
  const getChildrenSortedByModelCount = useCallback(
    (children: ContextNode[]) => {
      return children.sort((a, b) => {
        if (!a.model_ids || a.model_ids.length > b.model_ids.length) {
          return -1;
        }
        if (!b.model_ids || a.model_ids.length < b.model_ids.length) {
          return 1;
        }
        return 0;
      });
    },
    []
  );

  const childrenSortedByModelCount = useMemo(() => {
    return selectedTree
      ? getChildrenSortedByModelCount(selectedTree?.children)
      : undefined;
  }, [selectedTree, getChildrenSortedByModelCount]);

  const [startingNode, setStartingNode] = useState<ContextNode | null>(null);
  useEffect(() => {
    if (parentCodes && node.children.length > 0 && node.node_level >= 2) {
      setStartingNode(node);
    } else {
      setStartingNode(null);
    }
  }, [parentCodes, node]);

  return (
    <>
      {selectedTree &&
        topContextNameInfo.name !== "All" &&
        selectedTree.children.length > 0 &&
        childrenSortedByModelCount?.map((primaryDiseaseNode: ContextNode) => (
          <div
            className={styles.treeContainer}
            key={primaryDiseaseNode.subtype_code}
          >
            {primaryDiseaseNode.children.length === 0 ? (
              <ContextSelectorButton
                node={primaryDiseaseNode}
                onRefineYourContext={onRefineYourContext}
                selectedTree={selectedTree}
              />
            ) : (
              <ContextSelectorAccordion
                node={startingNode || primaryDiseaseNode}
                onRefineYourContext={onRefineYourContext}
                selectedTree={selectedTree}
                parentCodes={parentCodes}
              />
            )}
          </div>
        ))}
    </>
  );
};

export const RefineContextTree = (
  refineContextTreeProps: RefineContextTreeProps
) => {
  const {
    topContextNameInfo,
    contextTree,
    onRefineYourContext,
    selectedContextNode,
  } = refineContextTreeProps;
  const [selectedTree, setSelectedTree] = useState<ContextExplorerTree>();

  // Only show 3 levels as a "tree". Add bread crumbs past the 3rd level.
  const [parentCodes, setParentCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (contextTree && topContextNameInfo) {
      setSelectedTree(contextTree);
    }
  }, [contextTree, topContextNameInfo, selectedContextNode]);

  useEffect(() => {
    if (
      selectedContextNode &&
      selectedContextNode.children.length > 0 &&
      selectedContextNode.node_level >= 2
    ) {
      setParentCodes(selectedContextNode.path.slice(0, -1));
    } else {
      setParentCodes(null);
    }
  }, [selectedContextNode]);

  return (
    <div>
      <div className="refine_context_tree">
        {selectedTree && (
          <ThreeTieredAccordion
            node={selectedContextNode}
            onRefineYourContext={onRefineYourContext}
            selectedTree={selectedTree}
            topContextNameInfo={topContextNameInfo}
            parentCodes={parentCodes}
          />
        )}
      </div>
    </div>
  );
};
