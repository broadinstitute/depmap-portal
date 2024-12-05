import React, { useCallback, useState } from "react";
import Select, { Props as ReactSelectProps } from "react-select";
import InfoIcon from "src/common/components/InfoIcon";
import {
  Tab,
  TabPanel,
  TabPanels,
  TabsWithHistory,
} from "src/common/components/tabs";
import {
  ContextNameInfo,
  ContextNode,
  ContextExplorerTree,
  TabTypes,
  ContextSelectionTabTypes,
} from "../models/types";
import styles from "../styles/ContextExplorer.scss";
import { RefineContextTree } from "./RefineContextTree";

export interface LineageSearchProps {
  searchOptions: { value: string; label: string }[];
  contextTrees: { [key: string]: ContextExplorerTree };
  onRefineYourContext: (
    node: ContextNode | null,
    tree: ContextExplorerTree | null,
    subtypeCode?: string
  ) => void;
  topContextNameInfo: ContextNameInfo;
  selectedContextNode: ContextNode;
  selectedTab: TabTypes | null;
  customInfoImg: React.JSX.Element;
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

const LineageSearch = (lineageSearchProps: LineageSearchProps) => {
  const {
    searchOptions,
    contextTrees,
    onRefineYourContext,
    topContextNameInfo,
    selectedContextNode,
    selectedTab,
    customInfoImg,
  } = lineageSearchProps;

  const [
    selectedContextSelectionTab,
    setSelectedContextSelectionTab,
  ] = useState<ContextSelectionTabTypes | null>(0);

  const handleSetSelectedContextSelectionTab = (
    index: ContextSelectionTabTypes
  ) => {
    setSelectedContextSelectionTab(index);
  };

  return (
    <fieldset className={styles.lineageSelection}>
      <TabsWithHistory
        className={styles.Tabs}
        onChange={(index) => handleSetSelectedContextSelectionTab(index)}
        onSetInitialIndex={setSelectedContextSelectionTab}
        isManual
        isLazy
      >
        <Tab id="lineage" className={styles.Tab}>
          Lineage
        </Tab>
        <Tab id="molecularSubtype" className={styles.Tab}>
          Molecular Subtype
        </Tab>
        <section className={styles.lineageTabContents}>
          <TabPanels className={styles.TabPanels}>
            <TabPanel className={styles.TabPanel}>
              <p className={styles.pHeader}>
                Select a{" "}
                {selectedContextSelectionTab ===
                ContextSelectionTabTypes.Lineage
                  ? "Lineage"
                  : "Molecular Subtype"}
              </p>
              <Select
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
                        option.value === "All"
                          ? null
                          : contextTrees[option.value].root,
                        option.value === "All"
                          ? null
                          : contextTrees[option.value]
                      );
                    }
                  },
                  [contextTrees, onRefineYourContext]
                )}
                id="context-explorer-lineage-selection"
              />
              {topContextNameInfo.name !== "All" && searchOptions && (
                <RefineContextTree
                  topContextNameInfo={topContextNameInfo}
                  selectedContextNode={selectedContextNode}
                  contextTrees={contextTrees}
                  onRefineYourContext={onRefineYourContext}
                  selectedTab={selectedTab}
                />
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
                    In order to compare the selected context and selected
                    out-group, the Context Explorer uses a two-sided T-test to
                    compare magnitude of{" "}
                    {selectedTab === TabTypes.GeneDependency
                      ? "gene effects"
                      : "log2(viability)"}{" "}
                    <InfoIcon
                      target={customInfoImg}
                      popoverContent={
                        <p>
                          For each{" "}
                          {selectedTab === TabTypes.GeneDependency
                            ? "gene"
                            : "drug"}
                          , the mean{" "}
                          {selectedTab === TabTypes.GeneDependency
                            ? "Chronos gene effect score"
                            : "log2(viability)"}{" "}
                          of the in-context cell lines is compared to the mean{" "}
                          {selectedTab === TabTypes.GeneDependency
                            ? "Chronos gene effect score"
                            : "log2(viability)"}{" "}
                          of the out-group cell lines using Welch’s T-test. This
                          tests the null hypothesis that the two samples have
                          identical mean{" "}
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
                            {selectedTab === TabTypes.GeneDependency
                              ? "gene"
                              : "drug"}
                            , a 2x2 contingency table is created with the
                            numbers of cell lines that are{" "}
                            {selectedTab === TabTypes.GeneDependency
                              ? "dependent and non-dependent"
                              : "sensitive and non-sensitive"}{" "}
                            for both the selected context and selected
                            out-group. Fisher’s exact tests the null hypothesis
                            that the true odds ratio of the populations is one.
                            That is, the likelihood that a cell line is{" "}
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
                                Probabilities of dependency are calculated for
                                each gene score in a cell line as the
                                probability that score arises from the
                                distribution of essential gene scores rather
                                than nonessential gene scores. See{" "}
                                <a href="https://doi.org/10.1101/720243">
                                  here
                                </a>{" "}
                                for details.
                              </p>
                            </>
                          ) : (
                            <>
                              <h4 style={{ paddingTop: "5px" }}>
                                Sensitive Cell Lines
                              </h4>
                              <p>
                                A cell line is considered sensitive to a drug if
                                its fold-change viability relative to the
                                negative control (DMSO) condition is less than
                                0.3. In other words, less than 30% of cells from
                                the cell line are viable after treatment with
                                the drug.
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
                          The p-values from both the T-test and FET are
                          corrected using the False Discovery Rate (FDR, or
                          Benjamini-Hochberg method), which adjust for multiple
                          hypotheses testing.
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
                          The FET odds ratio indicates how likely it is for any
                          given cell line in the selected context to be{" "}
                          {selectedTab === TabTypes.GeneDependency
                            ? "dependent on the selected gene"
                            : "sensitive to the selected drug"}
                          . An odds ratio larger than 1 indicates that{" "}
                          {selectedTab === TabTypes.GeneDependency
                            ? "dependency on the gene"
                            : "sensitivity to the drug"}{" "}
                          is more likely in the selected context. Conversely, an
                          odds ratio less than 1 indicates that{" "}
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
              {selectedTab == TabTypes.Overview && (
                <div className={styles.overviewText}>
                  Context Explorer helps researchers see how many datasets are
                  available for their chosen tissue context type and subtype, as
                  well as showing the overlap in data. To learn more, visit{" "}
                  <a>this resource.</a>
                </div>
              )}
            </TabPanel>
            <TabPanel className={styles.TabPanel}>Tab 2</TabPanel>
          </TabPanels>
        </section>
      </TabsWithHistory>
    </fieldset>
  );
};

export default React.memo(LineageSearch);
