from depmap import data_access
from depmap.cell_line.models_new import DepmapModel
from depmap.context.models_new import SubtypeNode
from depmap.context_explorer.models import ContextAnalysis
from depmap.data_access.models import MatrixDataset
import pytest
from numpy import NaN
import pandas as pd

from depmap.entity.views.executive import (
    remove_svg_height_width,
    format_generic_distribution_plot,
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


def test_format_generic_distribution_plot_with_single_value():
    svg = format_generic_distribution_plot([1.0, 1.0, 1.0, 1.0], "#ffffff")
    assert "All values are 1.0" in svg


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
