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
  NODE_LEVEL_TO_QUERY_STR_MAP,
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
  const [lineageQueryParam, setLineageQueryParam] = useState<string | null>(
    null
  );
  const [primaryDiseaseQueryParam, setPrimaryDiseaseQueryParam] = useState<
    string | null
  >(null);
  const [subtypeQueryParam, setSubtypeQueryParam] = useState<string | null>(
    null
  );
  const [checkedDatatypes, setCheckedDatatypes] = useState<Set<string>>(
    new Set()
  );
  const [selectedTab, setSelectedTab] = useState<TabTypes | null>(null);

  const dapi = getDapi();

  const { selectedContextNode, topContextNameInfo } = getSelectedContextNode(
    contextTrees,
    lineageQueryParam,
    primaryDiseaseQueryParam,
    subtypeQueryParam
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

      if (params.lineage) {
        const selectedLineageName = params.lineage!.toString();
        setLineageQueryParam(selectedLineageName);

        if (params.primary_disease) {
          const selectedPrimaryDiseaseName = params.primary_disease!.toString();
          setPrimaryDiseaseQueryParam(selectedPrimaryDiseaseName);

          if (params.subtype) {
            const selectedSubtypeName = params.subtype!.toString();
            setSubtypeQueryParam(selectedSubtypeName);
          }
        }
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
    (
      contextNode: ContextNode | null,
      contextTree: ContextExplorerTree | null
    ) => {
      deleteSpecificQueryParams([
        NODE_LEVEL_TO_QUERY_STR_MAP.get(0)!,
        NODE_LEVEL_TO_QUERY_STR_MAP.get(1)!,
        NODE_LEVEL_TO_QUERY_STR_MAP.get(2)!,
      ]);

      if (allContextData && contextNode && contextTree) {
        setLineageQueryParam(contextTree.root.subtype_code);

        setPrimaryDiseaseQueryParam(null);
        setSubtypeQueryParam(null);
        setQueryStringWithoutPageReload(
          NODE_LEVEL_TO_QUERY_STR_MAP.get(0)!,
          contextTree.root.subtype_code
        );

        if (contextTree.root.subtype_code !== contextNode.subtype_code) {
          if (contextNode.node_level === 1) {
            setPrimaryDiseaseQueryParam(contextNode.subtype_code);
            setQueryStringWithoutPageReload(
              NODE_LEVEL_TO_QUERY_STR_MAP.get(1)!,
              contextNode.subtype_code
            );
            setSubtypeQueryParam(null);
          } else {
            // Has to be subtype
            setPrimaryDiseaseQueryParam(contextNode.parent_subtype_code);
            setQueryStringWithoutPageReload(
              NODE_LEVEL_TO_QUERY_STR_MAP.get(1)!,
              contextNode.parent_subtype_code
            );
            setSubtypeQueryParam(contextNode.subtype_code);
            setQueryStringWithoutPageReload(
              NODE_LEVEL_TO_QUERY_STR_MAP.get(2)!,
              contextNode.subtype_code
            );
          }
        }
      } else {
        setLineageQueryParam(null);
        setPrimaryDiseaseQueryParam(null);
        setSubtypeQueryParam(null);
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
        <section className={styles.filters}>
          {searchOptions && contextTrees && (
            <LineageSearch
              searchOptions={searchOptions}
              contextTrees={contextTrees}
              onRefineYourContext={onRefineYourContext}
              topContextNameInfo={topContextNameInfo}
              selectedContextName={selectedContextNameInfo.name}
              selectedTab={selectedTab}
              customInfoImg={customInfoImg}
            />
          )}
        </section>
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
