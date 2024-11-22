import {
  deleteSpecificQueryParams,
  setQueryStringWithoutPageReload,
} from "@depmap/utils";
import update from "immutability-helper";
import qs from "qs";
import React, { useCallback, useEffect, useState } from "react";
import { getDapi } from "src/common/utilities/context";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import {
  ContextNameInfo,
  ContextNode,
  ContextSummary,
  ContextExplorerTree,
  TabTypes,
} from "../models/types";
import styles from "../styles/ContextExplorer.scss";
import {
  ALL_SEARCH_OPTION,
  getSelectionInfo,
  getSelectedContextNode,
} from "../utils";
import ContextExplorerTabs from "./ContextExplorerTabs";
import LineageSearch from "./LineageSearch";

export const ContextExplorer = () => {
  const [searchOptions, setSearchOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [contextTrees, setContextTrees] = useState<{
    [key: string]: ContextExplorerTree;
  }>();
  const [allContextData, setAllContextData] = useState<ContextSummary>({
    all_depmap_ids: [],
    data_types: [],
    values: [],
  });

  const [overviewTableData, setOverviewTableData] = useState<
    { [key: string]: string | boolean }[]
  >([]);
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [contextPath, setContextPath] = useState<string[] | null>(null);
  const [checkedDatatypes, setCheckedDatatypes] = useState<Set<string>>(
    new Set()
  );
  const [selectedTab, setSelectedTab] = useState<TabTypes | null>(null);

  const dapi = getDapi();

  const { selectedContextNode, topContextNameInfo } = getSelectedContextNode(
    contextTrees,
    contextPath
  );

  const {
    selectedContextNameInfo,
    selectedContextData,
    checkedDataValues,
    overlappingDepmapIds,
  } = getSelectionInfo(allContextData, selectedContextNode, checkedDatatypes);

  useEffect(() => {
    (async () => {
      // A list of Lineage trees. The search options should be the root element of
      // each tree, which will always be at list index 0
      setPlotElement(null);
      const contextInfo = await dapi.getContextExplorerContextInfo();

      const options = contextInfo.search_options as ContextNameInfo[];
      options.unshift(ALL_SEARCH_OPTION);
      setSearchOptions(
        options.map((option) => {
          return { value: option.subtype_code, label: option.name };
        })
      );

      const trees = contextInfo.trees;
      setContextTrees(trees);

      setOverviewTableData(contextInfo.table_data);

      const contextData = await dapi.getContextDataAvailability();
      const params = qs.parse(window.location.search.substr(1));
      setAllContextData(contextData);

      if (params.context) {
        const selectedSubtypeCode = params.context!.toString();
        const context = await dapi.getContextPath(selectedSubtypeCode);
        setContextPath(context);
      }
    })();
  }, [dapi]);

  const updateDatatypeSelection = useCallback(
    (clicked: string) => {
      let newSelectedDatatypes: Set<string>;

      if (checkedDatatypes.has(clicked)) {
        newSelectedDatatypes = update(checkedDatatypes, {
          $remove: [clicked],
        });
      } else {
        newSelectedDatatypes = update(checkedDatatypes, {
          $add: [clicked],
        });
      }
      setCheckedDatatypes(newSelectedDatatypes);
    },
    [checkedDatatypes]
  );

  const onRefineYourContext = useCallback(
    async (
      contextNode: ContextNode | null,
      contextTree: ContextExplorerTree | null
    ) => {
      deleteSpecificQueryParams(["context"]);

      if (allContextData && contextNode && contextTree) {
        const context = await dapi.getContextPath(contextNode.subtype_code);
        setContextPath(context);

        setQueryStringWithoutPageReload("context", contextNode.subtype_code);
      } else {
        setContextPath(null);
      }
    },
    [allContextData]
  );

  const cellLineUrlRoot = useCallback(() => dapi.getCellLineUrlRoot(), [dapi]);

  const customInfoImg = (
    <img
      style={{
        height: "13px",
        margin: "1px 3px 4px 3px",
        cursor: "pointer",
      }}
      src={getDapi()._getFileUrl("/static/img/gene_overview/info_purple.svg")}
      alt="description of term"
      className="icon"
    />
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>
          <span>Context Explorer</span>
        </h1>
        <p>
          The Context Explorer displays gene dependencies and drug sensitivities
          that are selective to the context of interest, in addition to showing
          available data for cell lines in that context.
        </p>
      </header>
      <main className={styles.main}>
        <div className={styles.filters}>
          {searchOptions && contextTrees && (
            <LineageSearch
              searchOptions={searchOptions}
              contextTrees={contextTrees}
              onRefineYourContext={onRefineYourContext}
              topContextNameInfo={topContextNameInfo}
              selectedContextNode={selectedContextNode!}
              selectedTab={selectedTab}
              customInfoImg={customInfoImg}
            />
          )}
        </div>
        <section className={styles.tabContents}>
          <ContextExplorerTabs
            topContextNameInfo={topContextNameInfo}
            selectedContextNameInfo={selectedContextNameInfo}
            selectedContextData={selectedContextData}
            checkedDataValues={checkedDataValues}
            checkedDatatypes={checkedDatatypes}
            updateDatatypeSelection={updateDatatypeSelection}
            overlappingDepmapIds={overlappingDepmapIds}
            overviewTableData={overviewTableData}
            getCellLineUrlRoot={cellLineUrlRoot}
            handleSetSelectedTab={setSelectedTab}
            customInfoImg={customInfoImg}
            handleSetPlotElement={(element: ExtendedPlotType | null) => {
              if (selectedContextData) {
                setPlotElement(element);
              }
            }}
            plotElement={plotElement}
          />
        </section>
      </main>
    </div>
  );
};

export default ContextExplorer;
