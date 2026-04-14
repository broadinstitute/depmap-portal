export { default as ContextSelectorV2 } from "./src/components/ContextSelectorV2";
export { default as PlotConfigSelect } from "./src/components/PlotConfigSelect";
export { default as renderConditionally } from "./src/utils/render-conditionally";
export { default as DimensionSelectV2 } from "./src/components/DimensionSelectV2";
export { default as ContextBuilderV2 } from "./src/components/ContextBuilderV2";
export { default as ContextManager } from "./src/components/ContextManager";
export { default as DataExplorerPage } from "./src/components/DataExplorerPage/components/DataExplorer2";
export { default as ContextTypeSelect } from "./src/components/ContextManager/ContextTypeSelect";

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

export { convertContextV1toV2 } from "./src/utils/context-converter";

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
  isSampleTypeSync,
  pluralize,
  sortDimensionTypes,
  uncapitalize,
  urlLibEncode,
} from "./src/utils/misc";

export { persistLegacyListAsContext } from "./src/utils/persistLegacyListAsContext";

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
  LEGEND_OTHER,
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
