import {
  deleteSpecificQueryParams,
  setQueryStringWithoutPageReload,
} from "@depmap/utils";
import update from "immutability-helper";
import qs from "qs";
import React, { useCallback, useEffect, useState } from "react";
import { toStaticUrl } from "@depmap/globals";
import { getDapi } from "src/common/utilities/context";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import {
  ContextInfo,
  ContextNode,
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

export const ContextExplorer = () => {
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
  const [checkedDatatypes, setCheckedDatatypes] = useState<Set<string>>(
    new Set()
  );
  const [selectedTab, setSelectedTab] = useState<TabTypes | null>(null);

  const [selectedTreeType, setSelectedTreeType] = useState<TreeType>(
    TreeType.Lineage
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const dapi = getDapi();

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
      const options = await dapi.getContextSearchOptions();

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

      const lineageContextData = await dapi.getContextDataAvailability(
        TreeType.Lineage.toString()
      );
      const molSubtypeContextData = await dapi.getContextDataAvailability(
        TreeType.MolecularSubtype.toString()
      );
      setAllLineageContextData(lineageContextData);
      setAllMolecularSubtypeContextData(molSubtypeContextData);

      const params = qs.parse(window.location.search.substr(1));
      if (params.context) {
        const selectedSubtypeCode = params.context!.toString();
        const context = await dapi.getContextPath(selectedSubtypeCode);
        const path = context.path;
        const selectedTree = context.tree_type;
        setContextPath(path);
        setSelectedTreeType(
          selectedTree === TreeType.Lineage.toString()
            ? TreeType.Lineage
            : TreeType.MolecularSubtype
        );
        const newContextInfo = await dapi.getContextExplorerContextInfo(
          path[0]
        );
        setContextInfo(newContextInfo);

        const dataAvail = await dapi.getSubtypeDataAvailability(
          path[path.length - 1]
        );

        setContextDataAvailability(dataAvail);
      } else {
        setContextPath(null);
        setContextInfo(null);
      }
      setIsLoading(false);
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
      contextTreeRoot: ContextNode | null,
      subtypeCode?: string
    ) => {
      setIsLoading(true);
      deleteSpecificQueryParams(["context"]);

      if (
        (allMolecularSubtypeContextData || allLineageContextData) &&
        (contextNode || subtypeCode)
      ) {
        const context = await dapi.getContextPath(
          contextNode?.subtype_code || subtypeCode!
        );
        const path = context.path;
        const subtypeDataAvail = await dapi.getSubtypeDataAvailability(
          contextNode?.subtype_code || subtypeCode!
        );

        if (
          !contextInfo ||
          (contextTreeRoot && path[0] !== contextTreeRoot.subtype_code)
        ) {
          const newContextInfo = await dapi.getContextExplorerContextInfo(
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
    [allLineageContextData, allMolecularSubtypeContextData, contextInfo, dapi]
  );

  const cellLineUrlRoot = useCallback(() => dapi.getCellLineUrlRoot(), [dapi]);

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
          The Context Explorer displays gene dependencies and drug sensitivities
          that are selective to the context of interest, in addition to showing
          available data for cell lines in that context.
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
              )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default ContextExplorer;
