from dataclasses import dataclass
import dataclasses
from depmap.context_explorer.api import _get_analysis_data_table
import pytest
from typing import List, Literal, Optional
from depmap.context_explorer.dose_curve_utils import get_context_dose_curves
from depmap.context_explorer.utils import (
    get_full_row_of_values_and_depmap_ids,
    _get_compound_experiment_id_from_entity_label,
)
from depmap.context_explorer.box_plot_utils import get_organized_contexts
from depmap.dataset.models import DependencyDataset
import numpy as np
from tests.factories import (
    CompoundExperimentFactory,
    ContextAnalysisFactory,
    SubtypeContextFactory,
    DependencyDatasetFactory,
    DepmapModelFactory,
    GeneFactory,
    MatrixFactory,
    DoseResponseCurveFactory,
    CompoundDoseReplicateFactory,
    SubtypeNodeFactory,
)
from tests.utilities import interactive_test_utils
import pandas as pd


# Filter ranges to be used as params for get_other_context_dependencies.
@dataclass
class FilterValues:
    max_fdr: float
    min_abs_effect_size: float
    min_frac_dep_in: float


# Will only capture ContextAnalysis objects made with narrow_filters.
only_narrow_range = FilterValues(
    max_fdr=0.2, min_abs_effect_size=0.1, min_frac_dep_in=0
)

# Will capture narrow_filters and wide_filters.
all_range = FilterValues(max_fdr=10, min_abs_effect_size=0.02, min_frac_dep_in=0)

# Will filter out all ContextAnalysis objects so that nothing is returned.
nothing_range = FilterValues(
    max_fdr=0.002, min_abs_effect_size=0.02, min_frac_dep_in=0.0001
)

# Filter values of ContextAnalysis objects.
@dataclass
class OtherContextFilterVals:
    t_qval: float
    effect_size: float
    frac_dep_in: float


# If you want a ContextAnalysis to be returned in other context dependency results,
# use these narrow_filters with the only_narrow_rang or all_range.
narrow_filters = OtherContextFilterVals(
    t_qval=0.01, effect_size=0.06, frac_dep_in=0.02,
)


# If you want a ContextAnalysis to be filtered out in other context dependency results,
# use these wide_filters with the only_narrow_range.
wide_filters = OtherContextFilterVals(t_qval=8.5, effect_size=0, frac_dep_in=0)


def _setup_dose_response_curves(models: List[DepmapModelFactory], compound_exps: list):
    dose_rep_entities = []
    for cpd_exp in compound_exps:
        dose_1 = CompoundDoseReplicateFactory(
            compound_experiment=cpd_exp, dose=0.1, replicate=10
        )
        dose_rep_entities.append(dose_1)
        dose_2 = CompoundDoseReplicateFactory(
            compound_experiment=cpd_exp,
            dose=0.2,
            replicate=20,
            is_masked=True,  # TODO: what does is_masked mean and does Context Explorer need to care?????
        )
        dose_rep_entities.append(dose_2)
        dose_3 = CompoundDoseReplicateFactory(
            compound_experiment=cpd_exp, dose=0.3, replicate=30
        )
        dose_rep_entities.append(dose_3)

    viability_df = pd.DataFrame(
        {model.cell_line_name: [10, 20, 30, 10, 20, 30] for model in models},
        index=["dose_1", "dose_2", "dose_3", "dose_4", "dose_5", "dose_6"],
    )

    dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Prism_oncology_dose_replicate,
        matrix=MatrixFactory(
            entities=dose_rep_entities,
            cell_lines=models,
            data=viability_df,
            using_depmap_model_table=True,
        ),
    )

    for compound_exp in compound_exps:
        curves = [
            DoseResponseCurveFactory(
                compound_exp=compound_exp, cell_line=model.cell_line
            )
            for model in models
        ]


def _setup_factories(
    empty_db_mock_downloads,
    dataset_name: str,
    gene_a: Optional[GeneFactory] = None,
    gene_b: Optional[GeneFactory] = None,
    compound_a: Optional[CompoundExperimentFactory] = None,
    compound_b: Optional[CompoundExperimentFactory] = None,
    entity_type: Literal["gene", "compound"] = "gene",
):
    assert gene_a and gene_b if entity_type == "gene" else compound_a and compound_b

    use_genes = entity_type == "gene"

    bone_es_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}es",
            stripped_cell_line_name=f"{num}es",
            depmap_model_type="ES",
        )
        for num in range(5)
    ]
    bone_insig_child_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}insig",
            stripped_cell_line_name=f"{num}insig",
            depmap_model_type="INSIG_BONE_CHILD",
        )
        for num in range(5)
    ]
    bone_os_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}os",
            stripped_cell_line_name=f"{num}os",
            depmap_model_type="OS",
        )
        for num in range(5)
    ]

    bone_subtype_nodes = SubtypeNodeFactory(
        node_name="BONE_NODE",
        subtype_code="BONE",
        node_level=0,
        level_0="BONE",
        level_1=None,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    bone_ES_nodes = SubtypeNodeFactory(
        node_name="ES_NODE",
        subtype_code="ES",
        node_level=1,
        level_0="BONE",
        level_1="ES",
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    bone_OS_nodes = SubtypeNodeFactory(
        node_name="OS_NODE",
        subtype_code="OS",
        node_level=1,
        level_0="BONE",
        level_1="OS",
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    bone_context = SubtypeContextFactory(
        subtype_code="BONE",
        depmap_model=bone_es_cell_lines
        + bone_os_cell_lines
        + bone_insig_child_cell_lines,
    )
    bone_ES_context = SubtypeContextFactory(
        subtype_code="ES", depmap_model=bone_es_cell_lines
    )
    insig_bone_child_context = SubtypeContextFactory(
        subtype_code="INSIG_BONE_CHILD", depmap_model=bone_insig_child_cell_lines
    )
    bone_OS_context = SubtypeContextFactory(
        subtype_code="OS", depmap_model=bone_os_cell_lines
    )

    lung_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}lung",
            stripped_cell_line_name=f"lung_line_{num}",
            depmap_model_type="LUNG",
        )
        for num in range(5)
    ]

    lung_subtype_nodes = SubtypeNodeFactory(
        node_name="LUNG_NODE",
        subtype_code="LUNG",
        node_level=0,
        level_0="LUNG",
        level_1=None,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    lung_context = SubtypeContextFactory(
        subtype_code="LUNG", depmap_model=lung_cell_lines
    )

    # So we have some Heme cell lines
    aml_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}AML",
            stripped_cell_line_name=f"AML_{num}",
            depmap_model_type="AML",
        )
        for num in range(5)
    ]

    child_of_myeloid_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}_child_myeloid",
            stripped_cell_line_name=f"child_myeloid_{num}",
            depmap_model_type="CHILD_OF_MYELOID",
        )
        for num in range(5)
    ]

    myeloid_cell_lines = aml_cell_lines + child_of_myeloid_cell_lines

    myeloid_node = SubtypeNodeFactory(
        node_name="MYELOID_NODE",
        subtype_code="MYELOID",
        node_level=0,
        level_0="MYELOID",
        level_1=None,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    aml_node = SubtypeNodeFactory(
        node_name="AML_NODE",
        subtype_code="AML",
        node_level=1,
        level_0="MYELOID",
        level_1="AML",
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    CHILD_OF_MYELOID_node = SubtypeNodeFactory(
        node_name="CHILD_OF_MYELOID_node",
        subtype_code="CHILD_OF_MYELOID",
        node_level=1,
        level_0="MYELOID",
        level_1="CHILD_OF_MYELOID",
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    myeloid_context = SubtypeContextFactory(
        subtype_code="MYELOID", depmap_model=myeloid_cell_lines
    )
    aml_context = SubtypeContextFactory(subtype_code="AML", depmap_model=aml_cell_lines)
    CHILD_OF_MYELOID_context = SubtypeContextFactory(
        subtype_code="CHILD_OF_MYELOID", depmap_model=child_of_myeloid_cell_lines
    )
    # Added so we get 1 result for the Others - heme boxplot
    lymph_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-1LYMPH",
            stripped_cell_line_name="LYMPH_1",
            depmap_model_type="LYMPH",
        )
    ]
    lymph_node = SubtypeNodeFactory(
        node_name="LYMPH_NODE",
        subtype_code="LYMPH",
        node_level=0,
        level_0="LYMPH",
        level_1=None,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    lymph_context = SubtypeContextFactory(
        subtype_code="LYMPH", depmap_model=lymph_cell_lines
    )

    matrix_cell_lines = (
        bone_es_cell_lines
        + lung_cell_lines
        + bone_os_cell_lines
        + myeloid_cell_lines
        + lymph_cell_lines
        + bone_insig_child_cell_lines
    )

    matrix = MatrixFactory(
        entities=[
            gene_a if use_genes else compound_a,
            gene_b if use_genes else compound_b,
        ],
        data=np.array([[num for num in range(31)], [num for num in range(31)]]),
        cell_lines=matrix_cell_lines,
        using_depmap_model_table=True,
    )

    dataset = DependencyDatasetFactory(
        display_name="test display name",
        name=DependencyDataset.DependencyEnum(dataset_name),
        matrix=matrix,
        priority=1,
    )

    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=bone_ES_context,
        subtype_code="ES",
        out_group="All Others",
        entity=gene_a if use_genes else compound_a,
        t_pval=1.0,
        mean_in=6,
        mean_out=0.5,
        effect_size=-0.05,  # Make sure this results in an abs_effect_size of 0.05
        t_qval=0.01,
        frac_dep_in=0.2 if use_genes else None,
    )

    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=myeloid_context,
        subtype_code="MYELOID",
        out_group="Other Heme",
        entity=gene_a if use_genes else compound_a,
        t_pval=1,
        mean_in=2,
        mean_out=3,
        effect_size=4,
    )

    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=lung_context,
        subtype_code="LUNG",
        out_group="All Others",
        entity=gene_a if use_genes else compound_a,
        t_pval=1.0,
        mean_in=6,
        mean_out=0.5,
        effect_size=-0.05,  # Make sure this results in an abs_effect_size of 0.05
        t_qval=0.01,
        frac_dep_in=0.2 if use_genes else None,
    )

    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=bone_OS_context,
        subtype_code="OS",
        out_group="All Others",
        entity=gene_a if use_genes else compound_a,
        t_pval=1.0,
        mean_in=6,
        mean_out=0.5,
        effect_size=-0.05,  # Make sure this results in an abs_effect_size of 0.05
        t_qval=0.02,
        frac_dep_in=0 if use_genes else None,
    )
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=bone_ES_context,
        subtype_code="ES",
        out_group="BONE",  # outgroup encoded as BONE. Technically, "Other BONE"
        entity=gene_a if use_genes else compound_a,
        t_pval=3.0,
        mean_in=0.1,
        mean_out=8,
        t_qval=narrow_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in if use_genes else None,
    )
    # Added this because there was a bug with the Context Explorer box plots that prevented
    # the Other <Lineage> plot from showing up if the level_0 itself was significant, but 1
    #  or more of its children were not.
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=insig_bone_child_context,
        subtype_code="INSIG_BONE_CHILD",
        out_group="All Others",
        entity=gene_a if use_genes else compound_a,
        t_pval=3.0,
        mean_in=0.1,
        mean_out=8,
        t_qval=0,
        effect_size=1000,
        frac_dep_in=1000 if use_genes else None,
    )
    # never want this to be signficant
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=myeloid_context,
        subtype_code="MYELOID",
        out_group="All Others",
        entity=gene_a if use_genes else compound_a,
        t_qval=0,
        effect_size=1000,
        frac_dep_in=1000 if use_genes else None,
    )
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=aml_context,
        subtype_code="AML",
        out_group="All Others",
        entity=gene_a if use_genes else compound_a,
        t_qval=0.01,
        effect_size=0,
        frac_dep_in=0 if use_genes else None,
    )

    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=CHILD_OF_MYELOID_context,
        subtype_code="CHILD_OF_MYELOID",
        out_group="All Others",
        entity=gene_a if use_genes else compound_a,
        t_qval=wide_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in if use_genes else None,
    )

    # Added so we get 1 result for the Others - heme boxplot
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=lymph_context,
        subtype_code="LYMPH",
        out_group="All Others",
        entity=gene_a if use_genes else compound_a,
        t_qval=90,
        effect_size=90,
        frac_dep_in=90 if use_genes else None,
    )

    if dataset_name == DependencyDataset.DependencyEnum.Prism_oncology_AUC.name:
        _setup_dose_response_curves(
            models=matrix_cell_lines, compound_exps=[compound_a, compound_b]
        )

    empty_db_mock_downloads.session.flush()


def _setup_entities_and_dataset_id(empty_db_mock_downloads, entity_type, dataset_name):
    gene_a = GeneFactory(label="gene_0 (0)", entrez_id=0)
    gene_b = GeneFactory(label="gene_1 (1)", entrez_id=1)

    xref_type = "BRD"
    xref = "PRC-003465060-210-01"
    xref_full = xref_type + ":" + xref
    compound_a = CompoundExperimentFactory(
        xref_type=xref_type, xref=xref, label=xref_full
    )
    xref_b = "PRC-003538266-583-86"
    xref_full_b = xref_type + ":" + xref_b
    compound_b = CompoundExperimentFactory(
        xref_type=xref_type, xref=xref_b, label=xref_full_b
    )

    _setup_factories(
        empty_db_mock_downloads=empty_db_mock_downloads,
        gene_a=gene_a,
        gene_b=gene_b,
        compound_a=compound_a,
        compound_b=compound_b,
        entity_type=entity_type,
        dataset_name=dataset_name,
    )

    return gene_a, gene_b, compound_a, compound_b


@pytest.mark.parametrize(
    "dataset_name", ["Chronos_Combined", "Rep_all_single_pt", "Prism_oncology_AUC"],
)
def test_get_anaysis_data(empty_db_mock_downloads, dataset_name):
    use_genes = dataset_name == DependencyDataset.DependencyEnum.Chronos_Combined.name

    entity_type = "gene" if use_genes else "compound"

    (gene_a, gene_b, compound_a, compound_b) = _setup_entities_and_dataset_id(
        empty_db_mock_downloads, entity_type, dataset_name
    )

    ew_vs_all = _get_analysis_data_table(
        in_group="ES",
        out_group_type="All Others",
        entity_type=entity_type,
        dataset_name=dataset_name,
    )

    # Make sure the expected columns are present.
    if entity_type == "gene":
        assert list(ew_vs_all.keys()) == [
            "entity",
            "t_pval",
            "mean_in",
            "mean_out",
            "effect_size",
            "abs_effect_size",
            "t_qval",
            "t_qval_log",
            "n_dep_in",
            "n_dep_out",
            "frac_dep_in",
            "frac_dep_out",
            "selectivity_val",
            "depletion",
            "label",
        ]
    else:
        assert list(ew_vs_all.keys()) == [
            "entity",
            "t_pval",
            "mean_in",
            "mean_out",
            "effect_size",
            "abs_effect_size",
            "t_qval",
            "t_qval_log",
            # "OR",
            # "n_dep_in",
            # "n_dep_out",
            # "frac_dep_in",
            # "frac_dep_out",
            "selectivity_val",
            # "log_OR",
            "depletion",
            "label",
        ]

    assert ew_vs_all["entity"] == [
        f"{gene_a.label} ({gene_a.entrez_id})" if use_genes else compound_a.label
    ]
    assert ew_vs_all["t_pval"] == [1.0]
    assert ew_vs_all["mean_in"] == [6.0]
    assert ew_vs_all["mean_out"] == [0.5]
    assert ew_vs_all["effect_size"] == [-0.05]
    assert ew_vs_all["abs_effect_size"] == [0.05]
    assert ew_vs_all["depletion"] == ["False"]

    ew_vs_lineage = _get_analysis_data_table(
        in_group="ES",
        out_group_type="BONE",
        entity_type=entity_type,
        dataset_name=dataset_name,
    )

    assert ew_vs_lineage["entity"] == [
        f"{gene_a.label} ({gene_a.entrez_id})" if use_genes else compound_a.label
    ]
    assert ew_vs_lineage["t_pval"] == [3.0]
    assert ew_vs_lineage["mean_in"] == [0.1]
    assert ew_vs_lineage["mean_out"] == [8.0]
    assert ew_vs_lineage["effect_size"] == [0.06]
    assert ew_vs_lineage["abs_effect_size"] == [0.06]
    assert ew_vs_lineage["depletion"] == ["True"]

    myeloid_vs_other_heme = _get_analysis_data_table(
        in_group="MYELOID",
        out_group_type="Other Heme",
        entity_type=entity_type,
        dataset_name=dataset_name,
    )

    assert myeloid_vs_other_heme["entity"] == [
        f"{gene_a.label} ({gene_a.entrez_id})" if use_genes else compound_a.label
    ]
    assert myeloid_vs_other_heme["t_pval"] == [1]
    assert myeloid_vs_other_heme["mean_in"] == [2]
    assert myeloid_vs_other_heme["mean_out"] == [3]
    assert myeloid_vs_other_heme["effect_size"] == [4]
    assert myeloid_vs_other_heme["abs_effect_size"] == [4]
    assert myeloid_vs_other_heme["depletion"] == ["True"]

    empty_data = _get_analysis_data_table(
        in_group="Skin",
        out_group_type="All Others",
        entity_type=entity_type,
        dataset_name=dataset_name,
    )

    assert empty_data == None

    all_in_group = _get_analysis_data_table(
        in_group="All",
        out_group_type="All Others",
        entity_type=entity_type,
        dataset_name=dataset_name,
    )

    assert all_in_group == None


def test_get_dose_curves(empty_db_mock_downloads):
    dataset_name = "Prism_oncology_AUC"
    entity_type = "compound"

    (_, _, compound_a, compound_b,) = _setup_entities_and_dataset_id(
        empty_db_mock_downloads, entity_type, dataset_name
    )

    interactive_test_utils.reload_interactive_config()

    selected_entity_label = compound_a.label

    dose_curve_info = get_context_dose_curves(
        dataset_name=dataset_name,
        entity_full_label=selected_entity_label,
        subtype_code="ES",
        level=1,
        out_group_type="All Others",
    )

    assert list(dose_curve_info.keys()) == [
        "dataset",
        "compound_experiment",
        "replicate_dataset_name",
        "dose_curve_info",
    ]
    assert dose_curve_info["dataset"].name.value == dataset_name
    assert dose_curve_info["compound_experiment"].type == "compound_experiment"
    assert dose_curve_info["compound_experiment"].xref == "PRC-003465060-210-01"
    assert dose_curve_info["compound_experiment"].xref_type == "BRD"
    assert dose_curve_info["compound_experiment"].label == "BRD:PRC-003465060-210-01"

    # If this breaks, double check that nothing changed with the id or displayName. In the past
    # this assertion broke because both "id" and "displanName" were being filled with the model_id.
    assert dose_curve_info["dose_curve_info"] == {
        "in_group_curve_params": [
            {
                "id": "ACH-0es",
                "displayName": "0es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1es",
                "displayName": "1es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-2es",
                "displayName": "2es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-3es",
                "displayName": "3es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-4es",
                "displayName": "4es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
        ],
        "out_group_curve_params": [
            {
                "id": "ACH-0lung",
                "displayName": "lung_line_0",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1lung",
                "displayName": "lung_line_1",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-2lung",
                "displayName": "lung_line_2",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-3lung",
                "displayName": "lung_line_3",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-4lung",
                "displayName": "lung_line_4",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-0os",
                "displayName": "0os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1os",
                "displayName": "1os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-2os",
                "displayName": "2os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-3os",
                "displayName": "3os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-4os",
                "displayName": "4os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-0AML",
                "displayName": "AML_0",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1AML",
                "displayName": "AML_1",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-2AML",
                "displayName": "AML_2",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-3AML",
                "displayName": "AML_3",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-4AML",
                "displayName": "AML_4",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-0_child_myeloid",
                "displayName": "child_myeloid_0",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1_child_myeloid",
                "displayName": "child_myeloid_1",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-2_child_myeloid",
                "displayName": "child_myeloid_2",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-3_child_myeloid",
                "displayName": "child_myeloid_3",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-4_child_myeloid",
                "displayName": "child_myeloid_4",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1LYMPH",
                "displayName": "LYMPH_1",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-0insig",
                "displayName": "0insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1insig",
                "displayName": "1insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-2insig",
                "displayName": "2insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-3insig",
                "displayName": "3insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-4insig",
                "displayName": "4insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
        ],
        "max_dose": 0.3,
        "min_dose": 0.1,
    }
    # Test other bone outgroup
    dose_curve_info = get_context_dose_curves(
        dataset_name=dataset_name,
        entity_full_label=selected_entity_label,
        subtype_code="ES",
        level=1,
        out_group_type="BONE",
    )
    assert dose_curve_info["dose_curve_info"] == {
        "in_group_curve_params": [
            {
                "id": "ACH-0es",
                "displayName": "0es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1es",
                "displayName": "1es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-2es",
                "displayName": "2es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-3es",
                "displayName": "3es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-4es",
                "displayName": "4es",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
        ],
        "out_group_curve_params": [
            {
                "id": "ACH-0os",
                "displayName": "0os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1os",
                "displayName": "1os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-2os",
                "displayName": "2os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-3os",
                "displayName": "3os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-4os",
                "displayName": "4os",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-0insig",
                "displayName": "0insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-1insig",
                "displayName": "1insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-2insig",
                "displayName": "2insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-3insig",
                "displayName": "3insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
            {
                "id": "ACH-4insig",
                "displayName": "4insig",
                "ec50": 0,
                "slope": 0,
                "lowerAsymptote": 0,
                "upperAsymptote": 0,
            },
        ],
        "max_dose": 0.3,
        "min_dose": 0.1,
    }


@pytest.mark.parametrize(
    "dataset_name", ["Chronos_Combined", "Rep_all_single_pt", "Prism_oncology_AUC"],
)
def test_get_drug_dotted_line(empty_db_mock_downloads, dataset_name):
    use_genes = dataset_name == DependencyDataset.DependencyEnum.Chronos_Combined.name

    entity_type = "gene" if use_genes else "compound"

    (gene_a, gene_b, compound_a, compound_b,) = _setup_entities_and_dataset_id(
        empty_db_mock_downloads, entity_type, dataset_name
    )

    interactive_test_utils.reload_interactive_config()

    selected_entity_label = gene_a.label if use_genes else compound_a.label

    (entity_full_row_of_values) = get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=selected_entity_label
    )
    entity_full_row_of_values.dropna(inplace=True)

    drug_dotted_line = (
        entity_full_row_of_values.mean() if entity_type == "compound" else None
    )

    assert drug_dotted_line == None if use_genes else 7.0


def _get_box_plot_data(
    selected_subtype_code: str,
    dataset_name: str,
    selected_entity_label: str,
    tree_type: str,
    entity_type: str,
    max_fdr,
    min_abs_effect_size,
    min_frac_dep_in,
) -> Optional[dict]:

    context_box_plot_data = get_organized_contexts(
        selected_subtype_code=selected_subtype_code,
        tree_type=tree_type,
        entity_type=entity_type,
        entity_full_label=selected_entity_label,
        dataset_name=dataset_name,
        max_fdr=max_fdr,
        min_abs_effect_size=min_abs_effect_size,
        min_frac_dep_in=min_frac_dep_in,
    )

    if context_box_plot_data is None:
        return None

    return dataclasses.asdict(context_box_plot_data)


@pytest.mark.parametrize(
    "dataset_name", ["Chronos_Combined", "Rep_all_single_pt", "Prism_oncology_AUC"],
)
def test_get_box_plot_data(empty_db_mock_downloads, dataset_name):
    use_genes = dataset_name == DependencyDataset.DependencyEnum.Chronos_Combined.name

    entity_type = "gene" if use_genes else "compound"

    (gene_a, gene_b, compound_a, compound_b) = _setup_entities_and_dataset_id(
        empty_db_mock_downloads, entity_type, dataset_name
    )

    interactive_test_utils.reload_interactive_config()

    selected_entity_label = gene_a.label if use_genes else compound_a.label

    ### Test - the User is on the Lineage tab and selects "BONE". Then, the
    ### user selects a specific gene/compound from either the scatter plots or
    ### the data table.
    selected_subtype_code = "BONE"
    tree_type = "Lineage"

    data = _get_box_plot_data(
        dataset_name=dataset_name,
        selected_entity_label=selected_entity_label,
        selected_subtype_code=selected_subtype_code,
        tree_type=tree_type,
        entity_type=entity_type,
        max_fdr=all_range.max_fdr,
        min_abs_effect_size=all_range.min_abs_effect_size,
        min_frac_dep_in=all_range.min_frac_dep_in,
    )

    assert data["significant_selection"] == [
        {
            "label": "ES",
            "path": ["ES"],
            "data": [0, 1, 2, 3, 4],
            "cell_line_display_names": ["0es", "1es", "2es", "3es", "4es"],
        },
        {
            "label": "BONE",
            "path": ["BONE"],
            "data": [0, 1, 2, 3, 4, 10, 11, 12, 13, 14],
            "cell_line_display_names": [
                "0es",
                "1es",
                "2es",
                "3es",
                "4es",
                "0os",
                "1os",
                "2os",
                "3os",
                "4os",
            ],
        },
        {
            "label": "OS",
            "path": ["OS"],
            "data": [10, 11, 12, 13, 14],
            "cell_line_display_names": ["0os", "1os", "2os", "3os", "4os"],
        },
    ]

    # Bone, OS, and ES factories were all created to be signficant. Bone has another
    # child INSIG_BONE_CHILD. This was created to be insignificant to make sure we get
    # the data for the Other <Lineage> box plot.
    assert data["insignificant_selection"] == {
        "label": "Other BONE",
        "path": ["BONE"],
        "data": [26, 27, 28, 29, 30],
        "cell_line_display_names": ["0insig", "1insig", "2insig", "3insig", "4insig"],
    }

    # Test the funky case where a level_0 subtype is NOT signficant, but some of its
    # children are. We still want a card to show up in the UI, so we need to return
    # this data.
    assert list(data["other_cards"][0].keys()) == [
        "significant",
        "insignificant",
        "level_0_code",
    ]
    assert data["other_cards"][0]["level_0_code"] == "MYELOID"
    assert {
        "label": "CHILD_OF_MYELOID",
        "path": ["CHILD_OF_MYELOID"],
        "data": [20, 21, 22, 23, 24],
        "cell_line_display_names": [
            "child_myeloid_0",
            "child_myeloid_1",
            "child_myeloid_2",
            "child_myeloid_3",
            "child_myeloid_4",
        ],
    } in data["other_cards"][0]["significant"]

    assert {
        "label": "MYELOID",
        "path": ["MYELOID"],
        "data": [15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        "cell_line_display_names": [
            "AML_0",
            "AML_1",
            "AML_2",
            "AML_3",
            "AML_4",
            "child_myeloid_0",
            "child_myeloid_1",
            "child_myeloid_2",
            "child_myeloid_3",
            "child_myeloid_4",
        ],
    } in data["other_cards"][0]["significant"]

    assert data["other_cards"][0]["insignificant"] == {
        "label": "Other MYELOID",
        "path": ["MYELOID"],
        "data": [15, 16, 17, 18, 19],
        "cell_line_display_names": ["AML_0", "AML_1", "AML_2", "AML_3", "AML_4"],
    }
    assert data["insignificant_heme_data"] == {
        "label": "Other Heme",
        "data": [25],
        "cell_line_display_names": ["LYMPH_1"],
        "path": None,
    }
    assert data["insignificant_solid_data"] == {
        "label": "Other Solid",
        "data": [0, 1, 2, 3, 4, 10, 11, 12, 13, 14, 26, 27, 28, 29, 30],
        "cell_line_display_names": [
            "0es",
            "1es",
            "2es",
            "3es",
            "4es",
            "0os",
            "1os",
            "2os",
            "3os",
            "4os",
            "0insig",
            "1insig",
            "2insig",
            "3insig",
            "4insig",
        ],
        "path": None,
    }

    # 2. Test selected context is a primary disease.
    selected_subtype_code = "ES"
    data = _get_box_plot_data(
        dataset_name=dataset_name,
        selected_entity_label=selected_entity_label,
        selected_subtype_code=selected_subtype_code,
        tree_type=tree_type,
        entity_type=entity_type,
        max_fdr=all_range.max_fdr,
        min_abs_effect_size=all_range.min_abs_effect_size,
        min_frac_dep_in=all_range.min_frac_dep_in,
    )

    assert data["significant_selection"] == [
        {
            "label": "ES",
            "path": ["ES"],
            "data": [0, 1, 2, 3, 4],
            "cell_line_display_names": ["0es", "1es", "2es", "3es", "4es"],
        },
        {
            "label": "BONE",
            "path": ["BONE"],
            "data": [0, 1, 2, 3, 4, 10, 11, 12, 13, 14],
            "cell_line_display_names": [
                "0es",
                "1es",
                "2es",
                "3es",
                "4es",
                "0os",
                "1os",
                "2os",
                "3os",
                "4os",
            ],
        },
        {
            "label": "OS",
            "path": ["OS"],
            "data": [10, 11, 12, 13, 14],
            "cell_line_display_names": ["0os", "1os", "2os", "3os", "4os"],
        },
    ]

    assert data["insignificant_selection"] == {
        "label": "Other BONE",
        "path": ["BONE"],
        "data": [26, 27, 28, 29, 30],
        "cell_line_display_names": ["0insig", "1insig", "2insig", "3insig", "4insig"],
    }

    assert {
        "label": "CHILD_OF_MYELOID",
        "path": ["CHILD_OF_MYELOID"],
        "data": [20, 21, 22, 23, 24],
        "cell_line_display_names": [
            "child_myeloid_0",
            "child_myeloid_1",
            "child_myeloid_2",
            "child_myeloid_3",
            "child_myeloid_4",
        ],
    } in data["other_cards"][0]["significant"]
    assert {
        "label": "MYELOID",
        "path": ["MYELOID"],
        "data": [15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        "cell_line_display_names": [
            "AML_0",
            "AML_1",
            "AML_2",
            "AML_3",
            "AML_4",
            "child_myeloid_0",
            "child_myeloid_1",
            "child_myeloid_2",
            "child_myeloid_3",
            "child_myeloid_4",
        ],
    } in data["other_cards"][0]["significant"]

    assert data["other_cards"][0]["insignificant"] == {
        "label": "Other MYELOID",
        "path": ["MYELOID"],
        "data": [15, 16, 17, 18, 19],
        "cell_line_display_names": ["AML_0", "AML_1", "AML_2", "AML_3", "AML_4"],
    }
    assert data["other_cards"][0]["level_0_code"] == "MYELOID"

    selected_subtype_code = "ES"
    data = _get_box_plot_data(
        dataset_name=dataset_name,
        selected_entity_label=selected_entity_label,
        selected_subtype_code=selected_subtype_code,
        tree_type=tree_type,
        entity_type=entity_type,
        max_fdr=nothing_range.max_fdr,
        min_abs_effect_size=nothing_range.min_abs_effect_size,
        min_frac_dep_in=nothing_range.min_frac_dep_in,
    )

    assert data["significant_selection"] == []

    # If you can select a context it should always have something that
    # is insignificant... If nothing is significant just everything gets
    # added to data["insignificant_selection"]
    assert data["insignificant_selection"] == {
        "label": "Other BONE",
        "path": ["BONE"],
        "data": [0, 1, 2, 3, 4, 10, 11, 12, 13, 14, 26, 27, 28, 29, 30],
        "cell_line_display_names": [
            "0es",
            "1es",
            "2es",
            "3es",
            "4es",
            "0os",
            "1os",
            "2os",
            "3os",
            "4os",
            "0insig",
            "1insig",
            "2insig",
            "3insig",
            "4insig",
        ],
    }
    assert {
        "significant": [
            {
                "label": "MYELOID",
                "path": ["MYELOID"],
                "data": [15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
                "cell_line_display_names": [
                    "AML_0",
                    "AML_1",
                    "AML_2",
                    "AML_3",
                    "AML_4",
                    "child_myeloid_0",
                    "child_myeloid_1",
                    "child_myeloid_2",
                    "child_myeloid_3",
                    "child_myeloid_4",
                ],
            }
        ],
        "insignificant": {
            "label": "Other MYELOID",
            "path": ["MYELOID"],
            "data": [15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
            "cell_line_display_names": [
                "AML_0",
                "AML_1",
                "AML_2",
                "AML_3",
                "AML_4",
                "child_myeloid_0",
                "child_myeloid_1",
                "child_myeloid_2",
                "child_myeloid_3",
                "child_myeloid_4",
            ],
        },
        "level_0_code": "MYELOID",
    } in data["other_cards"]

    assert data["insignificant_heme_data"] == {
        "label": "Other Heme",
        "data": [25],
        "cell_line_display_names": ["LYMPH_1"],
        "path": None,
    }

    assert data["insignificant_solid_data"] == {
        "label": "Other Solid",
        "data": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 26, 27, 28, 29, 30,],
        "cell_line_display_names": [
            "0es",
            "1es",
            "2es",
            "3es",
            "4es",
            "lung_line_0",
            "lung_line_1",
            "lung_line_2",
            "lung_line_3",
            "lung_line_4",
            "0os",
            "1os",
            "2os",
            "3os",
            "4os",
            "0insig",
            "1insig",
            "2insig",
            "3insig",
            "4insig",
        ],
        "path": None,
    }


def test_get_compound_experiment_id_from_entity_label():
    entity_full_label = "CC-90011 (BENZENESULFONATE) (BRD:BRD-K00091110-074-01-9)"
    compound_experiment_id = _get_compound_experiment_id_from_entity_label(
        entity_full_label
    )
    assert compound_experiment_id == "BRD:BRD-K00091110-074-01-9"

    entity_full_label = "CCT196969 (BRD:BRD-K00005244-001-01-9)"
    compound_experiment_id = _get_compound_experiment_id_from_entity_label(
        entity_full_label
    )
    assert compound_experiment_id == "BRD:BRD-K00005244-001-01-9"
