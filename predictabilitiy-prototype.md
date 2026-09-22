# Predictability Prototype — UI/UX Specification

## Purpose

This document specifies the intended **behavior and layout** of a new "Predictive Insights" page/tab, based on reverse-engineering the a previous prototyped (old-backend) implementation. It is meant to be handed to an engineer/agent building a **new implementation against the new backend API**, reusing the general design and interaction model but rewriting all data-fetching and figure implementations from scratch.

The existing code (under `frontend/packages/portal-frontend/src/predictabilityPrototype/` in a different branch) is itself an unfinished, experimental prototype — it has dead code paths, disabled features, and non-functional stubs. Where relevant, this doc calls those out explicitly as **"do not carry over as-is"** so the new build doesn't resurrect known-broken behavior, while still describing what the _intended_ behavior appears to have been.

## Implementation phases

Build incrementally, in this order, stopping for manual verification after each phase before starting the next:

- **Phase 1 — Scaffolding + first elements**: entry point/mounting contract, initial data fetch, loading state, the error banner (section 1), and the overview row (section 2: Aggregate Scores tile, GeneTEA tiles — CRISPR and RNAi).
- **Phase 2 — Model performance sections**: the section header (section 3) and the per-screen-type accordion structure (section 4) — model list, accordion headers (model name + overall `r` gauge), and independent single-open-at-a-time expand/collapse behavior. Accordion _bodies_ stay empty/collapsed-content-free in this phase.
- **Phase 3 — Model accordion body, placeholders only**: build out the body layout described in section 4 (model performance plots side by side, feature table/accordion, per-feature detail plot grid), but render each individual plot as a placeholder box labeled with what it will eventually show (e.g. "Model Predictions scatter — TODO"), rather than fetching data or rendering real charts.
- **Phase 4 — Everything else**: real chart implementations (per the "Implementation mapping: on-demand plots → breadbox APIs" section), Data Explorer links, Self/Related/Target relationships, GeneTEA search-term wiring, and any other remaining behavior. Do not start this phase until the Open Questions below are resolved.

## Goal of the page

Given a gene (identified by symbol/label), show how well machine-learning models can predict that gene's dependency score (from CRISPR and RNAi knockout screens) using various omics/genomic feature sets, and let the user drill into _why_ — which features drive the prediction, how good the fit is, and how individual features relate to the gene's dependency across cell lines/models.

There is a legacy, separate, currently-in-production feature called `PredictabilityTab` (`src/predictability/...`) that serves a related but distinct purpose. The prototype is a from-scratch rewrite of that concept and should not be confused with it, though some type names (`RelatedType`) may be shared.

While this document is written as though the two datatypes will always be CRISPR an RNAi, don't hardcode those two terms. Instead use the /breadbox/temp/predictive_models/configs endpoint which will return a result like:

```
[
  {
    "dimension_type_name": "compound_v2",
    "configs": [
      {
        "id": "b3b2419f-16f3-4ddf-ac1a-a03803cd7f4e",
        "model_config_name": "CellContext",
        "model_config_description": "lineage, confounder"
      },
      {
        "id": "11daf626-9686-4a0b-bc81-0a0e1ba6ac59",
        "model_config_name": "DriverEvents",
        "model_config_description": "lineage, confounder, driver_events"
      },
      {
        "id": "6cfe9b37-1730-4924-b1d2-f6be09dd6b7c",
        "model_config_name": "GeneticDerangement",
        "model_config_description": "lineage, confounder, driver_events, armlevel_cn, cytoband_cn, genetic_signature"
      },
      {
        "id": "451221b2-5598-45bb-8669-f37a3be87b33",
        "model_config_name": "DNA",
        "model_config_description": "lineage, confounder, driver_events, armlevel_cn, cytoband_cn, genetic_signature, mutations_hotspot, mutations_damaging, gene_cn, loh"
      },
      {
        "id": "d1effe27-fc7f-4501-8b40-d49d039c13fb",
        "model_config_name": "RNASeq",
        "model_config_description": "lineage, confounder, driver_events, armlevel_cn, cytoband_cn, genetic_signature, mutations_hotspot, mutations_damaging, gene_cn, loh, rnaseq"
      }
    ]
  },
  {
    "dimension_type_name": "gene",
    "configs": [
      {
        "id": "80962111-5352-452e-af32-ebe2b4341380",
        "model_config_name": "CellContext",
        "model_config_description": "lineage, confounder"
      },
      {
        "id": "118ef602-e2b0-4cb2-b08f-f1c4cdda1835",
        "model_config_name": "DriverEvents",
        "model_config_description": "lineage, confounder, driver_events"
      },
      {
        "id": "68842d04-ea97-488e-af2a-5d4d7028c4e2",
        "model_config_name": "GeneticDerangement",
        "model_config_description": "lineage, confounder, driver_events, armlevel_cn, cytoband_cn, genetic_signature"
      },
      {
        "id": "1dbd0492-9610-4a10-a1fa-4d67b2c7faf1",
        "model_config_name": "DNA",
        "model_config_description": "lineage, confounder, driver_events, armlevel_cn, cytoband_cn, genetic_signature, mutations_hotspot, mutations_damaging, gene_cn, loh"
      },
      {
        "id": "f14b1d7d-6673-435d-b7b9-fb37d6a08213",
        "model_config_name": "RNASeq",
        "model_config_description": "lineage, confounder, driver_events, armlevel_cn, cytoband_cn, genetic_signature, mutations_hotspot, mutations_damaging, gene_cn, loh, rnaseq"
      }
    ]
  }
]
```

To determine which model configs were used. (For this page, we can filter out anything that's not dimension_type_name == entityType)

and the endpoint /breadbox/temp/predictive_models to determining which results are availible. It produces data like:

```
[
  {
    "dim_type_name": "gene",
    "config_name": "DNA",
    "actuals_dataset_id": "dab3ed53-3fd0-4638-8e86-a4d7eafa472d",
    "actuals_dataset_name": "CRISPR (DepMap Internal 26Q3v2+Score, Chronos)",
    "actuals_dataset_taiga_id": "26q3-library-zeroing-fixed-35fb.3/CRISPRGeneEffect",
    "predictions_dataset_id": "4a9851de-6af1-45c1-85ff-2be18e31adfe",
    "predictions_dataset_name": "Predicted CRISPR (DepMap Internal 26Q3v2+Score, Chronos) using DNA",
    "predictions_taiga_id": "internal-26q3v2-21ba.18/DaintreePredictionsCrisprDna",
    "etag": "results_taiga_id=26q3-library-zeroing-fixed-35fb.3/CRISPRGeneEffect, feature_metadata_taiga_id=a3333cc851d0794461e15de6897f9fc267f14305e58e9dd2725780e380782b16, predictions_taiga_id=internal-26q3v2-21ba.18/DaintreePredictionsCrisprDna"
  },
  ...
```

Lastly we can fetch the actual results via `/breadbox/temp/predictive_models/feature/{dataset_id}/{feature_given_id}` (for example: `/breadbox/temp/predictive_models/feature/dab3ed53-3fd0-4638-8e86-a4d7eafa472d/1` ). Note the path parameter is named `feature_given_id` in the actual route (`breadbox/breadbox/api/temp/predictive_models.py`), not `gene_given_id` — for this page it's populated with the gene's given_id (`dim_type_given_id` from the mount contract).

Response schema (`breadbox/breadbox/schemas/predictive_models.py`), `PredictiveModelsResponse`:

```python
class IDAndName(BaseModel):
    id: str
    name: str

class PredictiveFeature(BaseModel):
    rank: int
    feature_dataset_id: str
    feature_given_id: str
    feature_label: Optional[str]
    importance: float
    correlation_with_actual: float

class ModelFit(BaseModel):
    predictions_dataset: IDAndName
    config_name: str
    config_description: str
    prediction_actual_correlation: float
    top_features: List[PredictiveFeature]

class PredictiveModelsResponse(BaseModel):
    actuals_dataset: IDAndName
    actuals_feature_given_id: str
    actuals_feature_label: str
    model_fits: List[ModelFit]
```

**Important implication for data fetching:** this single response already contains _all_ model fits (one per config, e.g. Confounders/CellContext/.../RNASeq) for the given `(dataset_id, feature_given_id)` pair, each with its own `top_features`. There is no separate "fetch when this model's accordion opens" endpoint — call this endpoint once per screen type (i.e. once per actuals dataset id — CRISPR's actuals dataset, RNAi's actuals dataset) at page-load time, cache the result (e.g. by `(dataset_id, feature_given_id)`), and derive both the "overview" tiles (section 2) and the "Model performance" accordion headers/feature tables (section 4.1–4.2) from it without any further network calls. Only the deeper on-demand plots described below require additional requests when a model or feature row is expanded.

## Entry point / mounting contract

- Mounted into a page via a global init function, e.g. `initPredictiveInsights(elementId, dim_type_given_id, dim_type)`, called from a server-rendered template. Follow the existing convention in `frontend/packages/portal-frontend/src/index.tsx` (e.g. `initPredictiveTab`, `initDoseCurvesTab`, `initHeatmapTab`): export a function that calls the shared `renderWithErrorBoundary(...)` helper, wrapping the component in `<React.Suspense fallback={<div>Loading...</div>}>`, and mounting into `document.getElementById(elementId)`. (These existing `init*` examples mount unrelated/legacy components — cite them only for the mounting _pattern_, not as a data/props reference.)
- Inputs the component needs at mount time:
  - `dim_type_given_id` (string) — the natural key used to fetch the entity. For genes, this is entrez ID.
  - `dim_type` — distinguishes gene vs. other entity types (e.g. compound); affects some legend/labeling text (see "Feature relationship legend" below). For v1 the new build can likely assume `entityType === "gene"` unless the new backend also serves compounds.
- All data fetching happens **after** mount, inside the component — nothing is pre-fetched by the caller.
- Show a loading indicator while the top-level payload is in flight, and a page-level error message if the fetch fails or the gene has no data.
- **No URL/query-param state.** In the old implementation, which model/feature accordions are expanded is pure component state, not reflected in the URL — so refreshing the page always resets to fully collapsed. Worth reconsidering for the rewrite (deep-linking to a specific model+feature would improve shareability), but not a hard requirement — flag this as an open design question rather than a mandated behavior.

## Page layout (top to bottom)

### 1. Error banner (conditional)

If the initial data fetch fails or returns an error, show a simple error message and suppress the rest of the page.

### 2. Overview row — three side-by-side cards

A responsive, flex-wrapping row of "tile" cards, one row per gene (not per screen type):

**a. Aggregate Scores tile**

- One chart shared across both screen types (CRISPR and RNAi drawn as two separate colored lines on the same chart).
- X axis: sequence of models (see "Model set" below), in a fixed, meaningful order — the idea is a "cumulative feature sets" progression (e.g., start with confounders only, then add cell context, then driver events, etc.), where each step's accuracy reflects adding that model's features.
- Y axis: model accuracy/correlation (R) achieved at that step.
- Two lines: one for CRISPR (color e.g. cyan), one for RNAi (color e.g. purple) — consistent screen-type coloring should be used everywhere else on the page too.
- Hover on a point: show the top/most-important features that were added at that step (not just the score).
- Purpose: gives the user a quick sense of "how much better do our models get as we add more feature types, and does CRISPR or RNAi predict better overall."

**b. GeneTEA tile — CRISPR**

- Card scoped to the CRISPR screen type.
- Two tabs:
  - **"Top Features Overall"** — a horizontal bar chart of the top ~100 (or however many returned by the endpoint) features (across all models, for this screen type) ranked by adjusted feature importance, longest/most important at top. Bars colored by which model/feature-set they came from (a fixed color per model, consistent with the aggregate-scores/legend coloring). Long feature names should wrap rather than truncate.
  - **"GeneTEA Results"** — shows enrichment/search-term results (via the EXISTING shared GeneTEA integration widget) for the _genes_ referenced by those top ~100 features (i.e., "what biological themes show up among the genes whose features are most predictive"). Include a way to reveal the underlying list of search terms in a table (name, feature type, importance rank), collapsed by default.
    - Reuse the `GeneTea` component: `frontend/packages/@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/index.tsx` (default export). Its props are `{ selectedLabels: Set<string> | null; onClickColorByContext: (context: DataExplorerContextV2) => void }` — feed it a `Set` of the gene symbols/labels derived from the top features' `feature_given_id`/`feature_label`. **Open question:** not all `feature_given_id`s are necessarily gene symbols (features come from varied dataset types — mutations, RNAseq, driver events, etc.) — the mapping from an arbitrary feature to "the gene it references" needs a defined rule (e.g. strip a suffix, use `feature_label`, or look up via the feature's dataset `feature_type_name`); flag as unresolved (see Open Questions).

**c. GeneTEA tile — RNAi**

- Same as (b) but scoped to the RNAi screen type and its own top-features/GeneTEA results.

### 3. Section header

A static header introducing the next section, e.g. "Model Performance — Performance according to CRISPR and RNAi."

### 4. Model performance sections — one per screen type (CRISPR, RNAi)

Each screen type gets its own colored section header (reuse the CRISPR/RNAi color coding), and beneath it, one **accordion entry per model** (the model set — see below). Only one model's panel can be open at a time within a screen type; CRISPR and RNAi expand/collapse independently of each other.

**Model accordion header:** model name, plus the model's overall correlation `r` between observed and predicted values, shown as a small labeled horizontal gauge/meter alongside a numeric value ("R between observed and predicted").

**Model accordion body (when expanded):**

1. **Model performance plots** (two side by side):

   - **"Model Predictions" scatter plot** — actual (observed) dependency values on X, predicted values on Y, one point per cell line/model, colored by local point density, plus a y=x reference line so the user can visually judge fit quality. Include a link/button to open the same data in the portal's Data Explorer for deeper interactive analysis.
     - **Data Explorer link — working pattern to follow:** `toPortalLink('/data_explorer_2?plot=' + btoa(JSON.stringify(plotConfig)))`, where `plotConfig` is a `DataExplorerPlotConfig` (from `@depmap/types`) and `toPortalLink` comes from `@depmap/globals`. See `frontend/packages/portal-frontend/src/transcriptExplorer/components/TranscriptConfigPanel/DataExplorerLinks/toUnexpandedPlotLink.ts` for a working precedent to adapt (build a two-axis `DataExplorerPlotConfig` referencing the actuals dataset/feature on one axis and the predictions dataset/feature on the other).
   - **"Top Feature Correlation Map" heatmap** — a correlation heatmap among the model's top features (helps the user see redundancy/co-linearity among predictive features). Sequential color scale, hover shows row/column feature names and correlation value.

2. **Feature table / accordion** — a header row with four columns: **Feature**, **Relative Importance**, **Correlation**, **Feature Type**, followed by one collapsible entry per feature (ranked by importance), each showing:

   - Feature name, plus a small icon indicating its relationship to the gene being analyzed: **Self** (the feature is derived from the gene itself), **Related** (feature comes from a biologically related gene, e.g. same complex/pathway), or **Target** (used only when `dim_type` is a compound — feature relates to the compound's target). Include an info affordance (e.g. a click-to-open popover) explaining what these icons mean, with different explanatory text/imagery depending on whether the current entity is a gene (Self/Related legend) or a compound (Target legend + link to a target-database resource like the Repurposing Hub).
   - Relative importance, shown as a horizontal meter/gauge plus a percentage value.
   - Correlation (Pearson), shown as a horizontal meter/gauge plus a numeric value (several decimal places).
   - Feature type (e.g. "RNASeq", "DriverEvents", etc.).
   - Expanding a feature row reveals per-feature detail plots (see below). Only one feature can be expanded at a time per model (nested accordion — independent from the model-level accordion state of other models).

3. **Per-feature detail plots** (rendered in a responsive grid, collapsing to fewer columns on narrow screens), when a feature row is expanded:
   - **Feature vs. Gene Effect scatter** — this feature's value (X) vs. the gene's dependency/gene-effect score (Y), one point per cell line, colored by density. Include an "open in Data Explorer" link
   - **Dataset correlation: actual vs. feature** — a scatter comparing, across all features in the feature's source dataset, each feature's correlation with _this specific feature_ (X) against its correlation with the _gene's actual dependency values_ (Y). Helps spot whether this feature stands out as uniquely correlated with the outcome versus just correlated with everything.
   - **Feature rank plot** (the old code called this a "waterfall plot" but implemented it as a scatter, not a true waterfall/bar chart — worth deciding fresh in the rewrite which chart type best communicates this) — for every feature in the feature's source dataset, its correlation with the gene's actual dependency values, ordered/ranked from strongest to weakest, so the user can see where this particular feature sits relative to all other candidate features in that dataset.

## Model set / feature-set taxonomy

The old prototype organized predictive features into a fixed sequence of named "models," each representing a feature category, used consistently for the aggregate-scores line chart's X-axis order and for color-coding bars/legends:

1. Confounders
2. Cell Context
3. Driver Events
4. Genetic Derangement
5. DNA
6. RNASeq

Use the /breadbox/temp/predictive_models/configs endpoint to determine which are actually shown and which order.

## Screen types

Two screen types are always shown side by side / colored distinctly throughout the page: **CRISPR** and **RNAi**. Each screen type has its own independent model performance section, its own GeneTEA tile, and its own line in the aggregate-scores chart. Pick two distinct, consistent colors for these two categories and use them everywhere (chart lines, section headers, model gauges).

## Data model concepts to preserve (shape, not necessarily field names)

For the new backend integration, the UI will need, per gene:

- **Per screen type:**
  - An **overview** payload: aggregate accuracy-by-model-step data (for the line chart), top-ranked features overall with importance scores and their source model/feature-set (for the bar chart), and a derived list of "search terms" (genes referenced by those top features) for the GeneTEA lookup.
  - **Per model:** overall correlation `r`; a list of the model's top features, each with: feature label, feature type, source dataset identifiers, relative/adjusted importance, Self/Related/Target relationship, and Pearson correlation with the gene's actual values.
- **Per model performance panel (on demand when a model is expanded):** identifiers needed to fetch actual-vs-predicted values (for the scatter) and the top-feature correlation matrix (for the heatmap).
- **Per feature (on demand when a feature row is expanded):** identifiers needed to fetch (a) this feature's values vs. gene effect, (b) all other features in its dataset correlated against this feature and against the gene's actual values, (c) all other features in its dataset ranked by correlation with the gene's actual values.

## Implementation mapping: on-demand plots → breadbox APIs

The `/predictive_models/feature/...` payload (cached per screen type, see above) supplies everything needed for the overview tiles and the model/feature tables. The plots below require additional, on-demand calls, all against **existing, currently-implemented breadbox endpoints** (not `predictive_models`-specific):

**a. "Model Predictions" scatter (actual vs. predicted, on model-panel expand)**

- Call `POST /datasets/dimension/data/` (`getDimensionData` in `@depmap/api`) twice:
  - `{ dataset_id: actuals_dataset.id, identifier: actuals_feature_given_id, identifier_type: "feature_id" }` → gene-effect values per model, for the Y... actually X (observed) axis.
  - `{ dataset_id: model_fit.predictions_dataset.id, identifier: actuals_feature_given_id, identifier_type: "feature_id" }` → predicted values per model, for the Y axis.
- Each call returns `{ ids, labels, values }` as parallel arrays (not keyed by model id) — join the two responses on `ids` (intersect, since a model line may be missing from one dataset) to build point pairs. This endpoint fetches one feature at a time, so this is always exactly 2 calls per model panel.

**b. "Top Feature Correlation Map" heatmap (on model-panel expand)**

- No endpoint returns an arbitrary-feature-list correlation matrix directly. Build it by calling `POST /temp/associations/compute` once per top feature (capped to a reasonable N, e.g. the model's top 10–15 features — not all of them), with `{ dataset_id: <that feature's feature_dataset_id>, slice_query: { dataset_id: <that feature's feature_dataset_id>, identifier: <that feature's feature_given_id>, identifier_type: "feature_id" } }`. Each call returns `{ label[], given_id[], cor[] }` — correlations of that feature against _every_ feature in its dataset; filter each response down to just the other selected top features to assemble the N×N matrix client-side. Flag as a performance consideration: N sequential/parallel round trips per heatmap render, so cache per model and consider a request cap/spinner while all N resolve.

**c. Per-feature "Feature vs. Gene Effect" scatter (on feature-row expand)**

- Two `getDimensionData` calls, joined on `ids` as in (a): one for the feature itself (`dataset_id: feature.feature_dataset_id, identifier: feature.feature_given_id`), one for the gene's actual values (`dataset_id: actuals_dataset.id, identifier: actuals_feature_given_id`).

**d. "Dataset correlation: actual vs. feature" scatter (on feature-row expand)**

- Two `POST /temp/associations/compute` calls against the feature's own dataset (`dataset_id: feature.feature_dataset_id`):
  - `slice_query` = the feature itself → correlation of every feature in the dataset against _this_ feature.
  - `slice_query` = the gene's actual values (`dataset_id: actuals_dataset.id, identifier: actuals_feature_given_id`) → correlation of every feature in the dataset against the _actual_ dependency values.
  - Join the two `{label, given_id, cor}` responses on `given_id` to get (corr-with-this-feature, corr-with-actual) pairs, one per candidate feature.

**e. "Feature rank plot" (on feature-row expand)**

- Reuse the second call from (d) (feature dataset's features correlated against the gene's actual values) — it already returns `cor` per feature, sorted ascending; re-sort/rank as needed for display and locate this feature's position in the ranking.

**f. "Feature Type" column**

- Fetch dataset metadata via `GET /datasets/{dataset_id}` (`getDataset` in `@depmap/api`) for each distinct `feature_dataset_id` encountered (cache by dataset id); per the product decision, display the dataset's `name` field as the "Feature Type" value (not `feature_type_name`, which is a different, more granular concept).

**g. Self / Related / Target relationship icon**

- **Self**: `feature.feature_given_id === dim_type_given_id` (the gene given_id passed at mount).
- **Related** and **Target**: no backend field or lookup currently exists for these. See Open Questions below.

## Chart types used (for reference — pick current equivalents in the new build's charting approach)

Existing reusable components found in `@depmap/*` / `portal-frontend` on the current branch — prefer these over building new chart primitives:

- **Line chart (aggregate scores)** — no ready-made line-chart component exists in `@depmap/*`; build directly on `@depmap/plotly-wrapper`'s `PlotlyWrapper` (or `usePlotlyLoader` from `@depmap/data-explorer-2`) with a `scatter`+`mode: "lines+markers"` trace.
- **Horizontal bar chart (top features overall)** — `BarChart` in `frontend/packages/@depmap/slice-table/src/components/SlicePreview/BarChart.tsx` exists but reads as a vertical/column bar chart from its props (`x: string[]` categories, `y: number[]` values); verify its Plotly trace `orientation` before reuse, or build a fresh horizontal bar trace via the Plotly wrapper if it doesn't fit.
- **Scatter plots with density-based color scale and optional y=x reference line** (model predictions, feature vs. gene effect) — `PrototypeScatterPlot` / `DataExplorerScatterPlot` in `frontend/packages/@depmap/data-explorer-2/.../plot/` support `continuousColorKey`/`colorMap`/`showIdentityLine`-style props; for plain density shading there's also `DensityPlot` (`PrototypeDensity1D`, exported from the package root). Evaluate whether these public components accept two arbitrary numeric arrays directly (rather than requiring a full Data Explorer context) before reusing as-is.
- **Dataset correlation / feature rank plots** — likely also served by the same scatter component family; the "feature rank plot" specifically needs an ordered-by-rank X axis rather than a data-driven X value — see Open Questions re: whether scatter is still the right chart type.
- **Heatmap with sequential color scale, click-to-select cells (top feature correlation map)** — `PrototypeCorrelationHeatmap` in the same `plot/prototype/` directory, props include `xLabels`, `yLabels`, `xKey`/`yKey`/`zKey`, `palette`, `onSelectLabels`.
- **Horizontal "meter"/gauge widget** for single numeric values (relative importance, correlation, model R) — `StyledMeter` in `frontend/packages/portal-frontend/src/common/components/StyledMeter.tsx` (wraps the native `<meter>` element; supports `value`/`min`/`max`/`percentage`/`toFixed`/custom colors). It lives under `portal-frontend/src/common`, not a shared `@depmap/*` package — fine to import directly since this page also lives in `portal-frontend`. (Ignore `CorrelationMeter` under the legacy `portal-frontend/src/predictability/` — that's part of the ignored old feature.)
- **Nested accordions** — the `Accordion` component in `@depmap/common-components` carries an explicit code comment marking it "buggy and hard to use," recommending React-Bootstrap `<Panel expanded={...} onToggle={...}>` instead. Follow the precedent in `frontend/packages/portal-frontend/src/common/components/FilterControls/FilterAccordion(s).tsx` or `frontend/packages/portal-frontend/src/dataPage/components/CollapsiblePanel.tsx` for the model/feature accordion behavior instead of the deprecated component.
- Box plot / vertical bar chart (optional feature distribution — see above) — no current equivalent identified; would need to be built fresh on the Plotly wrapper if pursued.

## Open Questions

These are flagged explicitly rather than resolved with an assumed default, per product decision — implementation should not proceed on these points without a decision:

1. **URL/deep-link state** — should expanded model/feature accordion state be reflected in the URL for shareability, or remain pure component state (resetting on refresh) as in the old prototype? Not a hard requirement either way.
2. **Data Explorer plot config shape** — the precedent (`toUnexpandedPlotLink.ts`) builds a single-axis-expansion config for an existing single-dataset context; this page needs a **two-axis, cross-dataset** config (actuals dataset feature vs. predictions dataset feature, or feature vs. gene effect). Confirm `DataExplorerPlotConfig` supports specifying two independent `(dataset_id, feature)` axes before committing to this approach.
3. **"Feature rank plot" chart type** — the old prototype called this a waterfall plot but implemented it as a scatter. Decide fresh: scatter (rank on X, correlation on Y) vs. a true ranked bar/waterfall.
4. **Optional feature-distribution box/violin plot** — mentioned as optional in the interaction/chart-type lists but never specified as a required panel; confirm in/out of v1 scope.
5. **Related / Target feature-relationship icons** — no backend field or lookup currently exists to determine whether a feature comes from a biologically related gene (Related) or a compound's target (Target, n/a for v1 gene-only scope). "Self" is derivable client-side (`feature_given_id === dim_type_given_id`). Related/Target need either a new backend endpoint/field or an explicit decision to omit them (and their legend/info-popover) from v1.
6. **GeneTEA "search terms" gene mapping** — deriving "the gene each top feature references" from `feature_given_id`/`feature_label` is unambiguous for gene-level features but unclear for features from other dataset types (mutation, RNAseq, driver-event, arm-level CN, etc.). Needs a defined extraction rule per feature/dataset type, or confirmation that `feature_label` already encodes this consistently.
7. **Top-feature correlation heatmap cap** — since it requires one `/temp/associations/compute` call per feature (no batch/matrix endpoint exists), confirm an acceptable N (e.g. top 10–15 features) to bound the number of round trips per model panel.
8. **`dim_type` beyond "gene"`** — the spec assumes `entityType === "gene"` for v1; confirm whether compound support (and the Target relationship/legend) is in scope now or genuinely deferred.

## Interaction summary

- Two independently-toggling top-level accordions (CRISPR models, RNAi models), single-open-at-a-time each.
- Nested per-model accordion of features, single-open-at-a-time, independent per model.
- Tabs within each GeneTEA tile ("Top Features Overall" vs. "GeneTEA Results").
- A show/hide toggle for the raw GeneTEA search-terms table.
- Click-triggered info popover explaining the Self/Related/Target feature-relationship icons.
- Hover tooltips on all charts showing relevant per-point/per-bar detail (feature names at aggregate-score steps, sample IDs on scatter plots, row/col + value on heatmap cells).
- Loading spinners at both the page level (initial fetch) and per-chart level (each chart's own on-demand fetch, triggered when its containing accordion panel is opened).
