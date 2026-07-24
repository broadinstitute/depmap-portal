# OncRef "Harmonized" Rollout Plan

Today OncRef data comes from two experiments/readouts: **seq** (NGS) and **lum**
(Luminex), surfaced via constants like `PRISMOncRefSeq` / `PRISMOncRefLum`,
`Prism_oncology_seq_AUC` / `Prism_oncology_AUC`, and
`PRISMOncologyReferenceSeqLog2AUCMatrix` / `PRISMOncologyReferenceLog2AUCMatrix`.

This document maps every place in the codebase that distinguishes seq vs. lum,
so a third variant, **harmonized**, can be added consistently.

---

## 1. Backend — Core enums & dataset config (highest impact)

### `portal-backend/depmap/enums.py`

```
46:    Prism_oncology_AUC = "Prism_oncology_AUC"
47:    Prism_oncology_dose_replicate = "Prism_oncology_dose_replicate"
49:    Prism_oncology_seq_AUC = "Prism_oncology_seq_AUC"
50:    Prism_oncology_seq_dose_replicate = "Prism_oncology_seq_dose_replicate"
...
69:            DependencyEnum.Prism_oncology_AUC,
70:            DependencyEnum.Prism_oncology_seq_AUC,
91:    oncref_confounders = "oncref_confounders"
92:    oncref_seq_confounders = "oncref_seq_confounders"
```

Change needed: add `Prism_oncology_harmonized_AUC`, `Prism_oncology_harmonized_dose_replicate`
to `DependencyEnum`; add to the `is_compound_experiment_enum` set (line ~69);
add `oncref_harmonized_confounders` to `BiomarkerEnum`.

### `portal-backend/depmap/settings/shared.py`

```
161-166:  BiomarkerEnum.oncref_confounders: DatasetLabel(display_name="PRISM OncRef confounders", ..., s3_json_name="oncref-confounders", priority=3)
168-173:  BiomarkerEnum.oncref_seq_confounders: DatasetLabel(display_name="PRISM OncRef Seq confounders", ..., s3_json_name="oncref_seq-confounders", priority=103)
326-331:  DependencyEnum.Prism_oncology_AUC: DepDatasetMeta(display_name="PRISM OncRef log2(AUC) Lum", ...)
333-338:  DependencyEnum.Prism_oncology_seq_AUC: DepDatasetMeta(display_name="PRISM OncRef log2(AUC) Seq", ...)
340-343:  DependencyEnum.Prism_oncology_dose_replicate: DepDatasetMeta(display_name="PRISM OncRef Lum Dose Replicate", ...)
345-348:  DependencyEnum.Prism_oncology_seq_dose_replicate: DepDatasetMeta(display_name="PRISM OncRef Seq Dose Replicate", ...)
```

Change needed: add new `DatasetLabel`/`DepDatasetMeta` dict entries for
`oncref_harmonized_confounders`, `Prism_oncology_harmonized_AUC`,
`Prism_oncology_harmonized_dose_replicate` (with new `priority`/`global_priority` values).

### Note: do not touch `portal-backend/depmap/settings/dev.py` and `config/dev/settings.py`. These files can be left alone

## 2. Backend — Compound models / DRC datasets

### `portal-backend/depmap/compound/models.py`

```
56-65:  DRCCompoundDataset(drc_dataset_label="Prism_oncology_per_curve", viability_dataset_given_id="Prism_oncology_viability",
        replicate_dataset="Prism_oncology_dose_replicate", auc_dataset_given_id="Prism_oncology_AUC_collapsed",
        auc_dataset=DependencyEnum.Prism_oncology_AUC, display_name="PRISM OncRef Lum", assay="PRISM",
        log_auc_dataset_given_id="PRISMOncologyReferenceLog2AUCMatrix"),
66-75:  DRCCompoundDataset(drc_dataset_label="Prism_oncology_seq_per_curve", viability_dataset_given_id="Prism_oncology_seq_viability",
        replicate_dataset="Prism_oncology_seq_dose_replicate", auc_dataset_given_id="Prism_oncology_seq_AUC_collapsed",
        auc_dataset=DependencyEnum.Prism_oncology_seq_AUC, display_name="PRISM OncRef Seq", assay="PRISM",
        log_auc_dataset_given_id="PRISMOncologyReferenceSeqLog2AUCMatrix"),
308:    # This is to use as catch all for the Sample IDs(e.g. PRC-000964908-468-05 from PRISMOncRefResponseCurves)
```

This is the `drc_compound_datasets` list (drives dose-response-curve tile logic,
dose-curve display names, priorities). Change: add a third
`DRCCompoundDataset(...)` entry for harmonized with its own `drc_dataset_label`,
`viability_dataset_given_id`, `replicate_dataset`, `auc_dataset_given_id`,
`auc_dataset` enum member, `display_name="PRISM OncRef Harmonized"`,
`log_auc_dataset_given_id`.

### `portal-backend/depmap/compound/new_dose_curves_utils.py`

```
52:   # dataset, and not OncRef. We want to skip these curves.
182:  # distinguish between oncref and repurposing compound experiments. If we are looking at a CompoundExperiment from a
```

Comments only — logic is generic over `drc_compound_datasets`, so adding a
3rd entry there should flow through automatically. No literal seq/lum
enumeration here, but worth re-testing.

### `portal-backend/depmap/compound/legacy_utils.py`

```
26:  # This is necessary because we only have enriched lineage data for Prism_oncology_AUC and Rep_all_single_pt.
36:  # ...which only cares about at most Prism_oncology_AUC and Rep_all_single_pt
```

Comments only, but the logic they describe may need to be revisited if harmonized
also needs enriched-lineage support (check `does_legacy_dataset_exist_with_compound_experiment`
usage sites).

### `portal-backend/depmap/compound/api.py`

```
171-174:  "PRISMOncologyReferenceLog2AUCMatrix": ("prism_onc_ref", color_palette.prism_oncology_color),
175-178:  "PRISMOncologyReferenceSeqLog2AUCMatrix": ("prism_onc_seq_ref", color_palette.prism_oncology_color),
```

`ID_MAP` dict in `format_predictability_tile_json`. Change: add
`"PRISMOncologyReferenceHarmonizedLog2AUCMatrix": ("prism_onc_harmonized_ref", color_palette.prism_oncology_color)`
(or a new color).

### `portal-backend/depmap/compound/views/index.py`

```
83-99: show_enriched_lineages = (
    data_access.dataset_exists(ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix.name)
    and data_access.valid_row(ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix.name, compound.label)
    or data_access.dataset_exists(ContextExplorerDatasets.PRISMOncologyReferenceSeqLog2AUCMatrix.name)
    and data_access.valid_row(ContextExplorerDatasets.PRISMOncologyReferenceSeqLog2AUCMatrix.name, compound.label)
    or data_access.dataset_exists(ContextExplorerDatasets.Rep_all_single_pt_per_compound.name) ...
```

Change needed: add a third `dataset_exists(...) and valid_row(...)` clause for
the new `ContextExplorerDatasets` harmonized member.

---

## 3. Backend — Context Explorer core (models/enum, API, filters, dose curves)

### `portal-backend/depmap/context_explorer/models.py`

```
24-28:  class ContextExplorerDatasets(enum.Enum):
            Rep_all_single_pt_per_compound = "Rep_all_single_pt_per_compound"
            PRISMOncologyReferenceLog2AUCMatrix = "PRISMOncologyReferenceLog2AUCMatrix"
            PRISMOncologyReferenceSeqLog2AUCMatrix = "PRISMOncologyReferenceSeqLog2AUCMatrix"
            Chronos_Combined = "Chronos_Combined"
35-40:  def is_oncref_dataset(dataset_id: str):
            return (
                dataset_id == ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix.name
                or dataset_id == ContextExplorerDatasets.PRISMOncologyReferenceSeqLog2AUCMatrix.name
            )
317:    if is_oncref_dataset(dataset_id): (min effect-size threshold logic)
```

**Critical file.** Change: add
`PRISMOncologyReferenceHarmonizedLog2AUCMatrix = "PRISMOncologyReferenceHarmonizedLog2AUCMatrix"`
to the enum, and add
`or dataset_id == ContextExplorerDatasets.PRISMOncologyReferenceHarmonizedLog2AUCMatrix.name`
to `is_oncref_dataset`.

### `portal-backend/depmap/context_explorer/api.py`

```
92-93:    "PRISMOncRefSeq", "PRISMOncRefLum",   (in data_type_order list for summary sort, prerelease-only)
299-300:  "PRISMOncRefLum": "oncrefLum", "PRISMOncRefSeq": "oncrefSeq"   (rename mapping for overview table columns)
693:      # for the frontend to determine the tab of context_explorer to link to: "oncrefLum", "oncrefSeq", "repurposing", or "geneDependency"
```

Change: add `"PRISMOncRefHarmonized"` to `data_type_order` list, add
`"PRISMOncRefHarmonized": "oncrefHarmonized"` rename mapping, update comment.

### `portal-backend/depmap/context_explorer/enrichment_tile_filters.py`

```
5:   from depmap.context_explorer.models import ContextExplorerDatasets, is_oncref_dataset
14:  if is_oncref_dataset(dataset_given_id):
```

Uses shared `is_oncref_dataset` helper — will pick up harmonized automatically
once `models.py` is updated. No direct edit needed if `is_oncref_dataset` is
updated centrally.

### `portal-backend/depmap/context_explorer/dose_curve_utils.py`

```
4:    from depmap.context_explorer.models import is_oncref_dataset
175:  assert is_oncref_dataset(dataset_given_id)
```

Same — relies on centralized helper, should auto-pick-up the change once
`is_oncref_dataset` includes harmonized. Also depends on `drc_compound_datasets`
(see compound/models.py) having a matching entry with `log_auc_dataset_given_id`
for lookup via `find_compound_dataset`.

### `portal-backend/depmap/entity/views/executive.py`

```
294-296:  elif given_id == "PRISMOncologyReferenceLog2AUCMatrix": dataset_type = "prism_onc_ref"; color = color_palette.prism_oncology_color
297-299:  elif given_id == "PRISMOncologyReferenceSeqLog2AUCMatrix": dataset_type = "prism_onc_seq_ref"; color = color_palette.prism_oncology_color
```

Change: add
`elif given_id == "PRISMOncologyReferenceHarmonizedLog2AUCMatrix": dataset_type = "prism_onc_harmonized_ref"; color = ...`

---

## 4. Backend — Predictability / Biomarker loading

### `portal-backend/depmap/predictability/utilities.py`

```
15:  "oncref-confounders": BiomarkerEnum.oncref_confounders,
16:  "oncref_seq-confounders": BiomarkerEnum.oncref_seq_confounders,
```

`DATASET_LABEL_TO_ENUM` dict. Change: add
`"oncref_harmonized-confounders": BiomarkerEnum.oncref_harmonized_confounders`.

### `portal-backend/loader/predictability_loader.py`

```
38-39:   "Prism_oncology_AUC": "PRISMOncologyReferenceLog2AUCMatrix", "Prism_oncology_seq_AUC": "PRISMOncologyReferenceSeqLog2AUCMatrix"  (mapping dict)
96-97:   # Below is a hack for the 24Q2 release - where none of the OncRef Predictability outputs were formatted with the "BRD:" prefix
277-278: BiomarkerDataset.BiomarkerEnum.oncref_confounders, BiomarkerDataset.BiomarkerEnum.oncref_seq_confounders  (in list of enums checked against dataset.name)
```

Change: add `"Prism_oncology_harmonized_AUC": "PRISMOncologyReferenceHarmonizedLog2AUCMatrix"`
to the mapping dict; add `BiomarkerDataset.BiomarkerEnum.oncref_harmonized_confounders`
to the list at line 277-278.

### `portal-backend/loader/dataset_loader/biomarker_loader.py`

```
41-48:  GENERIC_ENTITY_BIOMARKER_ENUMS = [ ..., BiomarkerDataset.BiomarkerEnum.oncref_confounders, BiomarkerDataset.BiomarkerEnum.oncref_seq_confounders, ... ]
```

Change: add `BiomarkerDataset.BiomarkerEnum.oncref_harmonized_confounders` to this list.

### `portal-backend/loader/dataset_loader/compound_dose_replicate_loader.py`

```
127:  # in 25Q2 the oncref dose response file contained records with no parameters
```

Comment only — check whether the loader iterates a hardcoded list of
dose-replicate dataset names elsewhere (didn't find seq/lum enumeration
directly in this file; likely driven by `dose_replicate_level_datasets` in
`dev.py`/`shared.py` covered above).

---

## 5. Backend — Data Page API

### `portal-backend/depmap/data_page/api.py`

```
37:   "Drug_OncRef_Broad",   (list of drug data type keys)
64:   "Drug_OncRef_Broad": _get_drug_count(DependencyEnum.Prism_oncology_AUC.name),
112:  "Drug_OncRef_Broad": _get_dataset_url(DependencyEnum.Prism_oncology_AUC.name),
```

Note: Data Page only has ONE combined `Drug_OncRef_Broad` entry (not split
seq/lum) — this is a single-column summary distinct from Context Explorer's
split. Decision: stays a single combined column — no change needed here for
harmonized.

### `portal-backend/depmap/utilities/_color_palette.py`, `portal-backend/depmap/static/css/shared/variables.scss`, `depmap-shared/color_palette.json`

```
_color_palette.py:35:        prism_oncology_color = "#C55252"
variables.scss:38:          $prism_oncology_color: #c55252;
color_palette.json:32:       "prism_oncology_color": "#C55252"
```

Currently lum/seq share the _same_ color (`prism_onc_ref` and
`prism_onc_seq_ref` both use `prism_oncology_color`). Decision: harmonized
uses the same `prism_oncology_color` too — no new color constant needed.

---

## 6. Pipeline — conseq pipeline (data prep / preprocessing / analysis)

### `pipeline/preprocessing-pipeline/context_explorer/get_context_analysis.py`

```
24:   ONCREF_DATASET_NAME = "PRISMOncologyReferenceLog2AUCMatrix"
25:   ONCREF_SEQ_DATASET_NAME = "PRISMOncologyReferenceSeqLog2AUCMatrix"
393-406: ## OncRef Luminex and OncRef Sequencing will use the same code. Below are wrappers
          def oncref_lum_context_analysis(tc, subtype_tree, context_matrix, oncref_auc_taiga_id, portal_compounds_taiga_id):
              return oncref_context_analysis(..., ONCREF_DATASET_NAME)
408-419: def oncref_seq_context_analysis(...): return oncref_context_analysis(..., ONCREF_SEQ_DATASET_NAME)
421-464: def oncref_context_analysis(...) — shared implementation
584-585: add_commands(subparsers, [oncref_lum_context_analysis, oncref_seq_context_analysis, repurposing_context_analysis, crispr_context_analysis])
```

Change: add `ONCREF_HARMONIZED_DATASET_NAME = "PRISMOncologyReferenceHarmonizedLog2AUCMatrix"`,
a new `oncref_harmonized_context_analysis` wrapper function calling the shared
`oncref_context_analysis`, and register it in the `add_commands` list (line 584-585).

### `pipeline/preprocessing-pipeline/context_explorer/get_context_analysis.conseq`

```
1-16:   rule oncref_lum_context_analysis: inputs: oncref_auc_taiga_id={"type":"prism_oncology_reference_auc_matrix"} ...
        outputs: {"type": "context_analysis_for_dataset", "dataset": "oncref_lum", ...}
        run: python get_context_analysis.py oncref_lum_context_analysis ...
18-33:  rule oncref_seq_context_analysis: inputs: oncref_auc_taiga_id={"type":"prism_oncology_reference_seq_log2_auc_matrix"} ...
        outputs: {"type": "context_analysis_for_dataset", "dataset": "oncref_seq", ...}
72-83:  rule merge_context_analysis_tables: inputs: csvs=all {"type": "context_analysis_for_dataset"}  (generic — auto-picks up new rule outputs)
```

Change: add a new `rule oncref_harmonized_context_analysis:` block (new taiga
artifact type e.g. `prism_oncology_reference_harmonized_log2_auc_matrix`,
`"dataset": "oncref_harmonized"` output). The merge rule is generic and needs
no change.

### `pipeline/preprocessing-pipeline/context_explorer/get_data_availability.py`

```
25-27:   prism_oncology_reference_auc_matrix = get_id(taiga_ids["oncref_auc_taiga_id"])
         prism_oncology_reference_seq_log2_auc_matrix = get_id(taiga_ids["prism_oncology_reference_seq_log2_auc_matrix"])
36:      resulting_cols = ["CRISPR", "RNAi", "WES", "WGS", "RNASeq", "PRISMRepurposing"]
71-82:   # PRISM OncRef Seq
         if prism_oncology_reference_seq_log2_auc_matrix is not None:
             OncRef_Seq_Matrix = tc.get(prism_oncology_reference_seq_log2_auc_matrix)
             ...
             overall_summary["PRISMOncRefSeq"] = False
             overall_summary.loc[..., "PRISMOncRefSeq"] = True
             resulting_cols.insert(-1, "PRISMOncRefSeq")  # put the oncref column before the PRISMOncRefLum column
84-95:   # PRISM OncRef Lum
         if prism_oncology_reference_auc_matrix is not None:
             OncRef_Matrix = tc.get(prism_oncology_reference_auc_matrix)
             ...
             overall_summary["PRISMOncRefLum"] = False
             overall_summary.loc[..., "PRISMOncRefLum"] = True
             resulting_cols.insert(-1, "PRISMOncRefLum")
```

Change: add a new taiga_id lookup (e.g.
`prism_oncology_reference_harmonized_log2_auc_matrix`), a new
`# PRISM OncRef Harmonized` block with `OncRef_Harmonized_Matrix`,
`overall_summary["PRISMOncRefHarmonized"]`, and insert into `resulting_cols`.

### `pipeline/preprocessing-pipeline/context_explorer/get_data_availability.conseq`

```
7:    artifacts=all {"type" ~ "...|prism_oncology_reference_auc_matrix|prism_oncology_reference_seq_log2_auc_matrix|..."}  (regex union of types collected)
9:    artifacts=all {"type" ~ "...|prism_oncology_reference_auc_matrix|prism_oncology_reference_seq_log2_auc_matrix|..."}
14:   #  oncref_auc_taiga_id=all {"type":"prism_oncology_reference_auc_matrix"}   (commented-out example)
39-40:('oncref_auc_taiga_id', 'prism_oncology_reference_auc_matrix'), ('prism_oncology_reference_seq_log2_auc_matrix', 'prism_oncology_reference_seq_log2_auc_matrix'),
```

Change: add `prism_oncology_reference_harmonized_log2_auc_matrix` to the
`type ~ "..."` regex unions and to the tuple list at line 39-40.

### `pipeline/preprocessing-pipeline/data_page/get_all_data_availability.py`

```
140-152:  def get_oncref_summary(tc, depmap_oncref_taiga_id):
             oncref_df = tc.get(depmap_oncref_taiga_id)
             ...assign(Drug_OncRef_Broad=True)...
508:       depmap_oncref_taiga_id = get_taiga_id(taiga_ids["oncref_taiga_id"])
557-563:   oncref_summary = None
           if len(depmap_oncref_taiga_id) > 0:
               oncref_summary = get_oncref_summary(tc, depmap_oncref_taiga_id=f"{depmap_oncref_taiga_id[0]}/PRISMOncologyReferenceLumViabilityMatrix")
689:       oncref_summary,   (merged into final summary list)
```

This produces the single combined `Drug_OncRef_Broad` column for the Data
Page (mirrors the `Drug_OncRef_Broad` note above) — currently only reads the
Lum matrix explicitly (hardcoded `PRISMOncologyReferenceLumViabilityMatrix`).
No literal "seq" variant appears here at all — likely intentional
simplification for Data Page. Flag: decide if harmonized needs representation
on the Data Page too (currently seq isn't separately shown there either).

### `pipeline/preprocessing-pipeline/data_page/get_all_data_availability.conseq`

```
7:   artifacts=all {"type" ~ "...|depmap_oncref_taiga_id|..."}
36:  ('oncref_taiga_id', 'depmap_oncref_taiga_id'),
```

No seq-specific entry exists here to mirror — consistent with the above.

### `pipeline/preprocessing-pipeline/scripts/process_drug_screen_auc_matrix.py`

```
26-33:  assert label in ["Prism_oncology_AUC", "Prism_oncology_seq_AUC", "Prism_oncology_IC50", "GDSC1_AUC", "GDSC2_AUC", "Repurposing_secondary_AUC", "CTRP_AUC"]
53:     if label not in ["Prism_oncology_AUC", "Prism_oncology_seq_AUC"]: ... (build sample/compound ID mapping — skipped for oncref-style labels)
67:     # Here's a special case: For some reason oncref has PRC IDs (sample IDs), while all the others have compound IDs.
```

Change: add `"Prism_oncology_harmonized_AUC"` to both the
`assert label in [...]` list (line 26-33) and the `if label not in [...]`
check (line 53).

### `pipeline/preprocessing-pipeline/scripts/process_viability_dataset_from_taiga.py`

```
25-26:  ### The if block is here to convert the new oncref format to the old viability format ...
```

Check the actual conditional (not fully shown in grep) for label-list
membership similar to above; likely needs a harmonized label added too.

### `pipeline/preprocessing-pipeline/cor_analysis/` (test.conseq, test2.conseq, create_cor_analysis_pairs.py, correlation_with_qvalue.py)

```
create_cor_analysis_pairs.py:7-11:
    skip_if_missing = ["PRISMOncologyReferenceLog2AUCMatrix", "Prism_oncology_viability", "PRISMOncologyReferenceSeqLog2AUCMatrix", "Prism_oncology_seq_viability"]
create_cor_analysis_pairs.py:33-39 (make_drug_vs_genetic): same 4 literal strings repeated in a for-loop list, alongside REPURPOSING/CTRP/GDSC1/GDSC2 given IDs
correlation_with_qvalue.py:571,601,607: hardcoded taiga IDs "prism-oncology-reference-set-24q4-c0d0.1/PRISMOncologyReferenceAUCMatrix", ".../PRISMOncologyReferenceLog2ViabilityCollapsedMatrix", ".../PRISMOncologyReferenceLog2ViabilityCollapsedConditions" (lum only — no seq equivalent present, likely a script default/example)
test.conseq:11,20,28: 'given_id': 'oncref-viability' / 'oncref-auc' / 'oncref-ic50' (lum, commented mostly)
test2.conseq:4,13,21: same three given_ids (uncommented in test2)
```

Change: add `"PRISMOncologyReferenceHarmonizedLog2AUCMatrix"` and
`"Prism_oncology_harmonized_viability"` to both lists in
`create_cor_analysis_pairs.py` (lines 7-11 and 33-39).
`correlation_with_qvalue.py` hardcodes only lum taiga IDs currently (no seq) —
likely test/dev-only code, check if harmonized needs a parallel constant.
Update `test.conseq`/`test2.conseq` fixtures if new correlation pairs need
harmonized coverage.

### `pipeline/data-prep-pipeline/legacy_data/legacy_data_inputs.conseq`

```
13-16:  add-if-missing {"type": "oncref_confounders", "dataset_id": "prism-oncology-reference-set-23q4-1a7c.11/PRISM_Oncology_Reference_23Q4_Confounders"}
```

Only lum confounders present (no seq entry here either). Change: add
harmonized confounders artifact entry if legacy-data ingestion needs it (and
possibly a missing seq entry too).

### `pipeline/data-prep-pipeline/filter_portal_compounds.conseq`

```
1-4:   # This is because the prism_oncology_reference_lum_log2_auc_matrix is optional meaning it is available for internal
       # ...by using an all{stub-artifact|[onref_auc_matrix]} input. This way prism_oncology_reference_lum_log2_auc_matrix is not...
13:    prism_oncology_reference_lum_log2_auc_matrix=all{"type"~ "prism_oncology_reference_lum_log2_auc_matrix|stub-artifact"},
14:    prism_oncology_reference_seq_log2_auc_matrix=all{"type"~ "prism_oncology_reference_seq_log2_auc_matrix|stub-artifact"},
27-28: {% if inputs.prism_oncology_reference_lum_log2_auc_matrix|length > 1 %} --sample-id-of-table {{...}} \
30-31: {% if inputs.prism_oncology_reference_seq_log2_auc_matrix|length > 1 %} --sample-id-of-table {{...}} \
```

Change: add a third input
`prism_oncology_reference_harmonized_log2_auc_matrix=all{"type"~ "prism_oncology_reference_harmonized_log2_auc_matrix|stub-artifact"},`
plus a matching `{% if ... %}` templated CLI arg block.

---

## 7. Frontend — Shared type packages (`@depmap/types`, `@depmap/api`, `@depmap/data-explorer-2`)

### `frontend/packages/@depmap/types/src/context-explorer.ts`

```
16-20: export enum ContextExplorerDatasets {
          Chronos_Combined = "Chronos_Combined",
          Rep_all_single_pt_per_compound = "Rep_all_single_pt_per_compound",
          PRISMOncologyReferenceLog2AUCMatrix = "PRISMOncologyReferenceLog2AUCMatrix",
          PRISMOncologyReferenceSeqLog2AUCMatrix = "PRISMOncologyReferenceSeqLog2AUCMatrix",
        }
```

**Critical shared type — mirrors backend `models.py` enum.** Change: add
`PRISMOncologyReferenceHarmonizedLog2AUCMatrix = "PRISMOncologyReferenceHarmonizedLog2AUCMatrix"`.

### `frontend/packages/@depmap/types/src/data_page.ts`

```
18:  Drug_OncRef_Broad = "Drug_OncRef_Broad",
```

Single combined enum member (not seq/lum split) in `DataPageDataType`. Data
Page doesn't split by variant — decision: no change needed here.

### `frontend/packages/@depmap/api/src/legacyPortalAPI/resources/context_explorer.ts`

```
13-24: enum DataType { PRISMRepurposing, PRISMOncRefLum, PRISMOncRefSeq, RNASeq, WGS, WES, RNAi, CRISPR, default }
41-54: switch (datatypeIndex) {
          case DataType.CRISPR: case DataType.RNAi: return LossOfFunction;
          case DataType.WES: case DataType.WGS: case DataType.RNASeq: return OMICS;
          case DataType.PRISMOncRefSeq: case DataType.PRISMOncRefLum: case DataType.PRISMRepurposing: return CompoundViability;
          default: return Subtype;
        }
```

Change: add `PRISMOncRefHarmonized` to the `DataType` enum (line 16-17) and to
the `case` list in the switch (line 53-54). This is a numeric (non-string)
enum; per decision above, ordinal-shift from inserting/appending the new
member is acceptable — no conversion to string enum needed.

### `frontend/packages/@depmap/data-explorer-2/src/utils/slice-id.ts`

```
17-19:  case "Prism_oncology_AUC": return "PRISMOncologyReferenceLog2AUCMatrix";
```

`legacyPortalIdToBreadboxGivenId` switch — only maps lum (no seq case at all,
pre-existing gap). Change: add a case for `Prism_oncology_harmonized_AUC` if
this ID needs legacy→breadbox translation (and consider whether seq is also
missing intentionally or a bug).

---

## 8. Frontend — Context Explorer UI (biggest cluster of edits)

### `frontend/packages/portal-frontend/src/contextExplorer/models/types.ts`

```
40-44:  export interface CellLineOverview { ...; prismOncRefLum: string; prismOncRefSeq: string; prismRepurposing: string; }
47-56:  export enum DataType { PRISMRepurposing, PRISMOncRefLum, PRISMOncRefSeq, RNASeq, WGS, WES, RNAi, CRISPR, default }
59-67:  export enum DataTypeStrings { PRISMRepurposing = "PRISMRepurposing", PRISMOncRefLum = "PRISMOncRefLum", PRISMOncRefSeq = "PRISMOncRefSeq", RNASeq=..., ... }
90-97:  switch (datatypeIndex) { case CRISPR/RNAi -> LossOfFunction; case WES/WGS/RNASeq -> OMICS; case PRISMOncRefLum/PRISMOncRefSeq/PRISMRepurposing -> CompoundViability; default -> Subtype }
162-167: export enum TabTypes { Overview, GeneDependency, DrugSensitivityOncRefSeq = "DrugSensitivityOncRefSeq", DrugSensitivityOncRefLum = "DrugSensitivityOncRefLum", DrugSensitivityRepurposing }
```

Change: add `prismOncRefHarmonized: string` to `CellLineOverview`; add
`PRISMOncRefHarmonized` to `DataType` enum (numeric ordinal shift is
acceptable per decision above) and `DataTypeStrings`; add case to the switch
statement; add `DrugSensitivityOncRefHarmonized = "DrugSensitivityOncRefHarmonized"`
to `TabTypes`.

### `frontend/packages/portal-frontend/src/contextExplorer/utils.ts`

```
44-49:  DATATYPE_TOOLTIP_TEXT map: [DataTypeStrings.PRISMOncRefLum.toString(), "Models that have been included in at least one PRISM OncRef Lum screen."], [DataTypeStrings.PRISMOncRefSeq.toString(), "Models that have been included in at least one PRISM OncRef Seq screen."]
764-765: export const ONCREF_LUM_SIDEBAR_TEXT = "Compound sensitivities enriched ... Luminex dataset. ..."
767-768: export const ONCREF_SEQ_SIDEBAR_TEXT = "Compound sensitivities enriched ... NGS dataset. ..."
779:     export const ONCREF_DETAIL_NO_COMPOUND_SELECTED = "..." (generic, no seq/lum split)
785:     export const ONCREF_TABLE_DESCRIPTION = "..." (generic, no seq/lum split)
801-802: isOncRefDataset check: datasetId === ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix || datasetId === ContextExplorerDatasets.PRISMOncologyReferenceSeqLog2AUCMatrix (approx location; also appears elsewhere as helper)
```

Change: add tooltip map entry for `PRISMOncRefHarmonized`; add
`ONCREF_HARMONIZED_SIDEBAR_TEXT` constant; add
`|| datasetId === ContextExplorerDatasets.PRISMOncologyReferenceHarmonizedLog2AUCMatrix`
to the `isOncRefDataset`-style check(s).

### `frontend/packages/portal-frontend/src/contextExplorer/components/ContextExplorerTabs.tsx`

```
90-91:   prismOncRefSeq: capitalizeFirstLetter(String(row.oncrefSeq)), prismOncRefLum: capitalizeFirstLetter(String(row.oncrefLum)),
101-102: tabTypeStr !== String(TabTypes.DrugSensitivityOncRefLum) || tabTypeStr !== String(TabTypes.DrugSensitivityOncRefSeq)  (tab filter logic — NOTE: uses OR which is always true, likely an existing bug, but relevant to review when adding harmonized)
136-144: <Tab id="oncrefSeq">OncRef Seq Sensitivity ... popoverId="oncref-seq-tab-help" ...
146-154: <Tab id="oncrefLum">OncRef Lum Sensitivity ... popoverId="oncref-lum-tab-help" ...
225:     ContextExplorerDatasets.PRISMOncologyReferenceSeqLog2AUCMatrix  (used in some conditional, e.g. tab->dataset mapping)
243:     ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix
```

Change: add `prismOncRefHarmonized: capitalizeFirstLetter(String(row.oncrefHarmonized))`;
add `TabTypes.DrugSensitivityOncRefHarmonized` to the tab-filter condition
(line 101-102 — also worth fixing the pre-existing `||` bug while touching
this); add a new `<Tab id="oncrefHarmonized">` block (mirroring lines
136-154) with its own tooltip/popoverId; add harmonized case near lines
225/243 dataset-to-tab mapping.

### `frontend/packages/portal-frontend/src/contextExplorer/components/EnrichmentTile.tsx`

```
74-81:  const getTabFromDatasetName = useCallback((datasetName) => {
           if (datasetName === ContextExplorerDatasets.Chronos_Combined.toString()) return "geneDependency";
           if (datasetName === ContextExplorerDatasets.Rep_all_single_pt_per_compound.toString()) return "repurposing";
           if (datasetName === ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix.toString()) return "oncrefLum";
           return "oncrefSeq";     // <-- fallback default assumes only 2 options!
         }, []);
113-115: dataset-check using PRISMOncologyReferenceLog2AUCMatrix / PRISMOncologyReferenceSeqLog2AUCMatrix
```

**Important bug risk**: line 81 `return "oncrefSeq";` is an implicit
fallback/default that assumes any non-Chronos/non-repurposing/non-lum dataset
must be "oncrefSeq". Once harmonized is added, this fallback would
incorrectly return `"oncrefSeq"` for harmonized datasets too. Change: add an
explicit
`if (datasetName === ContextExplorerDatasets.PRISMOncologyReferenceHarmonizedLog2AUCMatrix.toString()) return "oncrefHarmonized";`
before the fallback, and reconsider what the final fallback should be.

### `frontend/packages/portal-frontend/src/contextExplorer/components/LeftSearchPanel.tsx`

```
12-13:  import { ONCREF_LUM_SIDEBAR_TEXT, ONCREF_SEQ_SIDEBAR_TEXT } from "../utils"
372-380: {selectedTab === TabTypes.DrugSensitivityOncRefLum && (<>...<p>{ONCREF_LUM_SIDEBAR_TEXT}</p></>)}
383-391: {selectedTab === TabTypes.DrugSensitivityOncRefSeq && (<>...<p>{ONCREF_SEQ_SIDEBAR_TEXT}</p></>)}
```

Change: import `ONCREF_HARMONIZED_SIDEBAR_TEXT`; add a third
`{selectedTab === TabTypes.DrugSensitivityOncRefHarmonized && (...)}` block.

### `frontend/packages/portal-frontend/src/contextExplorer/components/OverviewTable.tsx`

```
182-187: columns.push({accessor: "prismOncRefSeq", Header: "OncRef Seq", maxWidth: 90, disableFilters: true});
188-192: columns.push({accessor: "prismOncRefLum", Header: "OncRef Lum", maxWidth: 90, disableFilters: true});
193-194: defaultColumns.push("prismOncRefSeq"); defaultColumns.push("prismOncRefLum");
```

Change: add a third
`columns.push({accessor: "prismOncRefHarmonized", Header: "OncRef Harmonized", ...})`
and `defaultColumns.push("prismOncRefHarmonized")`.

### `frontend/packages/portal-frontend/src/contextExplorer/components/contextAnalysis/ContextAnalysis.tsx`

```
46-48:   import { ONCREF_DETAIL_NO_COMPOUND_SELECTED, ONCREF_TABLE_DESCRIPTION } from "../../utils"  (generic strings, shared across seq/lum)
54:      import oncrefFilterDefinitions from "../../json/oncrefFilters.json"  (shared filter file, no per-variant version)
262-265: const isOncRefDataset = datasetId === ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix || datasetId === ContextExplorerDatasets.PRISMOncologyReferenceSeqLog2AUCMatrix;
268-277: getFilterDefinitions(): if (isOncRefDataset) return oncrefFilterDefinitions; ...
324,334: if (isOncRefDataset) { ... } (axis label logic for AUC vs log2(viability))
779-782, 793-796: conditional text blocks "OncRef Lum sensitivies enriched in ..." / "OncRef Seq sensitivies enriched in ..." keyed on datasetId === PRISMOncologyReferenceLog2AUCMatrix / ...SeqLog2AUCMatrix
847-852: {isOncRefDataset && (<div>Not enough data points ... PRISM OncRef models.</div>)}
1026-1034: {isOncRefDataset && (<div>{ONCREF_TABLE_DESCRIPTION}</div>)}
1139,1211-1212: more isOncRefDataset-gated rendering
```

Change: the central `isOncRefDataset` boolean (line 262-265) needs
`|| datasetId === ContextExplorerDatasets.PRISMOncologyReferenceHarmonizedLog2AUCMatrix`
— most of the generic `isOncRefDataset`-gated UI (filters, axis labels, table
description) will then automatically apply to harmonized too. However, the
**specific text blocks at lines 779-782 and 793-796** ("OncRef Lum
sensitivies enriched in..." / "OncRef Seq sensitivies enriched in...") are
keyed on the _exact_ dataset and will need a **third explicit block** for
harmonized (these are NOT covered by the generic `isOncRefDataset` flag).

### `frontend/packages/portal-frontend/src/contextExplorer/components/contextAnalysis/ContextAnalysisTable.tsx`

```
97-99, 112-114: isOncRefDataset-style checks: datasetId === PRISMOncologyReferenceLog2AUCMatrix || datasetId === PRISMOncologyReferenceSeqLog2AUCMatrix
101, 116: comment "Keep this as AUC regardless of what the units of OncRef/Prism_oncology_AUC are because..."
```

Change: add harmonized to both boolean checks (lines 97-99, 112-114).

### `frontend/packages/portal-frontend/src/contextExplorer/components/boxPlots/CollapsibleBoxPlots.tsx`

```
174-178: xAxisTitle = useMemo(() => { if (datasetId === PRISMOncologyReferenceLog2AUCMatrix || datasetId === PRISMOncologyReferenceSeqLog2AUCMatrix) return boxPlotData?.dataset_units || ""; ... })
```

Change: add
`|| datasetId === ContextExplorerDatasets.PRISMOncologyReferenceHarmonizedLog2AUCMatrix`
to the condition.

### `frontend/packages/portal-frontend/src/contextExplorer/json/oncrefFilters.json`

Generic filter definitions (checkbox, t_qval, abs_effect_size) — shared file
used for both seq and lum via the single `isOncRefDataset` gate in
`ContextAnalysis.tsx`. Likely no change needed for harmonized (it'll reuse
this same file automatically) unless harmonized needs different filter
defaults.

---

## 9. Frontend — Compound Dashboard

### `frontend/packages/portal-frontend/src/compoundDashboard/utils.ts`

```
1-14:  export const getDatasetLabelFromId = (datasetId) => {
          if (datasetId === "Rep_all_single_pt") return "Repurposing";
          if (datasetId === "Prism_oncology_AUC") return "OncRef Lum";
          if (datasetId === "Prism_oncology_seq_AUC") return "OncRef Seq";
          return "Unknown";
        }
16-...:  export const getDatasetIdFromLabel = (datasetLabel) => {
          if (datasetLabel === "Repurposing") return "Rep_all_single_pt";
          ...
22-27:    if (datasetLabel === "OncRef Seq") return "Prism_oncology_seq_AUC";
          if (datasetLabel === "OncRef Lum") return "Prism_oncology_AUC";
34-36:   (a list containing "Prism_oncology_AUC", "Prism_oncology_seq_AUC" — likely a valid-datasets array)
```

Change: add `if (datasetId === "Prism_oncology_harmonized_AUC") return "OncRef Harmonized";`
and the reverse mapping
`if (datasetLabel === "OncRef Harmonized") return "Prism_oncology_harmonized_AUC";`,
plus add to the list at lines 34-36.

### `frontend/packages/portal-frontend/src/compoundDashboard/models/types.ts`

```
3:  export type DatasetId = "Rep_all_single_pt" | "Prism_oncology_AUC" | "unknown";
```

Note: this union type doesn't even include `"Prism_oncology_seq_AUC"`
currently (pre-existing gap/likely dead code or intentionally narrow).
Change: add `"Prism_oncology_harmonized_AUC"` (and consider whether
`"Prism_oncology_seq_AUC"` should have been there already).

---

## 10. Frontend — Data Page

### `frontend/packages/@depmap/api/src/legacyPortalAPI/resources/data_page.ts`

```
47: case DataPageDataType.Drug_OncRef_Broad: ... (single switch case, no seq/lum split)
```

### `frontend/packages/portal-frontend/src/dataPage/models/types.ts`

```
51-52:  case DataPageDataType.Drug_OncRef_Broad: return "OncRef (Broad)";
107:    case DataPageDataType.Drug_OncRef_Broad: (used again, e.g. for color-category mapping)
```

### `frontend/packages/portal-frontend/src/dataPage/components/utils.ts`

```
3-8:   export const currentReleaseDatasets = [..., "Drug_OncRef_Broad"];
10-18: export const growingDatasets = [..., "Drug_OncRef_Broad"];
```

As with backend Data Page API, this is a single combined constant, not split
by seq/lum. Decision: stays combined — no change needed here.

---

## Skip at this time. Do not change these

```
frontend/packages/portal-frontend/src/compound/stories/RelatedCompoundsTile.stories.tsx:11:
    return <RelatedCompoundsTile datasetName={"OncRef Dataset"} />;   (story fixture, generic label, no change needed)

frontend/packages/portal-frontend/src/correlationAnalysis/stories/CorrelationAnalysis.stories.tsx:14:
    { label: "OncRef 25q2", value: "OncRef 25q2" },   (story fixture — dropdown option list; add a matching "OncRef Harmonized" entry only if this dropdown is meant to demo the new variant)

frontend/packages/portal-frontend/src/doseViabilityPrototype/hooks/useData.ts:48,72,75,91-92,56:
    type_name: "oncref_collapsed_metadata"; fetchMetadata<...>("oncref_collapsed_metadata"); oncrefMetadata.Dose/DoseUnit;
    "../breadbox/datasets/matrix/Prism_oncology_viability"  (prototype hook — currently only wired to lum viability; generic naming "oncref" doesn't distinguish variants explicitly here, but hardcodes the lum dataset name — would need a harmonized-specific fetch if this prototype needs to support it)
```

```
portal-backend/sample_data/compound/compounds.csv:15-16:
    DPC-007084,TNF,...,oncref,OncRef 24Q2,...
    DPC-007120,BELANTAMAB MAFODOTIN,...,oncref,OncRef 24Q2,...
    (a "oncref" category column value + "OncRef 24Q2" version label — generic, not seq/lum split)

portal-backend/sample_data/context_explorer/context_analysis_v2.csv:1 (header):
    subtype_code,out_group,feature_id,dataset,t_pval,t_qval,t_qval_log,mean_in,mean_out,effect_size,selectivity_val,n_dep_in,n_dep_out,frac_dep_in,frac_dep_out
    (rows 22-31,49-62 use "dataset" value "PRISMOncRef" — sample rows don't actually have a distinct "PRISMOncRefSeq" value in this particular sample file, only "PRISMOncRef" appears)

portal-backend/sample_data/context_explorer/sample_data_avail.csv:1 (header):
    ModelID,PRISMRepurposing,RNASeq,WGS,WES,RNAi,CRISPR,PRISMOncRefLum,PRISMOncRefSeq

portal-backend/sample_data/data_page/sample_all_data_avail.csv:1 (header):
    ModelID,...,Drug_OncRef_Broad,... (single combined column, matches Data Page's non-split design)

portal-backend/sample_data/subset_files/subsets.py:156:
    "sulfopin",  # prism oncRef   (comment only)
```

Change: add a `PRISMOncRefHarmonized` column to `sample_data_avail.csv` header
(and corresponding row values) to test the new Context Explorer summary
column end-to-end; consider adding sample harmonized rows to
`context_analysis_v2.csv` if tests exercise a 3rd dataset value.

### `portal-backend/tests/conftest.py`

```
459-...: DependencyDataset.DependencyEnum.Prism_oncology_AUC: {...}   (fixture dict — no seq entry)
527-532: compound_summary_oncref_csv = pd.read_csv("sample_data/compound_dashboard/compound_summary_oncref.csv"); ...DependencyEnum.Prism_oncology_AUC, compound_summary_oncref_csv
```

### `portal-backend/tests/factories.py`

```
662-663: DependencyDataset.DependencyEnum.Prism_oncology_AUC: "compound_experiment", DependencyDataset.DependencyEnum.Prism_oncology_dose_replicate: "compound_dose_replicate"
```

### `portal-backend/tests/depmap/compound/test_legacy_utils.py`

```
97:   dataset_name = DependencyDataset.DependencyEnum.Prism_oncology_AUC
120,135,160: oncref_dataset = DependencyDatasetFactory(matrix=matrix, name=dataset_name); typing.cast(DependencyDataset, oncref_dataset)
```

### `portal-backend/tests/depmap/compound/test_api.py`

```
25,38,58-59,83-84: uses Prism_oncology_dose_replicate / Prism_oncology_per_curve labels in fixtures
```

### `portal-backend/tests/depmap/compound/test_models.py`

```
45,50,55,62,71,82,87,99,102,106: repeated drc_dataset_label="Prism_oncology_per_curve" across many test cases
```

### `portal-backend/tests/depmap/compound/test_new_dose_curve_utils.py`

```
39,53,60-61: Prism_oncology_dose_replicate / Prism_oncology_per_curve fixtures
```

### `portal-backend/tests/depmap/compound/views/test_index.py`

```
32-40: expected_oncref_dataset_w_priority = DRCCompoundDatasetWithNamesAndPriority(drc_dataset_label="Prism_oncology_per_curve", viability_dataset_given_id="Prism_oncology_viability", replicate_dataset="Prism_oncology_dose_replicate", auc_dataset_given_id="Prism_oncology_AUC_collapsed", display_name="PRISM OncRef Lum", auc_dataset_priority=1, auc_dataset_display_name="PRISM OncRef", viability_dataset_display_name="PRISM OncRef", log_auc_dataset_given_id="PRISMOncologyReferenceLog2AUCMatrix")
63,95-98,108,139,159,173: repeated mocked "PRISM OncRef" return values and dataset name lists (includes seq's "PRISMOncologyReferenceLog2AUCMatrix" already; test coverage for seq variant of this specific test appears thin/absent)
```

### `portal-backend/tests/depmap/context_explorer/test_box_plot_utils.py`

```
6:    from depmap.context_explorer.models import ContextExplorerDatasets, is_oncref_dataset
287:  if is_oncref_dataset(dataset_given_id): ...
306-309,352-355,411,423,448-451,505-508,549-552,690-693: extensive @pytest.mark.parametrize lists pairing ("PRISMOncologyReferenceLog2AUCMatrix", "compound", "Lineage"/"MolecularSubtype") and ("PRISMOncologyReferenceSeqLog2AUCMatrix", ...) — repeated ~9 times across the file
```

### `portal-backend/tests/depmap/context_explorer/test_context_analysis.py`

```
10:   from depmap.context_explorer.models import ContextExplorerDatasets, is_oncref_dataset
468:  if is_oncref_dataset(dataset_given_id): ...
514-515,1071-1072,1146-1147: parametrized ["PRISMOncologyReferenceLog2AUCMatrix", "PRISMOncologyReferenceSeqLog2AUCMatrix"] lists
639: # TODO: Update to also test OncRef Seq!!!  (existing TODO — a sign seq test coverage is already known-incomplete; harmonized coverage will need similar attention)
641: dataset_given_id = "PRISMOncologyReferenceLog2AUCMatrix" (hardcoded single-dataset test)
```

### `portal-backend/tests/depmap/context_explorer/test_api.py`

```
37-38:    "oncrefLum", "oncrefSeq"   (list of expected keys)
127-128,231-232: "PRISMOncRefSeq", "PRISMOncRefLum"  (expected data_type_order lists, mirrors api.py line 92-93)
157-158,181-182,204-205,296-297,319-320,342-343,365-366,388-389,411-412: repeated "oncrefSeq": False, "oncrefLum": False dict entries (9 occurrences across parametrized/expected-output test cases)
```

Change: every one of these parametrized test lists/dicts across
`test_box_plot_utils.py`, `test_context_analysis.py`, and `test_api.py` needs
a third parallel entry for `"PRISMOncologyReferenceHarmonizedLog2AUCMatrix"` /
`"PRISMOncRefHarmonized"` / `"oncrefHarmonized"` respectively — this is
likely the largest single chunk of mechanical test-file edits.

### `breadbox/tests/api/test_datasets.py`

```
998,1001,1029,1043,1316,1333: "oncref_condition", "oncref_condition_metadata"   (generic dimension-type test fixtures, not seq/lum specific — no change needed)
```

### `portal-backend/depmap/cli_commands/db_load_commands.py`

```
936:   DependencyEnum.Prism_oncology_AUC,               (in some load list)
1071-1072: "sample_data/compound/prism_oncology_per_curve.csv", "Prism_oncology_per_curve"
1093:  BiomarkerEnum.oncref_confounders,
1270-1275: compound_summary_oncref_csv = pd.read_csv("sample_data/compound_dashboard/compound_summary_oncref.csv"); ... DependencyEnum.Prism_oncology_AUC, compound_summary_oncref_csv
```

Change: add corresponding harmonized entries wherever seq/lum-specific CLI
load steps are enumerated (verify around lines 930-940 and 1060-1100 for full
loader blocks — only lum appears loaded via sample data CLI currently, seq
may not be either, so check parity before assuming harmonized needs its own line).

### `pipeline/preprocessing-pipeline/process-drug-screens.conseq`

```
12-13:  ### The if blocks are here to convert the new oncref format to the old oncref format ...
14:     if {{ inputs.download.label == "Prism_oncology_AUC" or inputs.download.label == "Prism_oncology_IC50"}}:
15-17:     prism_oncref_df = tc.get(...); .transpose(); .to_csv("out.csv")
18:     elif {{ inputs.download.label == "Prism_oncology_per_curve" }}:
19-28:     prism_oncref_curves_df = tc.get(...).rename(columns={...}); .to_csv("out.csv")
```

Note: condition at line 14 only checks `Prism_oncology_AUC`/`Prism_oncology_IC50`
(not `Prism_oncology_seq_AUC` — a pre-existing gap for seq!), and line 18 only
checks `Prism_oncology_per_curve` (not `Prism_oncology_seq_per_curve`).
Change: if harmonized labels follow the
`Prism_oncology_harmonized_AUC`/`_per_curve` naming, this conditional will
need explicit new branches too (as seq apparently needed but didn't get,
unless seq is routed through a different `download.label`) — worth
double-checking with pipeline owner.

### `pipeline/preprocessing-pipeline/scripts/oncref_cpd_doses_from_treatment_metadata.py`

```
14-21:  Generic script parameterized by `--treatment_taiga_id` / `--output_filename` (CLI args), not hardcoded to seq/lum. Likely reusable for harmonized without code changes — just a new pipeline rule invocation with a different taiga ID (see `make_compound_summary_table.conseq` below).
```

### `pipeline/preprocessing-pipeline/make_compound_summary_table.conseq`

```
11-13:  rule get_oncref_compound_doses: inputs: treatment_metadata={'type' : 'raw-treatment_metadata', 'label' ~ 'Prism_oncology.*AUC'}, script=fileref("scripts/oncref_cpd_doses_from_treatment_metadata.py")
33:     inputs: predictions={'type': 'pred-models-csv', 'dataset': dataset}, #'[Prism_oncology_AUC, Rep_all_single_pt, RNAi_merged, Chronos_Combined] where only first 2 are compound-related'
```

The `label ~ 'Prism_oncology.*AUC'` regex at line 12 would auto-match a
`Prism_oncology_harmonized_AUC` label — likely no change needed here if the
harmonized taiga label follows this naming convention. Comment at line 33
should be updated for documentation accuracy.

### `pipeline/preprocessing-pipeline/predictability/predictability.conseq`

```
57:   elif "{{ inputs.data.label }}" in ["Rep1M", "Rep_all_single_pt", "Prism_oncology_AUC", "Prism_oncology_seq_AUC"]: models_to_use = [...]
247:  data={'type': 'confounders-matrix-raw', 'label' ~ 'oncref|repallsinglept'},
657:  "label" ~ "Rep_all_single_pt|(?:Prism_oncology.*_AUC)"   (regex — auto-matches new "Prism_oncology_harmonized_AUC" naming)
```

Change: line 57's explicit list needs `"Prism_oncology_harmonized_AUC"` added
(regex-based line 657 doesn't need editing since it already matches any
`Prism_oncology*_AUC`). Line 247's regex `'oncref|repallsinglept'` should
already match any label containing "oncref" — check whether the harmonized
confounders' label containing "oncref_harmonized" would match — likely yes
since it's a substring match.

### `pipeline/preprocessing-pipeline/predictability/test-artifacts.conseq`, `pipeline/preprocessing-pipeline/predictability/README.md`

```
test-artifacts.conseq:188:  "label": "Prism_oncology_AUC",
README.md:27:                Prism_oncology_AUC  {'$filename': 'state/r66/ensemble.csv'}
```

Test fixture / doc reference to lum only; add harmonized example/fixture if
test coverage should include it.

### `pipeline/analysis-pipeline/predictability/` (daintree.conseq, model-config.yaml, predictability_inputs_internal.template, generate_daintree_input_configs.py)

```
daintree.conseq:26:  oncref={"type": "target_matrix", "label": "oncref"},
daintree.conseq:32:  oncref_confounder={"type": "feature", "label": "oncref_confounder"},
model-config.yaml:4: - confounder # Will map to crispr_confounder or rnai_confounder or oncref_confounder based on screen
predictability_inputs_internal.template:49-53:
    add-if-missing {"type": "target_matrix", "label": "oncref", "source_dataset_id": PREPROCESS_TAIGA_ID(virtual_permaname, "PRISMOncologyReferenceLumLog2AUCMatrix")}
predictability_inputs_internal.template:77-80:
    add-if-missing {"type": "feature", "label": "oncref_confounder", "category": "confounder", "source_dataset_id": PREPROCESS_TAIGA_ID(virtual_permaname, "PRISMOncologyReferenceLumConfounderMatrix")}
generate_daintree_input_configs.py:9-10: # screens = ["crispr", "rnai", "oncref"]  \n  screens = ["crispr", "rnai"]  (oncref/seq not yet wired into this newer pipeline at all — commented out)
```

Note: this "daintree" pipeline currently only has a single "oncref" (lum)
target — there is **no** "oncref_seq" here at all yet (bigger pre-existing
gap, oncref_seq isn't even wired into daintree/model-config). If harmonized
needs predictability support via daintree, this is where a new
`oncref_harmonized` (and possibly `oncref_seq`, which is currently missing)
target/feature/label set would need to be added across all 4 files.

---

## Summary of files most likely to break / most central to touch first

1. `portal-backend/depmap/context_explorer/models.py` — `ContextExplorerDatasets`
   enum + `is_oncref_dataset` (source of truth on backend)
2. `frontend/packages/@depmap/types/src/context-explorer.ts` — mirrored
   `ContextExplorerDatasets` enum (source of truth on frontend)
3. `portal-backend/depmap/compound/models.py` — `drc_compound_datasets` list
4. `portal-backend/depmap/enums.py` + `portal-backend/depmap/settings/shared.py`
   — `DependencyEnum`/`BiomarkerEnum` + display metadata
5. `frontend/.../contextExplorer/models/types.ts`, `.../ContextExplorerTabs.tsx`,
   `.../EnrichmentTile.tsx` (has an unguarded fallback that will silently
   mis-tag a harmonized dataset as "oncrefSeq" — line 81), `.../LeftSearchPanel.tsx`,
   `.../OverviewTable.tsx`, `.../ContextAnalysis.tsx` (has two literal
   seq/lum text blocks not covered by the generic flag),
   `.../ContextAnalysisTable.tsx`, `.../boxPlots/CollapsibleBoxPlots.tsx`
6. Pipeline conseq/py pairs: `get_context_analysis.py`+`.conseq`,
   `get_data_availability.py`+`.conseq` (context_explorer),
   `process_drug_screen_auc_matrix.py`, `create_cor_analysis_pairs.py`
7. All parametrized test lists in `test_box_plot_utils.py`,
   `test_context_analysis.py`, `test_api.py` (context_explorer tests)

## Decisions

1. **Data Page `Drug_OncRef_Broad`**: stays a single combined column. No
   per-variant split needed in `data_page/api.py`,
   `@depmap/types/src/data_page.ts`, `legacyPortalAPI/resources/data_page.ts`,
   `dataPage/models/types.ts`, or `dataPage/components/utils.ts`.
2. **Numeric `DataType` enum** (`legacyPortalAPI/resources/context_explorer.ts`
   and its mirror in `contextExplorer/models/types.ts`): leave as a numeric
   enum. Ordinal-shift from appending/inserting `PRISMOncRefHarmonized` is
   fine — no conversion to string enum needed.
3. **Color**: harmonized shares `prism_oncology_color` with seq and lum. No
   new color constant needed in `_color_palette.py`, `variables.scss`, or
   `color_palette.json`.
