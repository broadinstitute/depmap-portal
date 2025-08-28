export { default as ContextSelector } from "./src/components/ContextSelector";
export { default as SliceLabelSelector } from "./src/components/SliceLabelSelector";
export { default as PlotConfigSelect } from "./src/components/PlotConfigSelect";
export { default as renderConditionally } from "./src/utils/render-conditionally";
export { default as DimensionSelect } from "./src/components/DimensionSelect";
export { default as DimensionSelectV2 } from "./src/components/DimensionSelectV2";
export { default as SliceLabelSelect } from "./src/components/DimensionSelect/SliceLabelSelect";
export { default as ContextBuilderModal } from "./src/components/ContextBuilder/ContextBuilderModal";
export { default as ContextBuilderV2 } from "./src/components/ContextBuilderV2";
export { default as ContextManager } from "./src/components/ContextManager";
export { default as DatasetMetadataSelector } from "./src/components/DatasetMetadataSelector";
export { default as DataExplorerPage } from "./src/components/DataExplorerPage/components/DataExplorer2";
export { default as ContextTypeSelect } from "./src/components/ContextManager/ContextTypeSelect";

export { isBreadboxOnlyMode } from "./src/isBreadboxOnlyMode";
export { deprecatedDataExplorerAPI } from "./src/services/deprecatedDataExplorerAPI";
export type { DeprecatedDataExplorerApiResponse } from "./src/services/deprecatedDataExplorerAPI";

export {
  DataExplorerSettingsProvider,
  useDataExplorerSettings,
  useLaunchSettingsModal,
} from "./src/contexts/DataExplorerSettingsContext";

export {
  PlotlyLoaderProvider,
  usePlotlyLoader,
} from "./src/contexts/PlotlyLoaderContext";

export {
  contextsMatch,
  initializeDevContexts,
  isContextAll,
  isNegatedContext,
  isV2Context,
  negateContext,
  saveContextToLocalStorageAndPersist,
} from "./src/utils/context";

export { fetchContext, persistContext } from "./src/utils/context-storage";

export {
  capitalize,
  convertDimensionToSliceId,
  convertDimensionToSliceQuery,
  getDimensionTypeLabel,
  isCompleteDimension,
  isCompleteExpression,
  isPartialSliceId,
  isSampleType,
  pluralize,
  sortDimensionTypes,
  urlLibEncode,
} from "./src/utils/misc";

export { persistLegacyListAsContext } from "./src/components/ContextSelector/context-selector-utils";

export { default as DensityPlot } from "./src/components/DataExplorerPage/components/plot/prototype/PrototypeDensity1D";

export {
  logInitialPlot,
  logReducerTransform,
} from "./src/components/DataExplorerPage/debug";
export { PointsSelector } from "./src/components/DataExplorerPage/components/ConfigurationPanel/selectors";
export { default as plotConfigReducer } from "./src/components/DataExplorerPage/reducers/plotConfigReducer";
export type { PlotConfigReducerAction } from "./src/components/DataExplorerPage/reducers/plotConfigReducer";
export {
  DEFAULT_PALETTE,
  LEGEND_ALL,
  LEGEND_BOTH,
  LEGEND_RANGE_1,
  LEGEND_RANGE_2,
  LEGEND_RANGE_3,
  LEGEND_RANGE_4,
  LEGEND_RANGE_5,
  LEGEND_RANGE_6,
  LEGEND_RANGE_7,
  LEGEND_RANGE_8,
  LEGEND_RANGE_9,
  LEGEND_RANGE_10,
} from "./src/components/DataExplorerPage/components/plot/prototype/plotUtils";
export type { LegendKey } from "./src/components/DataExplorerPage/components/plot/prototype/plotUtils";
