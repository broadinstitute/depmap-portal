from depmap.cell_line.models_new import DepmapModel
from depmap.context.models_new import SubtypeNode
from depmap.context_explorer.models import ContextAnalysis
import pytest
from numpy import NaN
import pandas as pd

from depmap.entity.views.executive import (
    format_enrichments_for_svg,
    remove_svg_height_width,
    format_generic_distribution_plot,
    format_enrichment_box_for_dataset,
    format_overall_top_model,
    format_top_three_models_top_feature,
    format_predictability_tile,
    sort_by_model_pearson_feature_rank,
    get_percentile,
    split_feature_label,
)
from tests.depmap.utilities.test_svg_utils import assert_is_svg
from tests.utilities import interactive_test_utils
from tests.factories import (
    BiomarkerDatasetFactory,
    CellLineFactory,
    ContextAnalysisFactory,
    DepmapModelFactory,
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    PredictiveFeatureFactory,
    PredictiveModelFactory,
    PredictiveFeatureResultFactory,
    PredictiveBackgroundFactory,
    SubtypeContextFactory,
    SubtypeNodeFactory,
)
from depmap.dataset.models import DependencyDataset


SAMPLE_SVG = """<?xml version="1.0" encoding="utf-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
  "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- Created with matplotlib (http://matplotlib.org/) -->
<svg height="200.17625pt" version="1.1" viewBox="0 0 257.173437 200.17625" width="257.173437pt" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
 <defs>
  <style type="text/css">
*{stroke-linecap:butt;stroke-linejoin:round;}
  </style>
 </defs>
</svg>
"""


def test_remove_svg_height_width():
    svg = remove_svg_height_width(SAMPLE_SVG)
    assert (
        '<svg version="1.1" viewBox="0 0 257.173437 200.17625" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'
        in svg
    )
    assert 'height="200.17625pt"' not in svg


def test_format_generic_distribution_plot():
    svg = format_generic_distribution_plot([1, 2, 3], "#ffffff")
    assert_is_svg(svg)


def test_format_enrichment_box_for_dataset(empty_db_mock_downloads):
    entity = GeneFactory()
    dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(entities=[entity], cell_lines=[CellLineFactory()])
    )
    empty_db_mock_downloads.session.flush()

    enrichment_box = format_enrichment_box_for_dataset(
        entity, dataset, "test_color", "test_override"
    )

    assert enrichment_box.keys() == {
        "context_explorer_dataset_tab",
        "most_selective_code",
        "svg",
        "labels",
        "units",
        "color",
        "title_color",
    }
    assert enrichment_box["context_explorer_dataset_tab"] == "overview"
    assert enrichment_box["most_selective_code"] == ""

    assert_is_svg(enrichment_box["svg"])
    assert "labels" in enrichment_box
    assert enrichment_box["units"] == dataset.matrix.units
    assert enrichment_box["color"] == "test_color"
    assert enrichment_box["title_color"] == "test_override"


def test_format_enrichments_for_svg(empty_db_mock_downloads):
    subtype_nodeA = SubtypeNodeFactory(
        subtype_code="context_A",
        node_name="Context A",
        node_level=0,
        level_0="context_A",
    )
    subtype_nodeB = SubtypeNodeFactory(
        subtype_code="context_B",
        node_name="Context B",
        node_level=0,
        level_0="context_B",
    )
    subtype_nodeC = SubtypeNodeFactory(
        subtype_code="context_C",
        node_name="Context C",
        node_level=0,
        level_0="context_C",
    )

    enriched_contexts = pd.DataFrame(
        {
            "q_value": [1e-5, 1e-5, 1e-5],
            "effect_size": [0.5, 0.5, 0.5],
            "cell_line": [
                ["cell_line_A1", "cell_line_AB2"],
                ["cell_line_AB2", "cell_line_B3", "cell_line_NaN"],
                ["cell_line_C4"],
            ],
        },
        index=["context_A", "context_B", "context_C"],
        columns=["cell_line", "q_value", "effect_size"],
    )

    all_values_series = pd.Series(
        [
            11,
            122,
            23,
            44,
            NaN,
        ],  # for easy verification A=1, B=2, etc converting to digits
        index=[
            "cell_line_A1",
            "cell_line_AB2",
            "cell_line_B3",
            "cell_line_C4",
            "cell_line_NaN",
        ],
    )

    expected_enriched_text_labels = [
        "Context A (context_A) (1.00e-05) n=2",
        "Context B (context_B) (1.00e-05) n=2",
        "Context C (context_C) (1.00e-05) n=1",
    ]
    expected_enriched_values = [[11, 122], [122, 23], [44]]
    expected_svg_all_box_positions = [4, 3, 2, 1]
    expected_svg_all_box_numeric_labels = ["All", 1, 2, 3]

    (
        enriched_text_labels,
        enriched_values,
        svg_all_box_positions,
        svg_all_box_numeric_labels,
    ) = format_enrichments_for_svg(enriched_contexts, all_values_series)

    assert expected_enriched_text_labels == enriched_text_labels
    assert expected_enriched_values == enriched_values
    assert expected_svg_all_box_positions == list(svg_all_box_positions)
    assert expected_svg_all_box_numeric_labels == list(svg_all_box_numeric_labels)


def test_get_percentile():
    background = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    test_value = 0.31
    assert get_percentile(test_value, background) == 30


def test_sort_by_model_pearson_feature_rank():
    df = pd.DataFrame(
        {
            "model_pearson": [
                10,
                10,
                10,
                10,  # model 1
                30,
                30,
                30,
                30,  # model 3
                20,
                20,
                20,
                20,  # model 2
            ],
            "feature_rank": [
                2,
                3,
                0,
                1,  # model 1
                2,
                3,
                0,
                1,  # model 3
                2,
                3,
                0,
                1,  # model 2
            ],
        }
    )

    expected_df = pd.DataFrame(
        {
            "model_pearson": [
                30,
                30,
                30,
                30,  # model 3
                20,
                20,
                20,
                20,  # model 2
                10,
                10,
                10,
                10,  # model 1
            ],
            "feature_rank": [
                0,
                1,
                2,
                3,  # model 3
                0,
                1,
                2,
                3,  # model 2
                0,
                1,
                2,
                3,  # model 1
            ],
        }
    )

    # reset index because the first will have it's index reordered
    assert (
        sort_by_model_pearson_feature_rank(df)
        .reset_index(drop=True)
        .equals(expected_df)
    )


def test_format_overall_top_model():
    sorted_df = pd.DataFrame(
        {
            "predictive_model_id": [
                "top id",
                "top id",
                "top id",
                "top id",
                "top id",
                "top id",
                "top id",  # 7 of these
                "second id",  # should not appear since ordered second
            ],
            "model_label": [
                "top label",
                "top label",
                "top label",
                "top label",
                "top label",
                "top label",
                "top label",  # top model
                "second label",
            ],
            "feature_name": [
                "name_0",
                "name_1",
                "name_2",
                "name_3",
                "name_4",
                "name_5",
                "name_6",  # top model
                "wrong id",
            ],
            "feature_type": [
                "type_0",
                "type_1",
                "type_2",
                "type_3",
                "type_4",
                "type_5",
                "type_6",  # top model
                "wrong type",
            ],
            "feature_importance": [
                0.01,
                0.1,
                0.2,
                0.3,
                0.4,
                0.5,
                0.6,  # top model
                0.01,
            ],
            "type": [
                "crispr",
                "crispr",
                "crispr",
                "crispr",
                "crispr",
                "crispr",
                "crispr",  # top model
                "rnai",
            ],
            "interactive_url": None,
            "correlation": None,
            "related_type": None,
        }
    )

    expected = {
        "type": "crispr",
        "features": [
            {
                "name": "name_0",
                "type": "type_0",
                "importance": 0.01,
                "interactive_url": None,
                "correlation": None,
                "related_type": None,
            },  # only has the top 5
            {
                "name": "name_1",
                "type": "type_1",
                "importance": 0.1,
                "interactive_url": None,
                "correlation": None,
                "related_type": None,
            },
            {
                "name": "name_2",
                "type": "type_2",
                "importance": 0.2,
                "interactive_url": None,
                "correlation": None,
                "related_type": None,
            },
            {
                "name": "name_3",
                "type": "type_3",
                "importance": 0.3,
                "interactive_url": None,
                "correlation": None,
                "related_type": None,
            },
            {
                "name": "name_4",
                "type": "type_4",
                "importance": 0.4,
                "interactive_url": None,
                "correlation": None,
                "related_type": None,
            },
        ],
    }

    assert format_overall_top_model(sorted_df) == expected


def test_format_top_three_models_top_feature():
    sorted_df = pd.DataFrame(
        {
            "model_label": [
                "higher pearson but wrong type",  # wrong type
                "first label",
                "first label",  # first model
                "second label",
                "second label",  # second model
                "third label",
                "third label",  # third model
                "fourth label",  # not top 3
            ],
            "model_pearson": [
                0.9,  # highest but wrong type
                0.8,
                0.8,  # first model
                0.7,
                0.7,  # second model
                0.6,
                0.6,  # third model
                0.5,  # not top 3
            ],
            "feature_name": [
                "wrong type id",  # wrong type
                "name_0",
                "name_1",  # first model
                "name_0",
                "name_1",  # second model
                "name_0",
                "name_1",  # third model
                "wrong id",  # not top 3
            ],
            "feature_type": [
                "wrong type type",  # wrong type
                "type_0",
                "type_1",  # first model
                "type_0",
                "type_1",  # second model
                "type_0",
                "type_1",  # third model
                "wrong type",  # not top 3
            ],
            "feature_rank": [
                0,  # wrong type
                0,
                1,  # first model
                0,
                1,  # second model
                0,
                1,  # third model
                0,  # not top 3
            ],
            "type": [
                "bad type",  # wrong type
                "crispr",
                "crispr",  # first model
                "crispr",
                "crispr",  # second model
                "crispr",
                "crispr",  # third model
                "crispr",  # not top 3
            ],
        }
    )

    expected = [
        {
            "model_label": "first label",
            "feature_name": "name_0",
            "feature_type": "type_0",
            "model_pearson": "0.8",
        },
        {
            "model_label": "second label",
            "feature_name": "name_0",
            "feature_type": "type_0",
            "model_pearson": "0.7",
        },
        {
            "model_label": "third label",
            "feature_name": "name_0",
            "feature_type": "type_0",
            "model_pearson": "0.6",
        },
    ]

    assert format_top_three_models_top_feature(sorted_df, "crispr") == expected


def test_format_dataset_predictability(empty_db_mock_downloads):
    """
    Mostly concerned with
        The combination (concatenation) of the two datasets, to get the one with the higher pearson
        I.e. mostly concerned with the if/else etc. that test crispr_dataset and rnai_dataset
        First-level keys are correct
    Test three secnarios where both, or only one dataset is present

    Correct sorting, retrieval given a sorted dataset, and sub-level formatting are tested in other functions
    """
    query_gene = GeneFactory()
    feature_gene = GeneFactory()
    biomarker_matrix = MatrixFactory(entities=[feature_gene])
    biomarker_dataset = BiomarkerDatasetFactory(matrix=biomarker_matrix)

    matrix_1 = MatrixFactory(entities=[query_gene])
    dataset_1 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana, matrix=matrix_1
    )
    dataset_1_model = PredictiveModelFactory(
        dataset=dataset_1, entity=query_gene, pearson=10, label="model_1"
    )
    feature_1 = PredictiveFeatureFactory(
        feature_id="feature_1_label",
        feature_name=feature_gene.label,
        dataset_id=biomarker_dataset.name.name,
    )
    PredictiveFeatureResultFactory(
        predictive_model=dataset_1_model, rank=0, importance=0.5, feature=feature_1
    )
    PredictiveBackgroundFactory(dataset=dataset_1)

    # this has a higher model pearson
    matrix_2 = MatrixFactory(entities=[query_gene])
    dataset_2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.RNAi_merged, matrix=matrix_2
    )
    dataset_2_model = PredictiveModelFactory(
        dataset=dataset_2, entity=query_gene, pearson=20, label="model_2"
    )
    feature_2 = PredictiveFeatureFactory(
        feature_id="feature_2_label",
        feature_name=feature_gene.label,
        dataset_id=biomarker_dataset.name.name,
    )
    PredictiveFeatureResultFactory(
        predictive_model=dataset_2_model, rank=0, importance=0.5, feature=feature_2
    )
    PredictiveBackgroundFactory(dataset=dataset_2)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # both present
    pred = format_predictability_tile(query_gene, [dataset_1, dataset_2])

    assert pred.keys() == {"overall_top_model", "plot", "tables"}
    assert (
        pred["overall_top_model"]["features"][0]["name"] == feature_gene.label
    )  # model 2 has higher pearson
    assert pred["overall_top_model"]["features"][0]["type"] == "Expression"

    assert set(pred["plot"].keys()) == {"svg", "percentiles"}
    assert set(pred["plot"]["percentiles"][0].keys()) == {
        "percentile",
        "dataset_display_name",
        "type",
    }
    assert set(pred["plot"]["percentiles"][1].keys()) == {
        "percentile",
        "dataset_display_name",
        "type",
    }
    assert_is_svg(pred["plot"]["svg"])

    assert len(pred["tables"]) == 2
    assert set(pred["tables"][0].keys()) == {"dataset", "top_models", "type"}
    assert isinstance(pred["tables"][0]["top_models"], list)

    # only dataset 1
    pred = format_predictability_tile(query_gene, [dataset_1])
    assert len(pred["tables"]) == 1
    assert (
        pred["overall_top_model"]["features"][0]["name"] == feature_gene.label
    )  # only one model
    assert pred["overall_top_model"]["features"][0]["type"] == "Expression"

    # only dataset 2
    pred = format_predictability_tile(query_gene, [dataset_2])
    assert len(pred["tables"]) == 1
    assert (
        pred["overall_top_model"]["features"][0]["name"] == feature_gene.label
    )  # only one model
    assert pred["overall_top_model"]["features"][0]["type"] == "Expression"


@pytest.mark.parametrize(
    "label, name, type",
    [
        ("SOX10 (6663)_RNAseq", "SOX10", "RNAseq"),
        ("BRAF (B-Raf_Caution)_RPPA", "BRAF (B-Raf Caution)", "RPPA"),
        ("SSMD_Confounders", "SSMD", "Confounders"),
        ("skin_histology_I_Lin", "skin histology I", "Lin"),
        (
            "malignant_melanoma_histology_II_Lin",
            "malignant melanoma histology II",
            "Lin",
        ),
    ],
)
def test_split_feature_label(label, name, type):
    assert split_feature_label(label) == (name, type)
