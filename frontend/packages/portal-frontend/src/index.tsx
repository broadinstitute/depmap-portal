import "src/public-path";

import React from "react";
import ReactDOM from "react-dom";
import { legacyPortalAPI, LegacyPortalApiResponse } from "@depmap/api";
import { CustomList } from "@depmap/cell-line-selector";
import { toStaticUrl } from "@depmap/globals";

import { getQueryParams, sortByNumberOrNull } from "@depmap/utils";

import { DatasetOption } from "src/entity/components/EntitySummary";

import ErrorBoundary from "src/common/components/ErrorBoundary";
import { WideTableProps } from "@depmap/wide-table";

import { Option } from "src/common/models/utilities";

import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";

import { ConnectivityValue } from "./constellation/models/constellation";
import { EntityType } from "./entity/models/entities";
import TermsAndConditionsModal from "./common/components/TermsAndConditionsModal";
import { initializeDevContexts } from "@depmap/data-explorer-2";
import { EnrichmentTile } from "./contextExplorer/components/EnrichmentTile";
import CorrelationAnalysis from "./correlationAnalysis/components";
import { HeatmapTileContainer } from "./compound/tiles/HeatmapTile/HeatmapTileContainer";
import { StructureAndDetailTile } from "./compound/tiles/StructureAndDetailTile";

export { log, tailLog, getLogCount } from "src/common/utilities/log";

type EntitySummaryResponse = LegacyPortalApiResponse["getEntitySummary"];

if (["dev.cds.team", "127.0.0.1:5000"].includes(window.location.host)) {
  initializeDevContexts();
}

const CorrelatedDependenciesTile = React.lazy(
  () =>
    import(
      /* webpackChunkName: "CorrelatedDependenciesTile" */
      "./compound/tiles/CorrelatedDependenciesTile/CorrelatedDependenciesTile"
    )
);

const RelatedCompoundsTile = React.lazy(
  () =>
    import(
      /* webpackChunkName: "RelatedCompoundsTile" */
      "./compound/tiles/RelatedCompoundsTile/RelatedCompoundsTile"
    )
);

const DoseResponseTab = React.lazy(
  () =>
    import(
      /* webpackChunkName: "DoseResponseTab" */
      "src/compound/components/DoseResponseTab"
    )
);

const DoseCurvesTab = React.lazy(
  () =>
    import(
      /* webpackChunkName: "DoseCurvesTab" */
      "src/compound/doseCurvesTab/DoseCurvesTab"
    )
);

const HeatmapTab = React.lazy(
  () =>
    import(
      /* webpackChunkName: "HeatmapTab" */
      "src/compound/heatmapTab/HeatmapTab"
    )
);

const EntitySummary = React.lazy(
  () =>
    import(
      /* webpackChunkName: "EntitySummary" */
      "src/entity/components/EntitySummary"
    )
);

const CelfiePage = React.lazy(
  () =>
    import(
      /* webpackChunkName: "CelfiePage" */
      "./celfie/components/CelfiePage"
    )
);

const PredictabilityTab = React.lazy(
  () =>
    import(
      /* webpackChunkName: "PredictabilityTab" */
      "src/predictability/components/PredictabilityTab"
    )
);

const SublineagePlot = React.lazy(
  () =>
    import(
      /* webpackChunkName: "SublineagePlot" */
      "src/entity/components/SublineagePlot"
    )
);

const WideTable = React.lazy(
  () =>
    import(
      /* webpackChunkName: "WideTable" */
      "@depmap/wide-table"
    )
);

const PortalContextManager = React.lazy(
  () =>
    import(
      /* webpackChunkName: "PortalContextManager" */
      "src/data-explorer-2/components/PortalContextManager"
    )
);

const StandaloneContextEditor = React.lazy(
  () =>
    import(
      /* webpackChunkName: "StandaloneContextEditor" */
      "src/data-explorer-2/components/StandaloneContextEditor"
    )
);

// Render element inside an ErrorBoundary
const renderWithErrorBoundary = (
  element: React.ReactElement,
  container: Element
) => {
  ReactDOM.render(<ErrorBoundary>{element}</ErrorBoundary>, container);
};

export function showTermsAndConditionsModal() {
  const container = document.getElementById("modal-container");
  ReactDOM.render(<TermsAndConditionsModal />, container);
}

export function launchContextManagerModal(options?: {
  initialContextType: string;
  showHelpText: boolean;
}) {
  const container = document.getElementById("modal-container");

  const hide = () => ReactDOM.unmountComponentAtNode(container as HTMLElement);

  // Unmount a previous instance if any (otherwise this is a no-op).
  hide();

  ReactDOM.render(
    <React.Suspense fallback={null}>
      <PortalContextManager
        onHide={hide}
        initialContextType={options?.initialContextType}
        showHelpText={options?.showHelpText || false}
      />
    </React.Suspense>,
    container
  );
}

export function launchCellLineSelectorModal() {
  launchContextManagerModal({
    initialContextType: "depmap_model",
    showHelpText: true,
  });
}

export function editContext(
  context: DataExplorerContext | DataExplorerContextV2,
  hash: string
) {
  const container = document.getElementById("cell_line_selector_modal");
  const unmount = () =>
    ReactDOM.unmountComponentAtNode(container as HTMLElement);
  unmount();

  ReactDOM.render(
    <React.Suspense fallback={null}>
      <StandaloneContextEditor context={context} hash={hash} onHide={unmount} />
    </React.Suspense>,
    container
  );
}

export function repairContext(
  context: DataExplorerContextV2
): Promise<DataExplorerContextV2 | null> {
  const container = document.getElementById("cell_line_selector_modal");

  const unmount = () => {
    ReactDOM.unmountComponentAtNode(container as HTMLElement);
  };

  unmount();

  let resolve: (repairedContext: DataExplorerContextV2 | null) => void;

  const promise = new Promise<DataExplorerContextV2 | null>((origResolve) => {
    resolve = origResolve;
  });

  ReactDOM.render(
    <React.Suspense fallback={null}>
      <StandaloneContextEditor
        context={context}
        hash={null}
        onSave={(nextContext: DataExplorerContextV2) => {
          resolve(nextContext);
        }}
        onHide={() => {
          resolve(null);
          unmount();
        }}
      />
    </React.Suspense>,
    container
  );

  return promise;
}

export function saveNewContext(
  context: DataExplorerContext | DataExplorerContextV2,
  onHide?: () => void,
  onSave?: (context: DataExplorerContext, hash: string) => void
) {
  const container = document.getElementById("modal-container");
  const unmount = () =>
    ReactDOM.unmountComponentAtNode(container as HTMLElement);
  unmount();

  ReactDOM.render(
    <React.Suspense fallback={null}>
      <StandaloneContextEditor
        context={context}
        hash={null}
        onSave={onSave}
        onHide={() => {
          if (onHide) {
            onHide();
          }

          unmount();
        }}
      />
    </React.Suspense>,
    container
  );
}

export function initEnrichmentTile(
  elementId: string,
  featureLabel: string,
  featureType: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <EnrichmentTile featureLabel={featureLabel} featureType={featureType} />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initHeatmapTile(
  elementId: string,
  compoundId: string,
  compoundName: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <HeatmapTileContainer
        compoundId={compoundId}
        compoundName={compoundName}
      />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initCorrelatedDependenciesTile(
  elementId: string,
  entityLabel: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <CorrelatedDependenciesTile entityLabel={entityLabel} />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initStructureAndDetailTile(
  elementId: string,
  compoundId: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <StructureAndDetailTile compoundId={compoundId} />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initRelatedCompoundsTile(
  elementId: string,
  entityLabel: string
) {
  const datasetToDataTypeMap: Record<string, "CRISPR" | "RNAi"> = {
    Chronos_Combined: "CRISPR",
    RNAi_merged: "RNAi",
  };

  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <RelatedCompoundsTile
        entityLabel={entityLabel}
        datasetId="Prism_oncology_AUC_collapsed"
        datasetToDataTypeMap={datasetToDataTypeMap}
      />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initPredictiveTab(
  elementId: string,
  entityId: number,
  entityLabel: string,
  entityType: EntityType,
  customDownloadsLink: string,
  methodologyUrl: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <PredictabilityTab
        entityIdOrLabel={entityId}
        entityLabel={entityLabel}
        entityType={entityType}
        customDownloadsLink={customDownloadsLink}
        methodologyUrl={methodologyUrl}
      />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initDoseResponseTab(
  elementId: string,
  datasetOptions: Array<any>,
  units: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <DoseResponseTab datasetOptions={datasetOptions} doseUnits={units} />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initCorrelationAnalysisTab(
  elementId: string,
  compoundName: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <CorrelationAnalysis compound={compoundName} />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

// New dose curves tab
export function initDoseCurvesTab(
  elementId: string,
  name: string,
  compoundId: string,
  datasetOptions: Array<any>,
  units: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <DoseCurvesTab
        datasetOptions={sortByNumberOrNull(
          datasetOptions,
          "auc_dataset_priority",
          "asc"
        )}
        doseUnits={units}
        compoundName={name}
        compoundId={compoundId}
      />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initHeatmapTab(
  elementId: string,
  name: string,
  compoundId: string,
  datasetOptions: Array<any>,
  units: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <HeatmapTab
        datasetOptions={sortByNumberOrNull(
          datasetOptions,
          "auc_dataset_priority",
          "asc"
        )}
        doseUnits={units}
        compoundName={name}
        compoundId={compoundId}
      />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initWideTable(elementId: string, config: WideTableProps) {
  const {
    data,
    columns,
    invisibleColumns,
    defaultColumnsToShow,
    columnOrdering,
    additionalReactTableProps,
    downloadURL,
    allowDownloadFromTableData,
    sorted, // TODO: Actually used?
    renderExtraDownloads,
  } = config;

  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <WideTable
        data={data}
        columns={columns}
        invisibleColumns={invisibleColumns}
        defaultColumnsToShow={defaultColumnsToShow}
        columnOrdering={columnOrdering}
        additionalReactTableProps={additionalReactTableProps}
        downloadURL={downloadURL}
        allowDownloadFromTableData={allowDownloadFromTableData}
        sorted={sorted}
        renderExtraDownloads={renderExtraDownloads}
      />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

export function initEntitySummary(
  elementId: string,
  summary: {
    initialSelectedDataset: DatasetOption;
    size_biom_enum_name: string;
    color: string;
    figure: { name: number };
    show_auc_message: boolean;
    summary_options: Array<DatasetOption>;
  }
) {
  const {
    size_biom_enum_name: sizeBiomEnumName,
    color,
    figure,
    show_auc_message: showAUCMessage,
    summary_options: summaryOptions,
  } = summary;
  const query = getQueryParams();
  let initialSelectedDataset = summary.summary_options[0];

  if ("dependency" in query) {
    const queryDataset = summary.summary_options.find(
      (o) => o.dataset === query.dependency
    );

    if (queryDataset) {
      initialSelectedDataset = queryDataset;
    }
  }
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <EntitySummary
        size_biom_enum_name={sizeBiomEnumName}
        color={color}
        figure={figure}
        show_auc_message={showAUCMessage}
        summary_options={summaryOptions}
        initialSelectedDataset={initialSelectedDataset}
      />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}

// fixme: take this out when characterization moves to the full entitySummary
export function initSublineagePlot(
  elementId: string,
  datasetEntitySummary: EntitySummaryResponse,
  cellLineList: CustomList | undefined,
  name: number,
  showSublineageCheckboxId: string,
  rerenderPlotEventName: string
) {
  const attachEventListenerForPlotShown = (handlePlotShown: () => void) => {
    $('a[href="#characterization"]').on("shown.bs.tab", () => {
      handlePlotShown();
    });
    $(".characterizationRadio").change(() => {
      handlePlotShown();
    });
  };

  const removeEventListenerForPlotShown = () => {
    $('a[href="#dependency"]').off("shown.bs.tab");
  };

  const cellLinesToHighlight =
    (cellLineList?.lines as Set<string>) || new Set();

  const renderPlot = () => {
    const showSublineageCheckbox = document.getElementById(
      showSublineageCheckboxId
    ) as HTMLInputElement;
    const showSublineage = showSublineageCheckbox.checked;
    renderWithErrorBoundary(
      <React.Suspense fallback={<div>Loading...</div>}>
        <SublineagePlot
          datasetEntitySummary={datasetEntitySummary}
          elementId={`sublineage_plot_${name}`}
          attachEventListenerForPlotShown={attachEventListenerForPlotShown}
          removeEventListenerForPlotShown={removeEventListenerForPlotShown}
          showSublineage={showSublineage}
          cellLinesToHighlight={cellLinesToHighlight}
          key={[...cellLinesToHighlight].toString()}
        />
      </React.Suspense>,
      document.getElementById(elementId) as HTMLElement
    );
  };

  // hook only for the characterization tab, so that the plot is redrawn when show sublineage changes
  window.addEventListener(rerenderPlotEventName, renderPlot);

  renderPlot();
}

export function initCelfiePage(
  elementId: string,
  similarityOptions: Array<Option<string>>,
  colorOptions: Array<Option<string>>,
  connectivityOptions: Array<Option<ConnectivityValue>>,
  targetFeatureLabel: string,
  datasets: Array<Option<string>>,
  dependencyProfileOptions: Array<DatasetOption>,
  howToImg: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <CelfiePage
        getGraphData={(
          taskIds,
          numGenes,
          similarityMeasure,
          connectivity,
          topFeature
        ) =>
          legacyPortalAPI.getConstellationGraphs(
            taskIds,
            null,
            similarityMeasure,
            numGenes,
            connectivity,
            topFeature
          )
        }
        getVolcanoData={legacyPortalAPI.getTaskStatus}
        similarityOptions={similarityOptions}
        colorOptions={colorOptions}
        connectivityOptions={connectivityOptions}
        targetFeatureLabel={targetFeatureLabel}
        datasets={datasets}
        getComputeUnivariateAssociations={
          legacyPortalAPI.computeUnivariateAssociations
        }
        dependencyProfileOptions={dependencyProfileOptions}
        onCelfieInitialized={() => {}}
        howToImg={howToImg}
        methodIcon={toStaticUrl("img/predictability/pdf.svg")}
        methodPdf={toStaticUrl("pdf/Genomic_Associations_Methodology.pdf")}
      />
    </React.Suspense>,
    document.getElementById(elementId) as HTMLElement
  );
}
