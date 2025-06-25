import React, { useCallback, useEffect, useState } from "react";
import { Tabs, Tab } from "react-bootstrap";
import Select from "react-select";
import { ContextNameInfo, ContextNode } from "@depmap/types";
import InfoIcon from "src/common/components/InfoIcon";
import { TabTypes, TreeType } from "../models/types";
import styles from "../styles/ContextExplorer.scss";
import {
  GENE_DEP_BETWEEN_1_AND_2,
  GENE_DEP_END,
  GENE_DEP_TEXT_BEFORE_1_HELP_ICON,
  ONCREF_SIDEBAR_TEXT,
  OVERVIEW_SIDEBAR_TEXT,
  REPURPOSING_SIDE_BAR_TEXT,
} from "../utils";

export interface LeftSearchPanelProps {
  lineageSearchOptions: {
    value: string;
    label: string;
    level: 0;
    numModels?: number;
  }[];
  molecularSubtypeSearchOptions: {
    value: string;
    label: string;
    level: 0;
    numModels?: number;
  }[];
  contextTreeRoot: ContextNode | null;
  onRefineYourContext: (
    node: ContextNode | null,
    tree: ContextNode | null,
    subtypeCode?: string
  ) => void;
  topContextNameInfo: ContextNameInfo;
  selectedContextNode: ContextNode;
  selectedTab: TabTypes | null;
  customInfoImg: React.JSX.Element;
  selectedTreeType: TreeType;
  handleSetSelectedTreeType: (treeType: TreeType) => void;
}

export interface ContextTreeProps {
  searchOptions: {
    value: string;
    label: string;
    numModels?: number;
    level: number;
  }[];
  contextTree: ContextNode | null;
  onRefineYourContext: (
    node: ContextNode | null,
    tree: ContextNode | null,
    subtypeCode?: string
  ) => void;
  topContextNameInfo: ContextNameInfo;
  selectedContextNode: ContextNode;
  selectedTab: TabTypes | null;
  customInfoImg: React.JSX.Element;
  selectedTreeType: TreeType;
}

const customStyles: any = {
  control: (base: any) => ({
    ...base,
    borderRadius: "0px",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "0.5px solid #697CAA",
    borderTop: "0.5px solid #697CAA",
  }),
  menu: (base: any) => ({
    ...base,
  }),
};

const lowerLevelSelectCustomStyles: any = {
  control: (base: any) => ({
    ...base,
    fontSize: 12,
    alignItems: "center",
    marginLeft: 0,
    height: "50px",
  }),
  menu: (base: any) => ({
    ...base,
    minWidth: 400, // Set the desired width here
    maxWidth: 600,
    width: "fit-content",
    zIndex: 999,
    overflow: "scroll",
  }),
};

const formatOptionLabel = (
  option: {
    value: string;
    label: string;
    level: number;
    numModels?: number;
  },
  menuIsOpen: boolean
) => {
  let marginLeft = (option.level - 1) * 35;
  const numModelsStr = ` (${option.numModels})`;

  if (option.level === 0) {
    if (option.label === "All") {
      return option.label;
    }

    return (
      <span>
        <strong>{option.label}</strong> {numModelsStr}{" "}
      </span>
    );
  }
  if (!menuIsOpen) {
    marginLeft = 0;

    return (
      <div
        style={{
          overflow: "hidden",
          paddingLeft: marginLeft,
          maxWidth: "100%",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        <strong>{option.value}</strong> {numModelsStr} {option.label}
      </div>
    );
  }

  return (
    <div
      style={{
        paddingLeft: marginLeft,
        width: "100%",
        whiteSpace: "pre-wrap",
        height: "100%",
      }}
    >
      <strong>{option.value}</strong> {numModelsStr} {option.label}
    </div>
  );
};

const ContextTree = (props: ContextTreeProps) => {
  const {
    searchOptions,
    contextTree,
    onRefineYourContext,
    topContextNameInfo,
    selectedContextNode,
    selectedTab,
    customInfoImg,
    selectedTreeType,
  } = props;

  const [lowerLevelOptions, setLowerLevelOptions] = useState<
    { value: string; label: string; level: number; numModels: number }[]
  >([]);

  const handleSetLowerLevelOptions = useCallback(() => {
    if (contextTree) {
      const treeOptions: {
        value: string;
        label: string;
        level: number;
        numModels: number;
      }[] = [];

      const getOptions = (nodes: ContextNode[]) => {
        const sortedNodes = nodes.sort((a, b) =>
          a.subtype_code.localeCompare(b.subtype_code)
        );
        sortedNodes.forEach((node: ContextNode) => {
          const option = {
            value: node.subtype_code,
            label: node.name,
            level: node.node_level,
            numModels: node.model_ids.length,
          };
          treeOptions.push(option);

          if (node.children && node.children.length > 0) {
            getOptions(node.children);
          }
        });
      };

      getOptions(contextTree.children);
      setLowerLevelOptions(treeOptions);
    } else {
      setLowerLevelOptions([]);
    }
  }, [contextTree]);

  useEffect(() => {
    handleSetLowerLevelOptions();
  }, [handleSetLowerLevelOptions]);

  return (
    <>
      <p style={{ paddingTop: "25px", fontSize: "16px", fontWeight: "bold" }}>
        Select a{" "}
        {selectedTreeType === TreeType.Lineage
          ? "Lineage"
          : "Molecular Subtype"}
      </p>

      <Select
        key="lineage-or-mol-subtype-select"
        value={
          topContextNameInfo
            ? {
                value: topContextNameInfo.subtype_code,
                label: topContextNameInfo.name,
                level: topContextNameInfo.node_level,
                numModels: topContextNameInfo.numModels,
              }
            : null
        }
        styles={customStyles}
        options={searchOptions}
        formatOptionLabel={(option, { context }) =>
          formatOptionLabel(option, context === "menu")
        }
        isClearable
        onChange={useCallback(
          (option: any) => {
            if (option) {
              onRefineYourContext(
                null,
                contextTree && option.value !== "All" ? contextTree : null,
                option.value !== "All" ? option.value : null
              );
            } else {
              onRefineYourContext(null, null);
            }
          },
          [contextTree, onRefineYourContext]
        )}
        id="context-explorer-lineage-selection"
      />
      {contextTree && topContextNameInfo.name !== "All" && searchOptions && (
        <div style={{ marginTop: "25px" }}>
          <p className={styles.pSubHeader}>Refine Context</p>
          <div style={{ paddingBottom: "5px" }}>
            {selectedContextNode &&
              selectedContextNode.path &&
              selectedContextNode.path?.map((code, i) => (
                <>
                  <button
                    type="button"
                    className={styles.pseudoLink}
                    value={code}
                    onClick={() => {
                      onRefineYourContext(null, contextTree, code);
                    }}
                  >
                    {code}
                  </button>
                  {i < selectedContextNode.path.length - 1 && <span>/</span>}
                </>
              ))}
          </div>
          <Select
            key={"subtype-select"}
            placeholder={"Select a SUBTYPE CODE (model count) subtype name..."}
            isClearable
            isSearchable
            value={
              selectedContextNode && selectedContextNode.node_level !== 0
                ? {
                    value: selectedContextNode.subtype_code,
                    label: selectedContextNode.name,
                    level: selectedContextNode.node_level,
                    numModels: selectedContextNode.model_ids.length,
                  }
                : null
            }
            styles={lowerLevelSelectCustomStyles}
            options={lowerLevelOptions}
            formatOptionLabel={(option, { context }) =>
              formatOptionLabel(option, context === "menu")
            }
            onChange={(option: any) => {
              if (option) {
                onRefineYourContext(null, contextTree, option.value);
              } else {
                onRefineYourContext(
                  null,
                  contextTree,
                  topContextNameInfo.subtype_code
                );
              }
            }}
          />
        </div>
      )}
      {selectedTab === TabTypes.GeneDependency && (
        <>
          <hr
            style={{
              marginTop: "27px",
              borderTop: "1px solid #000000",
            }}
          />
          <p>
            {GENE_DEP_TEXT_BEFORE_1_HELP_ICON}
            <InfoIcon
              target={customInfoImg}
              popoverContent={
                <p>
                  A gene whose dependency has the product of skewness and
                  kurtosis in the top quartile and has at least one dependent
                  cell line.
                </p>
              }
              popoverId={`sidebar-genedep1-popover`}
              trigger={["hover", "focus"]}
            />
            {GENE_DEP_BETWEEN_1_AND_2}
            <InfoIcon
              target={customInfoImg}
              popoverContent={
                <>
                  <h4 style={{ paddingTop: "5px" }}>Dependent Cell Lines</h4>
                  <p>
                    A cell line is considered dependent if it has a probability
                    of dependency greater than 0.5.
                  </p>
                  <h4 style={{ paddingTop: "5px" }}>
                    Probability of Dependency
                  </h4>
                  <p>
                    Probabilities of dependency are calculated for each gene
                    score in a cell line as the probability that score arises
                    from the distribution of essential gene scores rather than
                    nonessential gene scores. See{" "}
                    <a href="https://doi.org/10.1101/720243">here</a> for
                    details.
                  </p>
                </>
              }
              popoverId={`sidebar-genedep2-popover`}
              trigger={["hover", "focus"]}
            />
            {GENE_DEP_END} Points are colored according to the logged odd’s
            ratio (OR) of in-group to out-group dependency; e.g. a value of 1
            indicates the gene is 10x more likely to be a dependency in the
            in-group vs. the out-group.
          </p>
        </>
      )}
      {selectedTab === TabTypes.DrugSensitivityRepurposing && (
        <>
          <hr
            style={{
              marginTop: "27px",
              borderTop: "1px solid #000000",
            }}
          />
          <p>{REPURPOSING_SIDE_BAR_TEXT}</p>
        </>
      )}
      {selectedTab === TabTypes.DrugSensitivityOncRef && (
        <>
          <hr
            style={{
              marginTop: "27px",
              borderTop: "1px solid #000000",
            }}
          />
          <p>{ONCREF_SIDEBAR_TEXT}</p>
        </>
      )}
      {selectedTab === TabTypes.Overview && (
        <div className={styles.overviewText}>{OVERVIEW_SIDEBAR_TEXT}</div>
      )}
    </>
  );
};

const LeftSearchPanel = (lineageSearchProps: LeftSearchPanelProps) => {
  const {
    lineageSearchOptions,
    molecularSubtypeSearchOptions,
    contextTreeRoot: contextTree,
    onRefineYourContext,
    topContextNameInfo,
    selectedContextNode,
    selectedTab,
    customInfoImg,
    selectedTreeType,
    handleSetSelectedTreeType,
  } = lineageSearchProps;
  return (
    <div style={{ height: "100%", gridColumn: 1 }}>
      <fieldset className={styles.lineageSelection}>
        <Tabs
          className={styles.Tabs}
          id={"context-explorer-tree-tabs"}
          activeKey={selectedTreeType}
          onSelect={(index) => {
            handleSetSelectedTreeType(index);
            onRefineYourContext(null, null);
          }}
        >
          <Tab
            id="lineage"
            eventKey={TreeType.Lineage.toString()}
            title={"Lineage"}
            className={styles.Tab}
          >
            <section
              style={{ overflow: "visible" }}
              className={styles.lineageTabContents}
            >
              <div className={styles.TabPanels}>
                <div className={styles.TabPanel}>
                  <ContextTree
                    key="lineage"
                    searchOptions={lineageSearchOptions}
                    contextTree={contextTree}
                    onRefineYourContext={onRefineYourContext}
                    topContextNameInfo={topContextNameInfo}
                    selectedContextNode={selectedContextNode}
                    selectedTab={selectedTab}
                    selectedTreeType={selectedTreeType}
                    customInfoImg={customInfoImg}
                  />
                </div>
              </div>
            </section>
          </Tab>
          <Tab
            title={"Molecular Subtype"}
            eventKey={TreeType.MolecularSubtype.toString()}
            className={styles.Tab}
          >
            <section
              style={{ overflow: "visible" }}
              className={styles.lineageTabContents}
            >
              <div className={styles.TabPanels}>
                <div className={styles.TabPanel}>
                  <ContextTree
                    key="molecularySubtype"
                    searchOptions={molecularSubtypeSearchOptions}
                    contextTree={contextTree}
                    onRefineYourContext={onRefineYourContext}
                    topContextNameInfo={topContextNameInfo}
                    selectedContextNode={selectedContextNode}
                    selectedTab={selectedTab}
                    selectedTreeType={selectedTreeType}
                    customInfoImg={customInfoImg}
                  />
                </div>
              </div>
            </section>
          </Tab>
        </Tabs>
      </fieldset>
    </div>
  );
};

export default React.memo(LeftSearchPanel);
