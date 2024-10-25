from dataclasses import dataclass
from depmap.cell_line.models_new import DepmapModel
from depmap.context_explorer.api import (
    _get_analysis_data_table,
    _get_compound_experiment_id_from_entity_label,
)
import pytest
from typing import List, Literal, Optional
from depmap.context_explorer.utils import (
    get_box_plot_data_for_primary_disease,
    get_box_plot_data_for_selected_lineage,
    get_full_row_of_values_and_depmap_ids,
    get_other_context_dependencies,
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
)
from tests.utilities import interactive_test_utils
import re


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


def _setup_factories(
    empty_db_mock_downloads,
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

    ContextAnalysisFactory(
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
        context=lung_context,
        context_name="Lung",
        out_group="All",
        entity=gene_a if use_genes else compound_a,
        t_pval=1.0,
        mean_in=6,
        mean_out=0.5,
        t_qval=narrow_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in,
    )

    # Uses a wide filter, so filtered out if only_narrow_range
    ContextAnalysisFactory(
        context=os_context,
        context_name="Osteosarcoma",
        out_group="All",
        entity=gene_a if use_genes else compound_a,
        t_qval=wide_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in,
    )
    ContextAnalysisFactory(
        context=es_context,
        context_name="Ewing Sarcoma",
        out_group="Lineage",
        entity=gene_a if use_genes else compound_a,
        t_pval=3.0,
        mean_in=0.1,
        mean_out=8,
        t_qval=narrow_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in,
    )
    ContextAnalysisFactory(
        context=myeloid_context,
        context_name="Myeloid",
        out_group="All",
        entity=gene_a if use_genes else compound_a,
        t_qval=wide_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=narrow_filters.frac_dep_in,
    )
    ContextAnalysisFactory(
        context=aml_context,
        context_name="Acute Myeloid Leukemia",
        out_group="All",
        entity=gene_a if use_genes else compound_a,
        t_qval=narrow_filters.t_qval,
        effect_size=narrow_filters.effect_size,
        frac_dep_in=wide_filters.frac_dep_in,
    )

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
        name=DependencyDataset.DependencyEnum.Chronos_Combined
        if use_genes
        else DependencyDataset.DependencyEnum.Rep_all_single_pt,
        matrix=matrix,
        priority=1,
    )

    empty_db_mock_downloads.session.flush()


def _setup_entities_and_dataset_id(empty_db_mock_downloads, entity_type):
    gene_a = GeneFactory()
    gene_b = GeneFactory()

    compound_a = CompoundExperimentFactory()
    compound_b = CompoundExperimentFactory()

    dataset_id = (
        DependencyDataset.DependencyEnum.Chronos_Combined.name
        if entity_type == "gene"
        else DependencyDataset.DependencyEnum.Rep_all_single_pt.name
    )

    _setup_factories(
        empty_db_mock_downloads=empty_db_mock_downloads,
        gene_a=gene_a,
        gene_b=gene_b,
        compound_a=compound_a,
        compound_b=compound_b,
        entity_type=entity_type,
    )

    return gene_a, gene_b, compound_a, compound_b, dataset_id


@pytest.mark.parametrize(
    "entity_type", ["gene", "compound"],
)
def test_get_anaysis_data(empty_db_mock_downloads, entity_type):
    use_genes = entity_type == "gene"

    (
        gene_a,
        gene_b,
        compound_a,
        compound_b,
        dataset_id,
    ) = _setup_entities_and_dataset_id(empty_db_mock_downloads, entity_type)

    ew_vs_all = _get_analysis_data_table(
        in_group="Ewing Sarcoma", out_group_type="All", entity_type=entity_type
    )

    # Make sure the expected columns are present.
    assert list(ew_vs_all.keys()) == [
        "entity",
        "t_pval",
        "mean_in",
        "mean_out",
        "effect_size",
        "abs_effect_size",
        "t_qval",
        "t_qval_log",
        "OR",
        "n_dep_in",
        "n_dep_out",
        "frac_dep_in",
        "frac_dep_out",
        "log_OR",
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
        in_group="Ewing Sarcoma", out_group_type="Lineage", entity_type=entity_type
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
        in_group="Ewing Sarcoma", out_group_type="Type", entity_type=entity_type
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
        in_group="Skin", out_group_type="All", entity_type=entity_type
    )

    assert empty_data == None

    all_in_group = _get_analysis_data_table(
        in_group="All", out_group_type="All", entity_type=entity_type
    )

    assert all_in_group == None


@pytest.mark.parametrize(
    "entity_type", ["gene", "compound"],
)
def test_get_drug_dotted_line(empty_db_mock_downloads, entity_type):
    use_genes = entity_type == "gene"

    (
        gene_a,
        gene_b,
        compound_a,
        compound_b,
        dataset_id,
    ) = _setup_entities_and_dataset_id(empty_db_mock_downloads, entity_type)

    interactive_test_utils.reload_interactive_config()

    selected_entity_id = gene_a.entity_id if use_genes else compound_a.entity_id

    (entity_full_row_of_values) = get_full_row_of_values_and_depmap_ids(
        dataset_id=dataset_id, entity_id=selected_entity_id
    )
    entity_full_row_of_values.dropna(inplace=True)

    drug_dotted_line = (
        entity_full_row_of_values.mean() if entity_type == "compound" else None
    )

    assert drug_dotted_line == None if use_genes else 7.0


def _get_box_plot_data(
    dataset_id: str, selected_entity_id: int, selected_context: str, top_context: str
):
    lineage_depmap_ids_names_dict = DepmapModel.get_model_ids_by_lineage_and_level(
        top_context
    )

    entity_full_row_of_values = get_full_row_of_values_and_depmap_ids(
        dataset_id=dataset_id, entity_id=selected_entity_id
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
    "entity_type", ["gene", "compound"],
)
def test_get_box_plot_data(empty_db_mock_downloads, entity_type):
    use_genes = entity_type == "gene"

    (
        gene_a,
        gene_b,
        compound_a,
        compound_b,
        dataset_id,
    ) = _setup_entities_and_dataset_id(empty_db_mock_downloads, entity_type)

    interactive_test_utils.reload_interactive_config()

    selected_entity_id = gene_a.entity_id if use_genes else compound_a.entity_id

    # 1. Test selected context is a lineage.
    selected_context = "Bone"
    top_context = "Bone"
    box_plot_data = _get_box_plot_data(
        dataset_id=dataset_id,
        selected_entity_id=selected_entity_id,
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
        dataset_id=dataset_id,
        selected_entity_id=selected_entity_id,
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
    "entity_type", ["gene", "compound"],
)
def test_get_other_context_dependencies(empty_db_mock_downloads, entity_type):
    use_genes = entity_type == "gene"

    (
        gene_a,
        gene_b,
        compound_a,
        compound_b,
        dataset_id,
    ) = _setup_entities_and_dataset_id(empty_db_mock_downloads, entity_type)

    interactive_test_utils.reload_interactive_config()

    selected_entity_id = gene_a.entity_id if use_genes else compound_a.entity_id

    other_deps = get_other_context_dependencies(
        dataset_id=dataset_id,
        in_group="Ewing Sarcoma",
        out_group_type="All",
        entity_type=entity_type,
        entity_id=selected_entity_id,
        fdr=all_range.fdr,
        abs_effect_size=all_range.abs_effect_size,
        frac_dep_in=all_range.frac_dep_in,
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
        dataset_id=dataset_id,
        in_group="Ewing Sarcoma",
        out_group_type="All",
        entity_type=entity_type,
        entity_id=selected_entity_id,
        fdr=only_narrow_range.fdr,
        abs_effect_size=only_narrow_range.abs_effect_size,
        frac_dep_in=only_narrow_range.frac_dep_in,
    )

    assert other_deps == [lung_result]

    # 3. Filter out everything so that nothing is returned.
    other_deps = get_other_context_dependencies(
        dataset_id=dataset_id,
        in_group="Ewing Sarcoma",
        out_group_type="All",
        entity_type=entity_type,
        entity_id=selected_entity_id,
        fdr=nothing_range.fdr,
        abs_effect_size=nothing_range.abs_effect_size,
        frac_dep_in=nothing_range.frac_dep_in,
    )

    assert other_deps == []

    # 4. Test with an outgroup type other than "All"
    other_deps = get_other_context_dependencies(
        dataset_id=dataset_id,
        in_group="Osteosarcoma",
        out_group_type="Lineage",
        entity_type=entity_type,
        entity_id=selected_entity_id,
        fdr=all_range.fdr,
        abs_effect_size=all_range.abs_effect_size,
        frac_dep_in=all_range.frac_dep_in,
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
