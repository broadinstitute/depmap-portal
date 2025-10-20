import React, { useCallback, useEffect, useState } from "react";
import qs from "qs";
import update from "immutability-helper";
import { legacyPortalAPI } from "@depmap/api";
import { toStaticUrl } from "@depmap/globals";
import { ContextInfo, ContextNode } from "@depmap/types";
import {
  deleteSpecificQueryParams,
  setQueryStringWithoutPageReload,
} from "@depmap/utils";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import {
  ContextSummary,
  DataAvailabilitySummary,
  TabTypes,
  TreeType,
} from "../models/types";
import styles from "../styles/ContextExplorer.scss";
import {
  ALL_SEARCH_OPTION,
  getSelectionInfo,
  getSelectedContextNode,
} from "../utils";
import ContextExplorerTabs from "./ContextExplorerTabs";
import LeftSearchPanel from "./LeftSearchPanel";
import { useContextExplorerContext } from "../context/ContextExplorerContext";

export const ContextExplorer = () => {
  const {
    checkedDatatypes,
    handleSetCheckedDatatypes,
  } = useContextExplorerContext();

  const [lineageSearchOptions, setLineageSearchOptions] = useState<
    { value: string; label: string; level: 0; numModels?: number }[]
  >([]);
  const [
    molecularSubtypeSearchOptions,
    setMolecularSubtypeSearchOptions,
  ] = useState<
    { value: string; label: string; level: 0; numModels?: number }[]
  >([]);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);

  const [
    allLineageContextData,
    setAllLineageContextData,
  ] = useState<DataAvailabilitySummary>({
    summary: {
      all_depmap_ids: [],
      data_types: [],
      values: [],
    },
    table: [],
  });
  const [
    allMolecularSubtypeContextData,
    setAllMolecularSubtypeContextData,
  ] = useState<DataAvailabilitySummary>({
    summary: {
      all_depmap_ids: [],
      data_types: [],
      values: [],
    },
    table: [],
  });

  const [
    contextDataAvailability,
    setContextDataAvailability,
  ] = useState<ContextSummary>({
    all_depmap_ids: [],
    data_types: [],
    values: [],
  });

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [contextPath, setContextPath] = useState<string[] | null>(null);

  const [selectedTab, setSelectedTab] = useState<TabTypes | null>(null);

  const [selectedTreeType, setSelectedTreeType] = useState<TreeType>(
    TreeType.Lineage
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { selectedContextNode, topContextNameInfo } = getSelectedContextNode(
    contextPath,
    contextInfo?.tree
  );

  const {
    selectedContextNameInfo,
    selectedContextData,
    checkedDataValues,
    overlappingDepmapIds,
  } = getSelectionInfo(
    selectedTreeType === TreeType.Lineage
      ? allLineageContextData.summary
      : allMolecularSubtypeContextData.summary,
    contextDataAvailability,
    selectedContextNode,
    checkedDatatypes
  );

  useEffect(() => {
    (async () => {
      // A list of Lineage trees. The search options should be the root element of
      // each tree, which will always be at list index 0
      setPlotElement(null);
      setIsLoading(true);
      const options = await legacyPortalAPI.getContextSearchOptions();

      options.lineage.unshift(ALL_SEARCH_OPTION);
      setLineageSearchOptions(
        options.lineage.map((option) => {
          return {
            value: option.subtype_code,
            label: option.name,
            level: 0,
            numModels: option.numModels,
          };
        })
      );
      options.molecularSubtype.unshift(ALL_SEARCH_OPTION);
      setMolecularSubtypeSearchOptions(
        options.molecularSubtype.map((option) => {
          return {
            value: option.subtype_code,
            label: option.name,
            level: 0,
            numModels: option.numModels,
          };
        })
      );

      const lineageContextData = await legacyPortalAPI.getContextDataAvailability(
        TreeType.Lineage.toString()
      );
      const molSubtypeContextData = await legacyPortalAPI.getContextDataAvailability(
        TreeType.MolecularSubtype.toString()
      );
      setAllLineageContextData(lineageContextData);
      setAllMolecularSubtypeContextData(molSubtypeContextData);

      const params = qs.parse(window.location.search.substr(1));
      if (params.context) {
        const selectedSubtypeCode = params.context!.toString();
        const context = await legacyPortalAPI.getContextPath(
          selectedSubtypeCode
        );
        const path = context.path;
        const selectedTree = context.tree_type;
        setContextPath(path);
        setSelectedTreeType(
          selectedTree === TreeType.Lineage.toString()
            ? TreeType.Lineage
            : TreeType.MolecularSubtype
        );
        const newContextInfo = await legacyPortalAPI.getContextExplorerContextInfo(
          path[0]
        );
        setContextInfo(newContextInfo);

        const dataAvail = await legacyPortalAPI.getSubtypeDataAvailability(
          path[path.length - 1]
        );

        setContextDataAvailability(dataAvail);
      } else {
        setContextPath(null);
        setContextInfo(null);
      }
      setIsLoading(false);
    })();
  }, []);

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
      handleSetCheckedDatatypes(newSelectedDatatypes);
    },
    [checkedDatatypes, handleSetCheckedDatatypes]
  );

  const onRefineYourContext = useCallback(
    async (
      contextNode: ContextNode | null,
      contextTreeRoot: ContextNode | null,
      subtypeCode?: string
    ) => {
      setIsLoading(true);
      deleteSpecificQueryParams(["context"]);
      handleSetCheckedDatatypes(new Set<string>([]));

      if (
        (allMolecularSubtypeContextData || allLineageContextData) &&
        (contextNode || subtypeCode)
      ) {
        const context = await legacyPortalAPI.getContextPath(
          contextNode?.subtype_code || subtypeCode!
        );
        const path = context.path;
        const subtypeDataAvail = await legacyPortalAPI.getSubtypeDataAvailability(
          contextNode?.subtype_code || subtypeCode!
        );

        if (
          !contextInfo ||
          (contextTreeRoot && path[0] !== contextTreeRoot.subtype_code)
        ) {
          const newContextInfo = await legacyPortalAPI.getContextExplorerContextInfo(
            path[0]
          );
          setContextInfo(newContextInfo);
        }
        setContextDataAvailability(subtypeDataAvail);
        setContextPath(path);

        setQueryStringWithoutPageReload(
          "context",
          contextNode?.subtype_code || subtypeCode!
        );
      } else {
        setContextPath(null);
        setContextInfo(null);
      }
      setIsLoading(false);
    },
    [
      allLineageContextData,
      allMolecularSubtypeContextData,
      contextInfo,
      handleSetCheckedDatatypes,
    ]
  );

  const customInfoImg = (
    <img
      style={{
        height: "13px",
        margin: "1px 3px 4px 3px",
        cursor: "pointer",
      }}
      src={toStaticUrl("img/gene_overview/info_purple.svg")}
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
          Context Explorer is a tumor subtype focused entry point to the DepMap
          data. Data availability, enriched gene dependencies, and compound
          sensitivities can be explored within a lineage- or molecular- subtype
          based hierarchy of cancer models.
        </p>
      </header>
      <main className={styles.main}>
        <div className={styles.mainContent}>
          {lineageSearchOptions &&
            molecularSubtypeSearchOptions &&
            selectedTreeType &&
            topContextNameInfo && (
              <LeftSearchPanel
                lineageSearchOptions={lineageSearchOptions}
                molecularSubtypeSearchOptions={molecularSubtypeSearchOptions}
                contextTreeRoot={contextInfo?.tree || null}
                onRefineYourContext={onRefineYourContext}
                topContextNameInfo={topContextNameInfo}
                selectedContextNode={selectedContextNode!}
                selectedTab={selectedTab}
                customInfoImg={customInfoImg}
                selectedTreeType={selectedTreeType}
                handleSetSelectedTreeType={setSelectedTreeType}
              />
            )}
          <section className={styles.tabContents}>
            {topContextNameInfo &&
              (allLineageContextData.table.length > 0 ||
                allMolecularSubtypeContextData.table.length > 0) && (
                <ContextExplorerTabs
                  isLoadingInitialData={isLoading}
                  topContextNameInfo={topContextNameInfo}
                  selectedContextNameInfo={selectedContextNameInfo}
                  selectedContextNode={selectedContextNode}
                  treeType={selectedTreeType}
                  selectedContextData={selectedContextData}
                  checkedDataValues={checkedDataValues}
                  checkedDatatypes={checkedDatatypes}
                  updateDatatypeSelection={updateDatatypeSelection}
                  overlappingDepmapIds={overlappingDepmapIds}
                  overviewTableData={
                    /* eslint-disable no-nested-ternary */
                    contextInfo
                      ? contextInfo.table_data
                      : allLineageContextData.table.length > 0
                      ? allLineageContextData.table
                      : allMolecularSubtypeContextData.table
                    /* eslint-enable no-nested-ternary */
                  }
                  getCellLineUrlRoot={legacyPortalAPI.getCellLineUrlRoot}
                  handleSetSelectedTab={setSelectedTab}
                  customInfoImg={customInfoImg}
                  handleSetPlotElement={(element: ExtendedPlotType | null) => {
                    if (selectedContextData) {
                      setPlotElement(element);
                    }
                  }}
                  plotElement={plotElement}
                />
              )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default ContextExplorer;
