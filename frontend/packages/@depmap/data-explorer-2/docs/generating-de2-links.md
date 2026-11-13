# Generating links to Data Explorer 2

This document describes version 2 of the Data Explorer 2 (DE2) plot config. It is written for agents (e.g. DepMap Delphi) that turn a user's biological question into a plot config, draw it, and link to it at `https://cds.team/depmap/data_explorer_2/`.

**Searching:** every `##` section has a bracketed marker such as `[SELECTED-POINTS]`. Search for the marker to jump to that section.

| Marker                     | Read it when…                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[QUICKSTART]`             | You are about to build any plot. Read this first.                                                                                                  |
| `[QUESTION-TO-PLOT]`       | You have a biological question and must choose a plot type and config.                                                                             |
| `[SELECTED-POINTS]`        | The user selected points in a plot and asks about them.                                                                                            |
| `[FOLLOW-UP-PLOTS]`        | The user asks to change, extend or re-plot something they have already seen ("plot this against X", "now color by Y", "same but for Z").           |
| `[PLOT-TYPES]`             | Choosing between density, waterfall, scatter and heatmap.                                                                                          |
| `[DIMENSIONS]`             | Writing `dimensions` (what each axis shows).                                                                                                       |
| `[COLOR-AND-FACET]`        | Grouping points by a property, a gene, or two hand-made groups.                                                                                    |
| `[EXPAND-BY]`              | One axis should show every member of a set, not their aggregate.                                                                                   |
| `[FILTERS-AND-CATEGORIES]` | Restricting which points are drawn, or "just the top N categories".                                                                                |
| `[REGRESSION-LINE]`        | Deciding whether to add a fit line to a scatter.                                                                                                   |
| `[CONTEXT-FORMAT]`         | Writing a `context` (a rule that selects entities).                                                                                                |
| `[OPERATORS]`              | Writing the `expr` inside a context.                                                                                                               |
| `[REINDEX-THROUGH]`        | A context must read a column belonging to a different entity type, or the user wants a breakdown "per dose / timepoint / replicate" (child types). |
| `[NESTED-CONTEXTS]`        | A context must refer to another context.                                                                                                           |

## [QUICKSTART] Building a plot

1. **Always include `"version": 2`.** A payload without it is read as the oldest schema, and nothing reports an error. The most visible failure: a plot with `facet_by` and no `color_by` renders every point grey. Declaring version 2 also promises that you used Breadbox `given_id`s for `dataset_id`s (never legacy Portal IDs), the field names below, and V2-format contexts.
2. **Required fields:** `version`, `plot_type`, `index_type`, `dimensions`.
3. **Pick `index_type` first.** It is what one point _is_ (the "Points" field in the UI): `depmap_model` makes each point a cell line model; `gene` makes each point a gene. Each axis then reads a dataset indexed by that type, and its `slice_type` is the complementary type.
4. **Encode the config as a link.** Base64 (RFC 4648) of the UTF-8 JSON, passed as `?plot=<base64>`. Other formats exist, but don't use them: the human-readable `xDataset`/`yFeature` parameters (legacy DE1 compatibility, ambiguous) and the compressed `?p=` form (DE2's own output; only needed if a URL exceeds ~4,000 characters).
5. **Don't guess IDs or types.** Look up dataset IDs, gene Entrez IDs, model IDs and metadata column names with your tools. A matrix dataset's `feature_type` and `sample_type` are listed in `matrix_datasets` on `GET /types/dimensions/reference-graph`; use them to choose `index_type` and `slice_type`, not the dataset's name or a column such as `CompoundID`. Names used in the start-screen examples (they may differ between deployments, so confirm them): datasets `Chronos_Combined` (CRISPR gene effect), `expression`, `copy_number_relative`, `OmicsAbsoluteCNGene`, `mutations_damaging`, `mutations_hotspot`, `ssgsea`, `Rep_all_single_pt_per_compound`; metadata `depmap_model_metadata` (columns `OncotreeLineage`, `GrowthPattern`, `ModelType`, `Sex`, `PrimaryOrMetastasis`), `gene_metadata` (columns `label`, `selectivity`, `essentiality`).
6. **State your choices.** Say which dataset, which aggregation and which grouping you used, and why, so the user can correct you.

### Minimal complete example

TP53 CRISPR gene effect across models. Gene `given_id`s are Entrez IDs; model `given_id`s are `ACH-` IDs.

```json
{
  "version": 2,
  "plot_type": "density_1d",
  "index_type": "depmap_model",
  "dimensions": {
    "x": {
      "axis_type": "raw_slice",
      "aggregation": "first",
      "dataset_id": "Chronos_Combined",
      "slice_type": "gene",
      "context": {
        "dimension_type": "gene",
        "name": "TP53",
        "expr": { "==": [{ "var": "given_id" }, "7157"] },
        "vars": {}
      }
    }
  }
}
```

Later examples abbreviate repeated axes as `"x": { … }`. Real payloads must be complete.

## [QUESTION-TO-PLOT] From a biological question to a plot config

Start from what the user wants to learn, then pick the config. These patterns come from the real examples on the Data Explorer start screen, each of which answers a real question.

| The user wants to know…                                                                               | Config pattern                                                                                                                                                                                                                                                   | Example                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How is one gene distributed, and does it differ by lineage?                                           | `density_1d`, `raw_slice` x, `facet_by: "property"` on `OncotreeLineage`                                                                                                                                                                                         | SOX10 expression per lineage: which lineages express it and which don't.                                                                                                                                        |
| Is gene A's dependency related to gene B's copy number, expression, or another dataset (a biomarker)? | `scatter`, two `raw_slice` axes from different datasets, `index_type: "depmap_model"`; add a regression line                                                                                                                                                     | VPS4A CRISPR gene effect vs VPS4B absolute copy number (paralog dependency). Optionally `color_by: "custom"` with a third `raw_slice` (e.g. VPS4B expression).                                                  |
| Does a gene's dependency track with sensitivity to drugs that hit it?                                 | `scatter`, x = gene CRISPR, y = a compound **context** with `aggregation: "expansion"`, `facet_by: "expansion"`, regression line. See `[EXPAND-BY]`.                                                                                                             | BRAF dependency vs every compound whose `TargetOrMechanism` names BRAF, one panel per inhibitor. Genetic and pharmacological dependency should agree.                                                           |
| Which genes are specifically essential in group A vs group B?                                         | `scatter`, `index_type: "gene"` (points are genes), x = `aggregated_slice` mean over context A, y = mean over context B, same dataset                                                                                                                            | EMT-high vs EMT-low adherent models (contexts built from an `ssgsea` score threshold and `GrowthPattern`); genes far from the diagonal are subtype-specific dependencies. Color by `gene_metadata.selectivity`. |
| Which genes are up or down in group A vs group B?                                                     | Same as above with an expression dataset                                                                                                                                                                                                                         | RB1-loss vs RB1-intact adherent models (damaging or hotspot mutation, or low relative copy number, combined with `or`).                                                                                         |
| How does a gene's expression compare between two subgroups of one lineage?                            | `density_1d` with `filters.visible` for the lineage, `facet_by: "aggregated_slice"` with `facet1` and `facet2`, `color_by: "facet"`                                                                                                                              | ERBB2 expression in HER2-amplified (copy number > 1.5) vs non-amplified breast models. The second group uses `complement`.                                                                                      |
| Is a gene essential everywhere, or only in some lines? Is it also expressed?                          | `scatter`, `index_type: "gene"`, x and y both `aggregated_slice` mean over the context `expr: true` ("All") in two datasets, `color_by: "property"` on `gene_metadata.essentiality`                                                                              | Mean expression vs mean CRISPR effect: nearly all common essentials are highly expressed, but not the reverse.                                                                                                  |
| Which genes in a pathway or complex share dependencies?                                               | `correlation_heatmap`, x = context of gene labels with `aggregation: "correlation"`; optionally `filters.distinguish1/2` to split by cell-line group                                                                                                             | De novo pyrimidine synthesis (CAD, CTPS1, DHODH, UMPS…) in Chronos. Distinguish adherent vs suspension models.                                                                                                  |
| How does X relate to Y at different doses / timepoints / replicates?                                  | `scatter`, `index_type: "depmap_model"`, y = a context over the **child type** (e.g. `compound_dose`) with `aggregation: "expansion"` and `facet_by: "expansion"`. Find the child with `referenced-by`; see `[REINDEX-THROUGH]`.                                 | BRAF expression vs ERLOTINIB viability, one panel per dose (full example under "Child types"). Don't average doses or plot dose-level data on a `compound_v2` axis.                                             |
| Plot / compare the members of a set against each other (the transcripts, isoforms or doses of X)      | `density_1d` with `aggregation: "expansion"` and `facet_by: "expansion"`: one panel per member. **Not** a `scatter` with the same expansion on both axes, which plots each member against itself. Use a scatter only if the user names two different quantities. | "Plot the transcripts of CD44 against each other" (needs a transcript-level dataset).                                                                                                                           |
| Which isoform of a gene is used, and does it vary by lineage?                                         | `density_1d`, transcript context with `aggregation: "expansion"` and `facet_by: "expansion"`; then `color_by: "property"` for lineage                                                                                                                            | CD44 isoforms in long-read expression (needs a transcript-level dataset).                                                                                                                                       |

Rules of thumb for choosing:

- **One gene or compound, one number per model** → `raw_slice`. **A group of genes, or a group of models, collapsed to one number** → `aggregated_slice` with `mean` (or another aggregation).
- **Comparing the same quantity between two groups of models** → make the points genes (`index_type: "gene"`) and put one model-context on each axis. Don't try to do it with two groups on a model-indexed plot.
- **"Per lineage / per subtype / per mutation status"** → facet. **"Highlight these models"** → `color_by: "raw_slice"` / `"aggregated_slice"` with a context. **"Colored by another measurement"** → `color_by: "custom"`.
- **A relationship between two measurements of the same models** → `scatter` with `index_type: "depmap_model"`. **The distribution of one measurement** → `density_1d`. **A ranked list** → `waterfall`.
- **If the question is ambiguous about the dataset** (e.g. "dependency" could be Chronos effect, or probability), choose the portal default, say so, and offer the alternative.
- **A follow-up plot changes only what the user asked to change.** See `[FOLLOW-UP-PLOTS]`.
- **Interpreting the result is part of the job.** After plotting, say what the plot shows biologically (which groups separate, outliers, direction of effect), not only that it was drawn.

## [SELECTED-POINTS] When the user selects points and asks about them

The plot view lets a user box- or lasso-select points and click **Ask about these N …**, which sends a message of this shape:

```
I selected 3 cell lines in the plot of <y axis> against <x axis>:
- NAME (ACH-000001)
- NAME (ACH-000002)
- NAME (ACH-000003)
```

Up to 50 entities are sent. Each is the plot's `index_type` entity (cell line, gene, compound…) with its label and ID. **Plotted values are not included** — you must look up the values yourself when they matter.

**Treat a selection as a hypothesis the user is forming, not as a visualization task.** The user picked those points because something about them stood out. Your job is to work out what, and test it. Do not just redraw the plot.

1. **Find out what the selected entities are.** Fetch their metadata with your tools: for models, lineage, subtype, growth pattern, primary vs metastasis, and sex; for genes, chromosome arm, selectivity, pathway or complex membership; for compounds, target or mechanism. Compare to the whole plot: Are they all one lineage? Over-represented relative to the background? Mixed?
2. **Work out why they were selected.** Use the plot's axes. Note where the points sit in the distribution of each plotted quantity: high or low outliers, one cluster, a spread across a range, above or below the diagonal. Retrieve their actual values on the plotted axes. State what the position suggests biologically. For example, very low expression of a gene in a lineage that normally expresses it could mean deletion, silencing, or a feedback loop; a model more dependent than its lineage peers may carry a mutation that creates the dependency.
3. **Investigate biological relevance, proactively.** Check whether the selected entities share relevant alterations (mutations, copy number, fusions), whether those alterations fit the known biology of their lineage, and what other features they share (dependencies, drug sensitivities, expression of related genes). If you can compare the selected group to everyone else (a two-class comparison, with the selected IDs as one context), do it, and report the top differences.
4. **Offer a follow-up plot only when it adds something.** A natural one is the same plot with the selected entities highlighted (`color_by: "raw_slice"` or `"aggregated_slice"` with `filters.color1` as an ID context: `{"in": [{"var": "given_id"}, ["ACH-000001", …]]}`), or a facet by the shared property you found.
5. **Ask what they noticed if it is truly ambiguous**, e.g. "Did you select these because they have unusually low TP53 expression? I can check what might explain that." Do this _after_ giving what you can already say, not instead of it.
6. **Be honest about limits.** A shared lineage across five models is a hint, not a conclusion; say how many of the plot's models share the property and how many would be expected by chance. If the selection is a single point, treat it as a question about that entity.

Selection is only offered where one point is one entity. On a plot with `expand_by` that is not faceted by the expansion it is disabled (see `[EXPAND-BY]`).

## [FOLLOW-UP-PLOTS] Carrying context from one plot to the next

A follow-up request ("plot this against EGFR", "color it by lineage", "same plot for GDSC2") refers to **the plot the user is looking at**, not only to the measure it shows. "This" means the whole plot: what a point is, which dataset and quantity, how it is broken out, which points are highlighted or filtered. **Start from the previous plot's config, change only what the user asked to change, and keep everything else.** Do not rebuild the plot from the user's last sentence alone.

**What to carry over, unless the user says otherwise:**

- **`index_type`**, and **the dataset, `slice_type` and `context`** of every quantity that is staying. Do not switch to a different dataset silently; if you do, say why.
- **A breakdown by member: `aggregation: "expansion"`, `expand_by` and `facet_by: "expansion"`.** This is the one most often lost. If the previous plot gave each dose, timepoint, replicate or isoform its own track or panel, the follow-up keeps that. **Never turn an expansion into `mean` (or any other aggregation) to make a new plot type fit.** Collapsing a breakdown the user was looking at is a change to the question. Only do it when the user explicitly asks for an average or summary, and say what you did.
- **Other grouping:** `facet_by`, `color_by`, `metadata.facet_property` / `color_property`, and `facet_categories` / `color_categories`.
- **Filters:** `filters.visible`, `color1` / `color2`, `facet1` / `facet2`, including highlights that came from a selection (`[SELECTED-POINTS]`).
- **Things the user said:** "I don't want the mean", "only breast", "log scale". These persist until withdrawn.

A highlight is easy to keep because the user handed you an explicit list. A structural property such as an expansion is not listed anywhere; you have to notice it in the previous config.

**Changing plot type.** Keep the same breakdown, and map it onto the new plot type (`[PLOT-TYPES]` says what facets become: violin tracks in `density_1d`, clusters in `waterfall`, panels in `scatter`).

- `density_1d` to `scatter` ("plot this against X"): the quantity the density showed goes on one axis **unchanged, expansion included**, and the new quantity goes on the other axis as a `raw_slice`. "Plot A against B" puts A on `y` and B on `x`. If the old plot expanded, the scatter needs `expand_by` and `facet_by: "expansion"` too (see `[EXPAND-BY]`).
- `scatter` to `density_1d` or `waterfall`: keep the axis the user names and carry the grouping. Drop the other axis only when asked.

**If the breakdown genuinely cannot carry over** (for example the new plot type cannot facet), do not collapse it quietly. Say what cannot be kept, offer the nearest alternative, and ask. Do not leave it to the user to say "keep it faceted": the default is to preserve.

**Say what you kept.** Start the reply with one line: "Keeping the per-dose panels and the two highlighted models; adding EGFR on x." That lets the user correct you in one reply.

### Worked example

Turn 1, "plot ERLOTINIB viability grouped by dose": a `density_1d` with one expanded axis.

```json
{
  "version": 2,
  "plot_type": "density_1d",
  "index_type": "depmap_model",
  "dimensions": {
    "x": {
      "axis_type": "aggregated_slice",
      "aggregation": "expansion",
      "dataset_id": "Prism_oncology_unified_viability",
      "slice_type": "compound_dose",
      "context": { "…": "ERLOTINIB doses, as in the final config below" }
    }
  },
  "expand_by": [
    { "slice_type": "compound_dose", "context": { "…": "same context" } }
  ],
  "facet_by": "expansion"
}
```

Turn 2: the user selects two models and asks about them. The plot is redrawn with them highlighted (`color_by: "raw_slice"`, see `[SELECTED-POINTS]`).

Turn 3, "can we plot this against EGFR CRISPR gene effect?" **Wrong:** the doses are averaged and the facets are gone. Nothing errors and data still comes back, so the failure is silent: it is just the wrong plot.

```json
{
  "version": 2,
  "plot_type": "scatter",
  "dimensions": {
    "x": {
      "axis_type": "raw_slice",
      "aggregation": "first",
      "dataset_id": "Chronos_Combined",
      "slice_type": "gene",
      "context": { "…": "EGFR" }
    },
    "y": {
      "axis_type": "aggregated_slice",
      "aggregation": "mean",
      "dataset_id": "Prism_oncology_unified_viability",
      "slice_type": "compound_dose",
      "context": { "…": "ERLOTINIB doses" }
    }
  }
}
```

**Right:** the same quantity on `y`, unchanged and still expanded; EGFR added on `x`; highlight kept; `expand_by` and `facet_by: "expansion"` kept.

The doses are selected by `CompoundID` directly on `compound_dose_metadata`. That column is on the child's own table, so no `reindex_through` is needed (compare the label-based approach in `[REINDEX-THROUGH]`).

```json
{
  "version": 2,
  "plot_type": "scatter",
  "index_type": "depmap_model",
  "dimensions": {
    "x": {
      "axis_type": "raw_slice",
      "aggregation": "first",
      "dataset_id": "Chronos_Combined",
      "slice_type": "gene",
      "context": {
        "dimension_type": "gene",
        "name": "EGFR",
        "expr": { "==": [{ "var": "given_id" }, "1956"] },
        "vars": {}
      }
    },
    "y": {
      "axis_type": "aggregated_slice",
      "aggregation": "expansion",
      "dataset_id": "Prism_oncology_unified_viability",
      "slice_type": "compound_dose",
      "context": {
        "dimension_type": "compound_dose",
        "name": "ERLOTINIB",
        "expr": { "==": [{ "var": "compound_id" }, "DPC-002573"] },
        "vars": {
          "compound_id": {
            "dataset_id": "compound_dose_metadata",
            "identifier": "CompoundID",
            "identifier_type": "column"
          }
        }
      }
    }
  },
  "expand_by": [
    {
      "slice_type": "compound_dose",
      "context": {
        "dimension_type": "compound_dose",
        "name": "ERLOTINIB",
        "expr": { "==": [{ "var": "compound_id" }, "DPC-002573"] },
        "vars": {
          "compound_id": {
            "dataset_id": "compound_dose_metadata",
            "identifier": "CompoundID",
            "identifier_type": "column"
          }
        }
      }
    }
  ],
  "facet_by": "expansion",
  "color_by": "raw_slice",
  "filters": {
    "color1": {
      "name": "HCC827",
      "dimension_type": "depmap_model",
      "expr": { "==": [{ "var": "given_id" }, "ACH-000012"] },
      "vars": {}
    },
    "color2": {
      "name": "YD38",
      "dimension_type": "depmap_model",
      "expr": { "==": [{ "var": "given_id" }, "ACH-000762"] },
      "vars": {}
    }
  },
  "show_regression_line": true
}
```

## [PLOT-TYPES] Plot types

| `plot_type`           | Dimensions | Shows                                                                                          |
| --------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `density_1d`          | `x`        | Distribution of one quantity. Facets become violin tracks.                                     |
| `waterfall`           | `x`        | Sorted values of one quantity. Facets become x-axis clusters.                                  |
| `scatter`             | `x`, `y`   | `y` against `x`. Facets become small-multiples panels.                                         |
| `correlation_heatmap` | `x`        | Pairwise correlations among the members of `x`'s context. Cannot use `color_by` or `facet_by`. |

Optional per-type fields: `sort_by` (`density_1d`/`waterfall`: `"mean_values_asc"`, `"mean_values_desc"`, `"max_values"`, `"min_values"`, `"num_points"`, `"alphabetical"`), `hide_points` (`density_1d`), `hide_identity_line` (`scatter`).

## [DIMENSIONS] Dimensions

`dimensions` has `x`, plus `y` for scatter. It may also have `color` and `facet` (see `[COLOR-AND-FACET]`). Each dimension is an object with these required fields:

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `axis_type`   | `"raw_slice"` (one gene/model/etc. read directly) or `"aggregated_slice"` (a group collapsed to one number per point).                                                                                                                                                                                                                                                                                       |
| `aggregation` | `"first"` for a `raw_slice`. `"correlation"` for a heatmap. Otherwise `"mean"`, `"median"`, `"25%tile"`, `"75%tile"`, `"stddev"`, or `"expansion"` (see `[EXPAND-BY]`).                                                                                                                                                                                                                                      |
| `dataset_id`  | The dataset to read. Its sample type or feature type must equal `index_type`.                                                                                                                                                                                                                                                                                                                                |
| `slice_type`  | The complement of `index_type`: a feature type if `index_type` is a sample type, and vice versa. It must be **exactly the dataset's other index type**, not a parent or child of it. A mismatch is not rejected: it silently returns an all-null axis. For example, a dataset indexed by `compound_dose` with `slice_type: "compound_v2"` plots nothing. **If an axis comes back empty, the type is wrong.** |
| `context`     | A context describing which entities form the slice. See `[CONTEXT-FORMAT]`.                                                                                                                                                                                                                                                                                                                                  |

**A raw slice still needs a context.** Use the magic variable `given_id`, which needs no entry in `vars` and refers to the entity's own ID (Entrez ID for genes, `ACH-` ID for models):

```json
{
  "dimension_type": "gene",
  "name": "TP53",
  "expr": { "==": [{ "var": "given_id" }, "7157"] },
  "vars": {}
}
```

**A feature type can be the index.** With `index_type: "gene"` and `slice_type: "depmap_model"`, each point is a gene and an axis reads one model (a `raw_slice` with a model `given_id`) or a group of models (`aggregated_slice`).

**Aggregating a group**: a lineage's mean dependency, with its out-group on the other axis. `!` negates, but prefer `complement` (null-safe, see `[OPERATORS]`) for out-groups:

```json
{
  "version": 2,
  "plot_type": "scatter",
  "index_type": "gene",
  "dimensions": {
    "x": {
      "axis_type": "aggregated_slice",
      "aggregation": "mean",
      "slice_type": "depmap_model",
      "dataset_id": "Chronos_Combined",
      "context": {
        "name": "Breast",
        "dimension_type": "depmap_model",
        "expr": { "==": [{ "var": "0" }, "Breast"] },
        "vars": {
          "0": {
            "dataset_id": "depmap_model_metadata",
            "identifier": "OncotreeLineage",
            "identifier_type": "column"
          }
        }
      }
    },
    "y": {
      "…": "same as x, but name 'Not Breast' and expr {\"complement\": {\"==\": [{\"var\": \"0\"}, \"Breast\"]}}"
    }
  }
}
```

**Correlation heatmap**: `x`'s context is the _set of features_ to correlate (not something to aggregate), with `aggregation: "correlation"`.

```json
{
  "version": 2,
  "plot_type": "correlation_heatmap",
  "index_type": "depmap_model",
  "dimensions": {
    "x": {
      "axis_type": "aggregated_slice",
      "aggregation": "correlation",
      "dataset_id": "Chronos_Combined",
      "slice_type": "gene",
      "context": {
        "name": "DeNovoPyrimidine",
        "dimension_type": "gene",
        "expr": { "in": [{ "var": "0" }, ["CAD", "CTPS1", "DHODH", "UMPS"]] },
        "vars": {
          "0": {
            "dataset_id": "gene_metadata",
            "identifier": "label",
            "identifier_type": "column"
          }
        }
      }
    }
  }
}
```

**`filters.distinguish1` / `distinguish2`** (heatmap only) pre-filter the `index_type` entities before correlating, producing two heatmaps (e.g. Lung vs `complement` of Lung). Hovering a cell shows its value in both. Set both; one alone is supported but not meaningful.

## [COLOR-AND-FACET] Coloring and faceting

`color_by` and `facet_by` are independent, with one link: **in version 2, an omitted `color_by` means "color by whatever `facet_by` is doing."** (In version 1 it meant no color. That is why `version` must be stamped.) Neither can be used with `correlation_heatmap`.

### Prefer faceting for high-cardinality groupings

Coloring draws every category in the same space; with 30+ lineages the points overplot and the legend is unreadable. Faceting gives each category its own track, cluster or panel. **For categorical properties with many values (e.g. `OncotreeLineage`), set `facet_by`, not just `color_by`.** With `version: 2` and `color_by` omitted, you get both. Use a standalone `color_by` (with `facet_by` unset, or `color_by: "uniform"`) only for low-cardinality groupings or continuous values.

### Backing fields by mode

Both fields take a mode, and each mode reads its own backing field:

| Mode                 | `color_by` reads                       | `facet_by` reads                    | Notes                                                                                                                                                                   |
| -------------------- | -------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"raw_slice"`        | `filters.color1`, optional `color2`    | `filters.facet1`, optional `facet2` | One entity per group. Contexts must have `dimension_type` = `index_type`. Points in neither group go to an automatic "Other"; overlap (with two groups) goes to "Both". |
| `"aggregated_slice"` | `filters.color1/2`                     | `filters.facet1/2`                  | Same, but each context resolves to many entities.                                                                                                                       |
| `"property"`         | `metadata.color_property`              | `metadata.facet_property`           | A SliceQuery to a categorical/text column. A continuous column is binned automatically.                                                                                 |
| `"custom"`           | `dimensions.color`                     | `dimensions.facet`                  | A raw or aggregated slice. Continuous values are binned.                                                                                                                |
| `"expansion"`        | —                                      | needs `expand_by`                   | See `[EXPAND-BY]`. Without `expand_by` it is dropped.                                                                                                                   |
| `"facet"`            | defer to `facet_by` (same as omitting) | —                                   |                                                                                                                                                                         |
| `"uniform"`          | no coloring, even if `facet_by` is set | —                                   |                                                                                                                                                                         |

**There is no `facet3`. Two hand-made groups is the maximum** with `raw_slice`/`aggregated_slice`. For three or more groups, facet by a property.

Fragments:

```json
"facet_by": "property",
"metadata": {
  "facet_property": {
    "dataset_id": "depmap_model_metadata",
    "identifier": "OncotreeLineage",
    "identifier_type": "column"
  }
}
```

```json
"color_by": "aggregated_slice",
"filters": {
  "color1": { "name": "Breast", "dimension_type": "depmap_model", "expr": { "==": [{ "var": "0" }, "Breast"] }, "vars": { "0": { "dataset_id": "depmap_model_metadata", "identifier": "OncotreeLineage", "identifier_type": "column" } } }
}
```

```json
"color_by": "custom",
"dimensions": { "x": { "…": "…" }, "color": { "…": "a raw or aggregated slice, same shape as x" } }
```

A plot with `facet_by` and `color_by: "property"` on different properties colors by one and facets by the other.

### Hover metadata

`metadata` also holds extra annotations shown on hover: any keys except `color_property` (and `facet_property`), each a SliceQuery. Example: `"metadata": {"sex": {"dataset_id": "depmap_model_metadata", "identifier": "Sex", "identifier_type": "column"}}`.

## [EXPAND-BY] Expanding instead of aggregating

Normally an `aggregated_slice` collapses a context (all transcripts of CD44; all BRAF inhibitors) into one number per point. **Expansion** instead gives each member its own point, so N models × M members yields N×M points.

Both of these are required:

1. The expanding axis sets `"aggregation": "expansion"`.
2. A plot-level `expand_by` (sibling of `dimensions`) with one entry repeating that axis's `slice_type` and `context`.

```json
{
  "version": 2,
  "plot_type": "density_1d",
  "index_type": "depmap_model",
  "dimensions": {
    "x": {
      "axis_type": "aggregated_slice",
      "aggregation": "expansion",
      "dataset_id": "OmicsExpressionTranscriptTPMLogp1_MC_HumanAllGenes",
      "slice_type": "transcript",
      "context": {
        "dimension_type": "transcript",
        "name": "CD44",
        "expr": { "==": [{ "var": "gene" }, "CD44"] },
        "vars": {
          "gene": {
            "dataset_id": "transcript_metadata",
            "identifier": "Gene",
            "identifier_type": "column"
          }
        }
      }
    }
  },
  "expand_by": [
    {
      "slice_type": "transcript",
      "context": {
        "dimension_type": "transcript",
        "name": "CD44",
        "expr": { "==": [{ "var": "gene" }, "CD44"] },
        "vars": {
          "gene": {
            "dataset_id": "transcript_metadata",
            "identifier": "Gene",
            "identifier_type": "column"
          }
        }
      }
    }
  ],
  "facet_by": "expansion"
}
```

Rules:

- **At most one `expand_by` entry** (an array only for future use).
- **For a `scatter`, whenever you set `expand_by`, also set `"facet_by": "expansion"`.** Never emit an expanded scatter with another `facet_by` or none: every entity then appears many times in one panel, which readers find confusing, and the user cannot select points on such a plot.
- **Which members are drawn.** Omit `members` and the plot picks the ones whose values vary most. Set `members` (a list of IDs) to choose by hand. The cap is `clamp(round(430 / sqrt(N)), 2, 16)` where N is the dataset's index-axis size (≈16 for a few hundred models, ≈3 for 20,000 genes), and applies to hand-picked lists too. Ids not in the context are ignored. Don't record the cap in a link.
- **Only `x` and `y` may expand.** `dimensions.color` and `dimensions.facet` with `"expansion"` are rejected; use `color_by`/`facet_by: "expansion"`.
- **Never give `x` and `y` the same quantity.** If both axes have the same `dataset_id`, `slice_type` and `context`, every panel plots a member against itself (a diagonal line). "Plot the transcripts of CD44 against each other" or "compare the isoforms/doses" is a one-dimensional breakdown, not a scatter: use `density_1d` with `facet_by: "expansion"`.
- **Both axes may expand the same members, but only from different datasets** (short-read vs long-read expression): give each `"expansion"` and the same `slice_type` and `context`; `dataset_id` must differ. Every expanding axis must share `expand_by`'s `slice_type`, or it silently comes out all-null.
- An axis over the same `slice_type` with a **real aggregation** is aggregated and broadcast: one value per model repeated across the members. Useful for "each transcript against the gene's mean".
- Old `limit`/`offset` fields are ignored.

## [FILTERS-AND-CATEGORIES] Filtering and showing only some categories

**`filters.visible`** is a context that restricts which points are drawn. Everything else is removed.

```json
"filters": {
  "visible": { "name": "Skin", "dimension_type": "depmap_model", "expr": { "==": [{ "var": "0" }, "Skin"] }, "vars": { "0": { "dataset_id": "depmap_model_metadata", "identifier": "OncotreeLineage", "identifier_type": "column" } } }
}
```

**"Just the top 5 lineages" / "only Lung and Skin".** Facet by the property and choose how the rest is treated. Don't use `facet_by: "aggregated_slice"` (two groups max).

- **Default: `filters.visible` with an `in` expression** (`{"in": [{"var": "0"}, ["Lung", "Skin"]]}`). Other points vanish; no "Other" panel.
- **Alternative: `facet_categories`** — `"facet_by": "property", "facet_categories": ["Lung", "Skin"]`. Other points are kept and collapsed into one "Other" group. Use it when the user wants the rest as context.
- Notes: `facet_categories` overrides the default ranking (categories with distinctive positions); at most 40 are drawn; unknown names are ignored, and if none match the default ranking is used. `color_categories` is the `color_by` equivalent; when `color_by` is omitted or `"facet"`, `facet_categories` governs colors too.
- **"Top N" is a judgment call.** Say which you chose and by what criterion (e.g. number of cell lines).

## [REGRESSION-LINE] Regression lines

`"show_regression_line": true` (scatter only) adds a linear fit. Treat it as a default to lean toward.

**Include it** when asking whether x and y are related ("correlate", "track", "predict", "does X depend on Y"), and on faceted scatters with ≲8 panels, where comparing slopes is the point.

**Omit it** when looking for outliers or structure rather than a trend; when x and y measure the same quantity (replicates, two releases), where the identity line is the reference; with many panels (30+); or when points form distinct clusters the plot is not faceted or colored by (a single line through separated groups suggests a relationship that is really group separation).

When close, include it: an unwanted line is easy to toggle off.

**`"show_regression_line_per_color": true`** fits one line per color within each panel. It only applies on a faceted scatter whose `color_by` is a _different_ partition than `facet_by` (not `"facet"`/`"uniform"`), and it is dropped otherwise. Off by default because many colors become unreadable; use it only when per-color trends are the point.

## [CONTEXT-FORMAT] Contexts

A context is a rule that selects entities of one type. It appears in `dimensions.*.context`, `filters.*` (`color1/2`, `facet1/2`, `visible`, `distinguish1/2`), and inside other contexts. Fields:

| Field            | Meaning                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `name`           | Human-readable label. Not used in evaluation, but used in the UI and axis labels.              |
| `dimension_type` | The entity type the rule applies to and returns IDs of.                                        |
| `expr`           | A JsonLogic rule evaluated on each entity, or `true` for all entities.                         |
| `vars`           | Maps variable names used in `expr` to SliceQueries. `given_id` is built in and needs no entry. |
| `contexts`       | _(optional)_ Named inner contexts. See `[NESTED-CONTEXTS]`.                                    |

**SliceQuery**: `{"dataset_id", "identifier", "identifier_type"}` where `identifier_type` is one of `feature_id`, `feature_label`, `sample_id`, `sample_label`, `column`. Extra fields (`label`, `source`) are ignored. A var resolves to one value per entity (null if missing). Examples: a metadata column (`depmap_model_metadata`/`OncotreeLineage`/`column`), a gene's expression (`expression`/`RB1`/`feature_label`), a gene's copy number (`copy_number_relative`/`2064`/`feature_id`).

**Combine data types freely.** A context can mix metadata and measurements, e.g. "adherent models with EMT score > 0.25" = `and` of a `ssgsea` var `>` 0.25 and a `GrowthPattern` var `==` "Adherent". Context Manager contexts work anywhere a context is accepted.

## [OPERATORS] Operators in `expr`

Syntax is JsonLogic: `{"operator": [args…]}`.

| Operator                    | Meaning                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `var`                       | Look up a variable: `{"var": "given_id"}`                                                                |
| `==`, `!=`                  | Equality / inequality                                                                                    |
| `>`, `>=`, `<`, `<=`        | Comparisons                                                                                              |
| `and`, `or`                 | One or more arguments                                                                                    |
| `in`                        | Membership of a value in an array                                                                        |
| `!in`                       | Not a member                                                                                             |
| `has_any`, `!has_any`       | Two lists share (do not share) an element. For list-valued vars.                                         |
| `in_context`, `!in_context` | Value is (is not) in a named inner context: `{"in_context": [{"var": "given_id"}, {"context": "Name"}]}` |
| `is_null`, `not_null`       | Unary; test for missing values                                                                           |
| `complement`                | Null-safe negation of a whole expression. Use it for out-groups. Hand-written is fine.                   |

**Null handling:** a null never satisfies `!=`, `!in`, `!has_any`, `!in_context` or `complement`. Entities with no data for a variable are excluded from both a group and its complement. Use `is_null` if you want to match missing values.

## [REINDEX-THROUGH] Reading a column from a different entity type

By default a var lives on the context's own `dimension_type`. `reindex_through` lets a var follow a foreign-key column to a different type. The outer query is the value you want; `reindex_through` names the bridge column, nested one level per hop. The result is indexed by the context's own type.

**Don't build chains by hand. Ask Breadbox:** `GET /types/dimensions/{dimension_type}/reachable`. It returns `routes`, each with `hops` (`column`, `target_type`, `cardinality`), `result_is_list`, and `tables`, each with `columns` and a `slice_query_template`.

1. Take the `slice_query_template` of the table you want and **copy it verbatim**.
2. Add one field, `identifier`, set to one of that table's `columns`.
3. Drop any `reindex_through` whose value is `null`.

Example, a `screen` context reading the lineage of its model through two hops:

```json
{
  "dataset_id": "depmap_model_metadata",
  "identifier": "OncotreeLineage",
  "identifier_type": "column",
  "reindex_through": {
    "dataset_id": "modelcondition_metadata",
    "identifier": "ModelID",
    "identifier_type": "column",
    "reindex_through": {
      "dataset_id": "screen_metadata",
      "identifier": "ModelConditionID",
      "identifier_type": "column"
    }
  }
}
```

Choosing among routes:

- **Only use tables with `offered_by_picker: true`.** Others resolve but the UI cannot display them as the selected value.
- **Several routes can reach the same table** (e.g. control vs test arm of a `screen_pair`). They answer different questions; choose by the `hops` column names and the user's request, and **ask if the request does not say.**
- **If `result_is_list` is true**, test with `in_context` or `has_any`, never `==` or `in`.
- **A type with no routes that have hops is unreachable.** Don't invent a chain.
- Chains are depth-limited (`max_depth`, default 4), must use `column` for every intermediate step, cannot skip levels, and left-join (unresolved values are null).
- The endpoint only lists datasets the caller may read.

### Child types: "per dose", "per timepoint", "per replicate"

`reachable` only goes **forward**, to types that your type's columns reference. It never shows a type that references _yours_. When a user wants a breakdown per member of a type, the data may live in a **child type**: one with a foreign-key column pointing at your type, many child rows to one parent. For example, `compound_dose` has `CompoundID` (referencing `compound_v2`) and `Dose`. Timepoints and replicates have the same shape.

If the type you have shows no such data, don't conclude it doesn't exist. Ask Breadbox what references it:

```
GET /types/dimensions/{type}/referenced-by
```

Each entry of `referenced_by` is a type with `tables`; each table has `slice_dataset_id`, `is_primary`, `columns`, and `references` (the columns pointing at `{type}`, with `cardinality` and `relationship_from_child`: `many_to_one`, or `many_to_many` for list columns). To find datasets at that level, call `GET /types/dimensions/reference-graph` and look in `matrix_datasets` for one whose `feature_type` or `sample_type` is the child.

- **A type can have several children.** `compound_v2` is referenced by `compound_dose`, `compound_sample`, `ctd2_sample` and `sgdc_compound`, each through `CompoundID`. Pick by the child's columns (a `Dose` column marks dose level) and by whether any dataset is indexed by it. If several fit, say which you chose and why.
- **Several datasets can sit at the child level** (seven are indexed by `compound_dose`, e.g. `GDSC1_Viability`, `GDSC2_Viability`, `CTRP_Viability`, `Prism_oncology_viability`, `REPURPOSING_Viability`). Choose by what the user asked, say which and why, and offer the alternatives.
- **A dataset contains only the child rows it screened.** The compound's doses may be missing from the dataset you pick, so check the plot is not empty.
- **`referenced-by` is discovery only.** It has no `slice_query_template`. Never use `reindex_through` to go from parent to children; that would mean choosing among or aggregating many rows.
- **Ignore self-references** (a type that references itself) in `referenced-by`. Grandchildren (a child's children) need one `referenced-by` call per level; stop after one or two levels.
- **Plot at the child level.** A dose-level matrix goes on a `compound_dose` axis, not a `compound_v2` one. Don't average, pick a dose, or otherwise aggregate for the user. If they want one number per compound, ask which.
- **To bring parent attributes onto a child axis, go forward:** `GET /types/dimensions/compound_dose/reachable` lists `compound_v2` via `CompoundID` with a ready template.
- **Every `reindex_through` you emit comes verbatim from a `reachable` template.** Neither `referenced-by` nor `reference-graph` supplies one.
- **The expansion cap applies to child rows.** A compound can have more doses than the member cap (ERLOTINIB has 54 dose rows across datasets). Unless `members` is set, only the members whose values vary most are drawn (see `[EXPAND-BY]`). Tell the user that not every dose is shown.
- Like the other endpoints, these return only what the caller may read.

**Worked example: BRAF expression against ERLOTINIB viability, one panel per dose.** It combines `[EXPAND-BY]`, `[REINDEX-THROUGH]` and the rules above. The compound is selected through the verbatim `compound_dose` → `compound_v2` template (from `reachable`) with `identifier: "label"` added, and `expand_by` repeats the y axis's `slice_type` and `context`. `"show_regression_line": true` is a reasonable addition.

```json
{
  "version": 2,
  "plot_type": "scatter",
  "index_type": "depmap_model",
  "dimensions": {
    "x": {
      "axis_type": "raw_slice",
      "aggregation": "first",
      "dataset_id": "expression",
      "slice_type": "gene",
      "context": {
        "dimension_type": "gene",
        "name": "BRAF",
        "expr": { "==": [{ "var": "given_id" }, "673"] },
        "vars": {}
      }
    },
    "y": {
      "axis_type": "aggregated_slice",
      "aggregation": "expansion",
      "dataset_id": "GDSC1_Viability",
      "slice_type": "compound_dose",
      "context": {
        "dimension_type": "compound_dose",
        "name": "ERLOTINIB doses",
        "expr": { "==": [{ "var": "compound" }, "ERLOTINIB"] },
        "vars": {
          "compound": {
            "dataset_id": "compound_v2_metadata",
            "identifier": "label",
            "identifier_type": "column",
            "reindex_through": {
              "dataset_id": "compound_dose_metadata",
              "identifier": "CompoundID",
              "identifier_type": "column"
            }
          }
        }
      }
    }
  },
  "expand_by": [
    {
      "slice_type": "compound_dose",
      "context": {
        "dimension_type": "compound_dose",
        "name": "ERLOTINIB doses",
        "expr": { "==": [{ "var": "compound" }, "ERLOTINIB"] },
        "vars": {
          "compound": {
            "dataset_id": "compound_v2_metadata",
            "identifier": "label",
            "identifier_type": "column",
            "reindex_through": {
              "dataset_id": "compound_dose_metadata",
              "identifier": "CompoundID",
              "identifier_type": "column"
            }
          }
        }
      }
    }
  ],
  "facet_by": "expansion"
}
```

## [NESTED-CONTEXTS] Contexts that refer to contexts

`contexts` maps names to complete inner contexts. A `{"context": "<name>"}` node in `expr` resolves to the list of IDs that inner context matches, which are IDs of the **inner** context's `dimension_type`, so the value tested against them must be that same kind of ID. Pair it with `in_context`. Referencing an undefined name, or nesting too deeply, is an error.

```json
{
  "dimension_type": "gene_pair",
  "expr": { "in_context": [{ "var": "gene_1" }, { "context": "selective" }] },
  "vars": {
    "gene_1": {
      "dataset_id": "gene_pair_metadata",
      "identifier": "gene_1",
      "identifier_type": "column"
    }
  },
  "contexts": {
    "selective": {
      "name": "Strongly Selective Genes",
      "dimension_type": "gene",
      "expr": { "==": [{ "var": "0" }, "strongly selective"] },
      "vars": {
        "0": {
          "dataset_id": "gene_metadata",
          "identifier": "selectivity",
          "identifier_type": "column"
        }
      }
    }
  }
}
```
