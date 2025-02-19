import React, { useCallback, useEffect, useState } from "react";
import { Tabs, Tab } from "react-bootstrap";
import Select, { Props as ReactSelectProps } from "react-select";
import InfoIcon from "src/common/components/InfoIcon";
import {
  ContextNameInfo,
  ContextNode,
  TabTypes,
  TreeType,
} from "../models/types";
import styles from "../styles/ContextExplorer.scss";

export interface LeftSearchPanelProps {
  lineageSearchOptions: { value: string; label: string }[];
  molecularSubtypeSearchOptions: { value: string; label: string }[];
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
  searchOptions: { value: string; label: string }[];
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

const customStyles: ReactSelectProps["styles"] = {
  control: (base) => ({
    ...base,
    borderRadius: "0px",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "0.5px solid #697CAA",
    borderTop: "0.5px solid #697CAA",
  }),
  menu: (base) => ({
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
    numModels: number;
  },
  menuIsOpen: boolean
) => {
  let marginLeft = (option.level - 1) * 35;
  const numModelsStr = ` (${option.numModels})`;
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
        value={{
          value: topContextNameInfo.subtype_code,
          label: topContextNameInfo.name,
        }}
        styles={customStyles}
        options={searchOptions}
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
      {(selectedTab === TabTypes.GeneDependency ||
        selectedTab === TabTypes.DrugSensitivityRepurposing ||
        selectedTab === TabTypes.DrugSensitivityOncRef) && (
        <>
          <hr
            style={{
              marginTop: "27px",
              borderTop: "1px solid #000000",
            }}
          />
          <p>
            In order to compare the selected context and selected out-group, the
            Context Explorer uses a two-sided T-test to compare magnitude of{" "}
            {selectedTab === TabTypes.GeneDependency
              ? "gene effects"
              : "log2(viability)"}{" "}
            <InfoIcon
              target={customInfoImg}
              popoverContent={
                <p>
                  For each{" "}
                  {selectedTab === TabTypes.GeneDependency ? "gene" : "drug"},
                  the mean{" "}
                  {selectedTab === TabTypes.GeneDependency
                    ? "Chronos gene effect score"
                    : "log2(viability)"}{" "}
                  of the in-context cell lines is compared to the mean{" "}
                  {selectedTab === TabTypes.GeneDependency
                    ? "Chronos gene effect score"
                    : "log2(viability)"}{" "}
                  of the out-group cell lines using Welch’s T-test. This tests
                  the null hypothesis that the two samples have identical mean{" "}
                  {selectedTab === TabTypes.GeneDependency
                    ? "gene effect scores"
                    : "log2(viability)"}
                  , without assuming equal population variance.{" "}
                </p>
              }
              popoverId={`sidebar-genedep1-popover`}
              trigger={["hover", "focus"]}
            />{" "}
            and a Fisher’s exact test (FET) to compare frequency of{" "}
            {selectedTab === TabTypes.GeneDependency
              ? "gene dependency"
              : "drug sensitivity"}{" "}
            <InfoIcon
              target={customInfoImg}
              popoverContent={
                <div>
                  <p>
                    For each{" "}
                    {selectedTab === TabTypes.GeneDependency ? "gene" : "drug"},
                    a 2x2 contingency table is created with the numbers of cell
                    lines that are{" "}
                    {selectedTab === TabTypes.GeneDependency
                      ? "dependent and non-dependent"
                      : "sensitive and non-sensitive"}{" "}
                    for both the selected context and selected out-group.
                    Fisher’s exact tests the null hypothesis that the true odds
                    ratio of the populations is one. That is, the likelihood
                    that a cell line is{" "}
                    {selectedTab === TabTypes.GeneDependency
                      ? "dependent on the gene"
                      : "sensitive to the drug"}{" "}
                    is the same for both populations.
                  </p>
                  {selectedTab === TabTypes.GeneDependency ? (
                    <>
                      <h4 style={{ paddingTop: "5px" }}>
                        Dependent Cell Lines
                      </h4>
                      <p>
                        A cell line is considered dependent if it has a
                        probability of dependency greater than 0.5.
                      </p>
                      <h4 style={{ paddingTop: "5px" }}>
                        Probability of Dependency
                      </h4>
                      <p>
                        Probabilities of dependency are calculated for each gene
                        score in a cell line as the probability that score
                        arises from the distribution of essential gene scores
                        rather than nonessential gene scores. See{" "}
                        <a href="https://doi.org/10.1101/720243">here</a> for
                        details.
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 style={{ paddingTop: "5px" }}>
                        Sensitive Cell Lines
                      </h4>
                      <p>
                        A cell line is considered sensitive to a drug if its
                        fold-change viability relative to the negative control
                        (DMSO) condition is less than 0.3. In other words, less
                        than 30% of cells from the cell line are viable after
                        treatment with the drug.
                      </p>
                    </>
                  )}
                </div>
              }
              popoverId={`sidebar-genedep2-popover`}
              trigger={["hover", "focus"]}
            />
            . The Explorer uses the FDR corrected p-values (q-value){" "}
            <InfoIcon
              target={customInfoImg}
              popoverContent={
                <p>
                  The p-values from both the T-test and FET are corrected using
                  the False Discovery Rate (FDR, or Benjamini-Hochberg method),
                  which adjust for multiple hypotheses testing.
                </p>
              }
              popoverId={`sidebar-genedep3-popover`}
              trigger={["hover", "focus"]}
            />{" "}
            of the T-test and the odds ratio of the FET{" "}
            <InfoIcon
              target={customInfoImg}
              popoverContent={
                <p>
                  The FET odds ratio indicates how likely it is for any given
                  cell line in the selected context to be{" "}
                  {selectedTab === TabTypes.GeneDependency
                    ? "dependent on the selected gene"
                    : "sensitive to the selected drug"}
                  . An odds ratio larger than 1 indicates that{" "}
                  {selectedTab === TabTypes.GeneDependency
                    ? "dependency on the gene"
                    : "sensitivity to the drug"}{" "}
                  is more likely in the selected context. Conversely, an odds
                  ratio less than 1 indicates that{" "}
                  {selectedTab === TabTypes.GeneDependency
                    ? "dependency on the gene"
                    : "sensitivity to the drug"}{" "}
                  is less likely in the selected context.
                </p>
              }
              popoverId={`sidebar-genedep4-popover`}
              trigger={["hover", "focus"]}
            />{" "}
            to display the results.{" "}
            {selectedTab === TabTypes.GeneDependency
              ? "This analysis only includes genes that are dependencies in three or more of all cell lines, and non-dependencies in 100 or more of all cell lines."
              : "This analysis excludes compounds that are sensitivities in 75% or more of all cell lines, or sensitivities that only occur in one or less of all cell lines."}
          </p>
        </>
      )}
      {selectedTab === TabTypes.Overview && (
        <div className={styles.overviewText}>
          Context Explorer helps researchers see how many datasets are available
          for their chosen tissue context type and subtype, as well as showing
          the overlap in data. To learn more, visit this resource.
        </div>
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
  const tabs = [TreeType.Lineage, TreeType.MolecularSubtype];
  return (
    <fieldset className={styles.lineageSelection}>
      <Tabs
        className={styles.Tabs}
        id={"context-explorer-tree-tabs"}
        activeKey={selectedTreeType}
        onSelect={(index) => {
          console.log(index);
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
  );
};

export default React.memo(LeftSearchPanel);
