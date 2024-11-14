from dataclasses import dataclass
from re import X
from depmap.cell_line.models_new import DepmapModel
from depmap.context_explorer.api import _get_analysis_data_table
import pytest
from typing import List, Literal, Optional
from depmap.context_explorer.utils import (
    get_box_plot_data_for_primary_disease,
    get_box_plot_data_for_selected_lineage,
    get_full_row_of_values_and_depmap_ids,
    get_other_context_dependencies,
    get_context_dose_curves,
    _get_compound_experiment_id_from_entity_label,
)
from depmap.dataset.models import DependencyDataset
import numpy as np
from tests.factories import (
    CellLineFactory,
    CompoundExperimentFactory,
    ContextAnalysisFactory,
    ContextFactory,
    DependencyDatasetFactory,
    DepmapModelFactory,
    GeneFactory,
    LineageFactory,
    MatrixFactory,
    PrimaryDiseaseFactory,
    DoseResponseCurveFactory,
    CompoundDoseReplicateFactory,
)
from tests.utilities import interactive_test_utils
import pandas as pd


# Filter ranges to be used as params for get_other_context_dependencies.
@dataclass
class FilterRanges:
    fdr: List[float]
    abs_effect_size: List[float]
    frac_dep_in: List[float]


# Will only capture ContextAnalysis objects made with narrow_filters.
only_narrow_range = FilterRanges(
    fdr=[0.002, 0.2], abs_effect_size=[0.028, 0.1], frac_dep_in=[0, 0.1]
)

# Will capture narrow_filters and wide_filters.
all_range = FilterRanges(
    fdr=[0.002, 10], abs_effect_size=[0.02, 10], frac_dep_in=[0, 10]
)

# Will filter out all ContextAnalysis objects so that nothing is returned.
nothing_range = FilterRanges(
    fdr=[0.002, 0.0021], abs_effect_size=[0.02, 0.021], frac_dep_in=[0, 0.0001]
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
wide_filters = OtherContextFilterVals(t_qval=8.5, effect_size=8.5, frac_dep_in=8.5)


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

    es_primary_disease = PrimaryDiseaseFactory(name="Ewing Sarcoma")
    os_primary_disease = PrimaryDiseaseFactory(name="Osteosarcoma")
    myeloid_primary_disease = PrimaryDiseaseFactory(name="Acute Myeloid Leukemia")

    bone_es_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}es",
            stripped_cell_line_name=f"{num}es",
            # cell_line needs to be explicitly defined to properly generate the lineages
            cell_line=CellLineFactory(
                depmap_id=f"ACH-{num}es",
                lineage=[
                    LineageFactory(level=1, name="Bone"),
                    LineageFactory(level=2, name="Ewing Sarcoma"),
                ],
            ),
            oncotree_primary_disease=es_primary_disease.name,
        )
        for num in range(5)
    ]
    bone_os_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}os",
            stripped_cell_line_name=f"{num}os",
            cell_line=CellLineFactory(
                depmap_id=f"ACH-{num}os",
                lineage=[
                    LineageFactory(level=1, name="Bone"),
                    LineageFactory(level=2, name="Osteosarcoma"),
                ],
            ),
            oncotree_primary_disease=os_primary_disease.name,
        )
        for num in range(5)
    ]

    lung_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}lung",
            stripped_cell_line_name=f"lung_line_{num}",
            cell_line=CellLineFactory(
                depmap_id=f"ACH-{num}lung",
                lineage=[LineageFactory(level=1, name="Lung")],
            ),
        )
        for num in range(5)
    ]

    # So we have some Heme cell lines
    myeloid_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}myeloid",
            stripped_cell_line_name=f"myeloid_{num}",
            cell_line=CellLineFactory(
                depmap_id=f"ACH-{num}myeloid",
                lineage=[
                    LineageFactory(level=1, name="Myeloid"),
                    LineageFactory(level=2, name="Acute Myeloid Leukemia"),
                ],
            ),
            oncotree_primary_disease=myeloid_primary_disease.name,
        )
        for num in range(5)
    ]

    lung_context = ContextFactory(name="Lung")
    es_context = ContextFactory(name="Ewing Sarcoma")
    os_context = ContextFactory(name="Osteosarcoma")
    myeloid_context = ContextFactory(name="Myeloid")
    aml_context = ContextFactory(name="Acute Myeloid Leukemia")

    matrix_cell_lines = (
        bone_es_cell_lines
        + lung_cell_lines
        + bone_os_cell_lines
        + myeloid_cell_lines  # all acute myeloid leukemia
    )

    matrix = MatrixFactory(
        entities=[
            gene_a if use_genes else compound_a,
            gene_b if use_genes else compound_b,
        ],
        data=np.array([[num for num in range(20)], [num for num in range(20)]]),
        cell_lines=matrix_cell_lines,
        using_depmap_model_table=True,
    )

    dataset = DependencyDatasetFactory(
        display_name="test display name",
        name=DependencyDataset.DependencyEnum(dataset_name),
        matrix=matrix,
        priority=1,
    )
    dependency_dataset_name = dataset.name

    ContextAnalysisFactory(
        dataset_name=dependency_dataset_name,
        context=es_context,
        context_name="Ewing Sarcoma",
        out_group="All",
        entity=gene_a if use_genes else compound_a,
        t_pval=1.0,
        mean_in=6,
        mean_out=0.5,
        effect_size=-0.05,  # Make sure this results in an abs_effect_size of 0.05
    )

    ContextAnalysisFactory(
        dataset_name=dependency_dataset_name,
        context=es_context,
        context_name="Ewing Sarcoma",
        out_group="Type",
        entity=gene_a if use_genes else compound_a,
        t_pval=1,
        mean_in=2,
        mean_out=3,
        effect_size=4,
    )

    ContextAnalysisFactory(
        dataset_name=dependency_dataset_name,
        context=lung_context,
        context_name="Lung",
        out_group="All",
        entity=gene_a if use_genes else compound_a,
        t_pval=1.0,
        mean_in=6,
        mean_out=0.5,
        t_qval=narrow_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in if use_genes else None,
    )

    # Uses a wide filter, so filtered out if only_narrow_range
    ContextAnalysisFactory(
        dataset_name=dependency_dataset_name,
        context=os_context,
        context_name="Osteosarcoma",
        out_group="All",
        entity=gene_a if use_genes else compound_a,
        t_qval=wide_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in if use_genes else None,
    )
    ContextAnalysisFactory(
        dataset_name=dependency_dataset_name,
        context=es_context,
        context_name="Ewing Sarcoma",
        out_group="Lineage",
        entity=gene_a if use_genes else compound_a,
        t_pval=3.0,
        mean_in=0.1,
        mean_out=8,
        t_qval=narrow_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in if use_genes else None,
    )
    ContextAnalysisFactory(
        dataset_name=dependency_dataset_name,
        context=myeloid_context,
        context_name="Myeloid",
        out_group="All",
        entity=gene_a if use_genes else compound_a,
        t_qval=wide_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in if use_genes else None,
    )
    ContextAnalysisFactory(
        dataset_name=dependency_dataset_name,
        context=aml_context,
        context_name="Acute Myeloid Leukemia",
        out_group="All",
        entity=gene_a if use_genes else compound_a,
        t_qval=narrow_filters.t_qval,
        effect_size=wide_filters.effect_size,
        frac_dep_in=wide_filters.frac_dep_in if use_genes else None,
    )

    if dataset_name == DependencyDataset.DependencyEnum.Prism_oncology_AUC.name:
        _setup_dose_response_curves(
            models=matrix_cell_lines, compound_exps=[compound_a, compound_b]
        )

    empty_db_mock_downloads.session.flush()


def _setup_entities_and_dataset_id(empty_db_mock_downloads, entity_type, dataset_name):
    gene_a = GeneFactory()
    gene_b = GeneFactory()

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
        in_group="Ewing Sarcoma",
        out_group_type="All",
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
        in_group="Ewing Sarcoma",
        out_group_type="Lineage",
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

    ew_vs_type = _get_analysis_data_table(
        in_group="Ewing Sarcoma",
        out_group_type="Type",
        entity_type=entity_type,
        dataset_name=dataset_name,
    )

    assert ew_vs_type["entity"] == [
        f"{gene_a.label} ({gene_a.entrez_id})" if use_genes else compound_a.label
    ]
    assert ew_vs_type["t_pval"] == [1]
    assert ew_vs_type["mean_in"] == [2]
    assert ew_vs_type["mean_out"] == [3]
    assert ew_vs_type["effect_size"] == [4]
    assert ew_vs_type["abs_effect_size"] == [4]
    assert ew_vs_type["depletion"] == ["True"]

    empty_data = _get_analysis_data_table(
        in_group="Skin",
        out_group_type="All",
        entity_type=entity_type,
        dataset_name=dataset_name,
    )

    assert empty_data == None

    all_in_group = _get_analysis_data_table(
        in_group="All",
        out_group_type="All",
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
        context_name="Lung",
        level=1,
        out_group_type="All",
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
    assert dose_curve_info["dose_curve_info"] == {
        "in_group_curve_params": [
            {
                "ec50": 0,
                "id": "ACH-0lung",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-1lung",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-2lung",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-3lung",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-4lung",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
        ],
        "max_dose": 0.3,
        "min_dose": 0.1,
        "out_group_curve_params": [
            {
                "ec50": 0,
                "id": "ACH-0es",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-1es",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-2es",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-3es",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-4es",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-0os",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-1os",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-2os",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-3os",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-4os",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-0myeloid",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-1myeloid",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-2myeloid",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-3myeloid",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
            {
                "ec50": 0,
                "id": "ACH-4myeloid",
                "lowerAsymptote": 0,
                "slope": 0,
                "upperAsymptote": 0,
            },
        ],
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
    dataset_name: str,
    selected_entity_label: int,
    selected_context: str,
    top_context: str,
):
    lineage_depmap_ids_names_dict = DepmapModel.get_model_ids_by_lineage_and_level(
        top_context
    )

    entity_full_row_of_values = get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=selected_entity_label
    )
    entity_full_row_of_values.dropna(inplace=True)
    assert entity_full_row_of_values.values.tolist() == [num for num in range(20)]
    assert entity_full_row_of_values.index.tolist() == [
        "ACH-0es",
        "ACH-1es",
        "ACH-2es",
        "ACH-3es",
        "ACH-4es",
        "ACH-0lung",
        "ACH-1lung",
        "ACH-2lung",
        "ACH-3lung",
        "ACH-4lung",
        "ACH-0os",
        "ACH-1os",
        "ACH-2os",
        "ACH-3os",
        "ACH-4os",
        "ACH-0myeloid",
        "ACH-1myeloid",
        "ACH-2myeloid",
        "ACH-3myeloid",
        "ACH-4myeloid",
    ]

    is_lineage = selected_context == top_context
    if is_lineage:
        box_plot_data = get_box_plot_data_for_selected_lineage(
            top_context=top_context,
            lineage_depmap_ids=list(lineage_depmap_ids_names_dict.keys()),
            entity_full_row_of_values=entity_full_row_of_values,
            lineage_depmap_ids_names_dict=lineage_depmap_ids_names_dict,
        )
    else:
        box_plot_data = get_box_plot_data_for_primary_disease(
            selected_context=selected_context,
            top_context=top_context,
            lineage_depmap_ids=list(lineage_depmap_ids_names_dict.keys()),
            entity_full_row_of_values=entity_full_row_of_values,
            lineage_depmap_ids_names_dict=lineage_depmap_ids_names_dict,
        )

    return box_plot_data


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

    # 1. Test selected context is a lineage.
    selected_context = "Bone"
    top_context = "Bone"
    box_plot_data = _get_box_plot_data(
        dataset_name=dataset_name,
        selected_entity_label=selected_entity_label,
        selected_context=selected_context,
        top_context=top_context,
    )

    assert box_plot_data == [
        {
            "type": "SelectedLineage",
            "data": [0, 1, 2, 3, 4, 10, 11, 12, 13, 14],
            # SelectedLineage is Bone, so these are all Ewing Sarcoma and Osteosarcoma lines.
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
            "type": "SameLineageType",
            "data": [5, 6, 7, 8, 9],
            # lung results show up here because Bone is of LineageType Solid,
            # so SameLineageType is anything that is Solid.
            "cell_line_display_names": [
                "lung_line_0",
                "lung_line_1",
                "lung_line_2",
                "lung_line_3",
                "lung_line_4",
            ],
        },
        {
            "type": "OtherLineageType",
            "data": [15, 16, 17, 18, 19],
            # myeloid results show up here because Bone is of LineageType Solid,
            # so OtherLineageType is anything that is Heme.
            "cell_line_display_names": [
                "myeloid_0",
                "myeloid_1",
                "myeloid_2",
                "myeloid_3",
                "myeloid_4",
            ],
        },
    ]

    # 2. Test selected context is a primary disease.
    selected_context = "Ewing Sarcoma"
    top_context = "Bone"
    box_plot_data = _get_box_plot_data(
        dataset_name=dataset_name,
        selected_entity_label=selected_entity_label,
        selected_context=selected_context,
        top_context=top_context,
    )

    assert box_plot_data == [
        # Ewing Sarcoma
        {
            "type": "SelectedPrimaryDisease",
            "data": [0, 1, 2, 3, 4],
            "cell_line_display_names": ["0es", "1es", "2es", "3es", "4es"],
        },
        # Other Bone
        {
            "type": "SameLineage",
            "data": [10, 11, 12, 13, 14],
            "cell_line_display_names": ["0os", "1os", "2os", "3os", "4os"],
        },
        # Other Solid
        {
            "type": "SameLineageType",
            "data": [5, 6, 7, 8, 9],
            "cell_line_display_names": [
                "lung_line_0",
                "lung_line_1",
                "lung_line_2",
                "lung_line_3",
                "lung_line_4",
            ],
        },
        # Heme
        {
            "type": "OtherLineageType",
            "data": [15, 16, 17, 18, 19],
            "cell_line_display_names": [
                "myeloid_0",
                "myeloid_1",
                "myeloid_2",
                "myeloid_3",
                "myeloid_4",
            ],
        },
    ]


@pytest.mark.parametrize(
    "dataset_name", ["Chronos_Combined", "Rep_all_single_pt", "Prism_oncology_AUC"],
)
def test_get_other_context_dependencies(empty_db_mock_downloads, dataset_name):
    use_genes = dataset_name == DependencyDataset.DependencyEnum.Chronos_Combined.name

    entity_type = "gene" if use_genes else "compound"

    (gene_a, gene_b, compound_a, compound_b,) = _setup_entities_and_dataset_id(
        empty_db_mock_downloads, entity_type, dataset_name=dataset_name
    )

    interactive_test_utils.reload_interactive_config()

    selected_entity_label = gene_a.label if use_genes else compound_a.label
    selected_entity_id = gene_a.entity_id if use_genes else compound_a.entity_id

    full_row_of_values = get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=selected_entity_label
    )

    other_deps = get_other_context_dependencies(
        in_group="Ewing Sarcoma",
        out_group_type="All",
        entity_type=entity_type,
        entity_id=selected_entity_id,
        fdr=all_range.fdr,
        abs_effect_size=all_range.abs_effect_size,
        frac_dep_in=all_range.frac_dep_in,
        full_row_of_values=full_row_of_values,
    )

    # 1. Test with all_range filters to get all possible other_context_dependencies.
    lung_result = {
        "name": "Lung",
        "type": "Other",
        "data": [5, 6, 7, 8, 9],
        "cell_line_display_names": [
            "lung_line_0",
            "lung_line_1",
            "lung_line_2",
            "lung_line_3",
            "lung_line_4",
        ],
    }
    osteosarcoma_result = {
        "name": "Osteosarcoma",
        "type": "Other",
        "data": [10, 11, 12, 13, 14],
        "cell_line_display_names": ["0os", "1os", "2os", "3os", "4os"],
    }
    aml_result = {
        "name": "Acute Myeloid Leukemia",
        "type": "Other",
        "data": [15, 16, 17, 18, 19],
        "cell_line_display_names": [
            "myeloid_0",
            "myeloid_1",
            "myeloid_2",
            "myeloid_3",
            "myeloid_4",
        ],
    }

    myeloid_result = {
        "name": "Myeloid",
        "type": "Other",
        "data": [15, 16, 17, 18, 19],
        "cell_line_display_names": [
            "myeloid_0",
            "myeloid_1",
            "myeloid_2",
            "myeloid_3",
            "myeloid_4",
        ],
    }

    assert (
        osteosarcoma_result in other_deps
        and lung_result in other_deps
        and myeloid_result in other_deps
        and aml_result in other_deps
    )

    # 2. Test with only_narrow_range filter range so that 1 of the above "other context dependencies" is filtered out
    other_deps = get_other_context_dependencies(
        in_group="Ewing Sarcoma",
        out_group_type="All",
        entity_type=entity_type,
        entity_id=selected_entity_id,
        fdr=only_narrow_range.fdr,
        abs_effect_size=only_narrow_range.abs_effect_size,
        frac_dep_in=only_narrow_range.frac_dep_in,
        full_row_of_values=full_row_of_values,
    )

    assert other_deps == [lung_result]

    # 3. Filter out everything so that nothing is returned.
    other_deps = get_other_context_dependencies(
        in_group="Ewing Sarcoma",
        out_group_type="All",
        entity_type=entity_type,
        entity_id=selected_entity_id,
        fdr=nothing_range.fdr,
        abs_effect_size=nothing_range.abs_effect_size,
        frac_dep_in=nothing_range.frac_dep_in,
        full_row_of_values=full_row_of_values,
    )

    assert other_deps == []

    # 4. Test with an outgroup type other than "All"
    other_deps = get_other_context_dependencies(
        in_group="Osteosarcoma",
        out_group_type="Lineage",
        entity_type=entity_type,
        entity_id=selected_entity_id,
        fdr=all_range.fdr,
        abs_effect_size=all_range.abs_effect_size,
        frac_dep_in=all_range.frac_dep_in,
        full_row_of_values=full_row_of_values,
    )

    assert other_deps == [
        {
            "name": "Ewing Sarcoma",
            "type": "Other",
            "data": [0, 1, 2, 3, 4],
            "cell_line_display_names": ["0es", "1es", "2es", "3es", "4es"],
        }
    ]


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
