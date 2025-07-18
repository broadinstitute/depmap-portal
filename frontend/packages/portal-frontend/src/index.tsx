import "src/public-path";

import React from "react";
import ReactDOM from "react-dom";
import { legacyPortalAPI, LegacyPortalApiResponse } from "@depmap/api";
import { CustomList } from "@depmap/cell-line-selector";
import { toStaticUrl } from "@depmap/globals";

import { getQueryParams } from "@depmap/utils";

import { DatasetOption } from "src/entity/components/EntitySummary";

import ErrorBoundary from "src/common/components/ErrorBoundary";
import { WideTableProps } from "@depmap/wide-table";

import { Option } from "src/common/models/utilities";
import { DataExplorerContext } from "@depmap/types";

import { ConnectivityValue } from "./constellation/models/constellation";
import { EntityType } from "./entity/models/entities";
import TermsAndConditionsModal from "./common/components/TermsAndConditionsModal";
import { initializeDevContexts } from "@depmap/data-explorer-2";
import { EnrichmentTile } from "./contextExplorer/components/EnrichmentTile";

export { log, tailLog, getLogCount } from "src/common/utilities/log";

type EntitySummaryResponse = LegacyPortalApiResponse["getEntitySummary"];

if (["dev.cds.team", "127.0.0.1:5000"].includes(window.location.host)) {
  initializeDevContexts();
}

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

const PredictabilityPrototypeTab = React.lazy(
  () =>
    import(
      /* webpackChunkName: "PredictabilityPrototypeTab" */
      "src/predictabilityPrototype/components/PredictabilityPrototypeTab"
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

export function editContext(context: DataExplorerContext, hash: string) {
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

export function saveNewContext(
  context: DataExplorerContext,
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
  entityLabel: string,
  entityType: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <EnrichmentTile entityLabel={entityLabel} entityType={entityType} />
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

// This is a prototype
export function initPredictabilityPrototypeTab(
  elementId: string,
  entityId: number,
  entityLabel: string,
  entityType: EntityType,
  customDownloadsLink: string,
  methodologyUrl: string
) {
  renderWithErrorBoundary(
    <React.Suspense fallback={<div>Loading...</div>}>
      <PredictabilityPrototypeTab
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
        datasetOptions={datasetOptions}
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
        datasetOptions={datasetOptions}
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
