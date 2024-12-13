from depmap.cell_line.models_new import LineageType
from depmap.context_explorer.utils import _get_lineage_type_from_top_context
from flask import url_for
import numpy as np
import pytest


def test_get_context_info(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(
            url_for("api.context_explorer_context_info", level_0_subtype_code="BONE",),
            content_type="application/json",
        )
        context_info = r.json
        trees = context_info["tree"]

        assert len(list(trees.keys())) > 0

        overview_table_data = context_info["table_data"]

        # Make sure all expected columns are present in the Overview Table
        assert list(overview_table_data[0].keys()) == [
            "model_id",
            "subtype_code",
            "level_0",
            "level_1",
            "level_2",
            "level_3",
            "level_4",
            "level_5",
            "node_name",
            "node_level",
            "prism",
            "rna_seq",
            "wgs",
            "wes",
            "rnai",
            "crispr",
            "cell_line_display_name",
        ]

        for row in overview_table_data:
            for value in row.values():
                if isinstance(value, float):
                    assert not np.isnan(value)

        # Make sure everything that loads into the trees actually have data (depmap_ids list greater than 0)
        for tree_key in list(trees.keys()):
            tree = trees[str(tree_key)]
            assert len(tree["root"]["model_ids"]) > 0

            if len(tree["children"]) > 0:
                for child in tree["children"]:
                    assert len(child["model_ids"]) > 0


def test_get_context_search_options(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(
            url_for("api.context_explorer_context_search_options"),
            content_type="application/json",
        )
        search_options = r.json

        assert search_options == {
            "lineage": [
                {"name": "Bone", "subtype_code": "BONE", "node_level": 0},
                {"name": "Lung", "subtype_code": "LUNG", "node_level": 0},
                {"name": "Lymphoid", "subtype_code": "LYMPH", "node_level": 0},
                {"name": "Myeloid", "subtype_code": "MYELOID", "node_level": 0},
            ],
            "molecularSubtype": [
                {"name": "ALK Hotspot", "subtype_code": "ALKHotspot", "node_level": 0},
                {"name": "EGFR", "subtype_code": "EGFR", "node_level": 0},
            ],
        }


def test_get_context_summary(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(
            url_for("api.context_explorer_context_summary",),
            content_type="application/json",
        )
        context_summary = r.json

        # The data type list determines the number and order of rows on
        # the Context Explorer Data Availability graph.
        assert context_summary["data_types"] == [
            "PRISM",
            "RNASeq",
            "WGS",
            "WES",
            "RNAi",
            "CRISPR",
        ]

        # There should be a value row for each data type.
        assert len(context_summary["values"]) == len(context_summary["data_types"])

        for row in context_summary["values"]:
            # Every row of values should consist of an integer for each potentially available cell line.
            assert len(row) == len(context_summary["all_depmap_ids"])


def test_unknown_context_analysis_data(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(
            url_for(
                "api.context_explorer_analysis_data",
                in_group="unknown",
                out_group_type="All",
                entity_type="gene",
                dataset_name="Chronos_Combined",
            ),
            content_type="application/json",
        )

        assert r.json == None


def test_get_context_path(populated_db):
    with populated_db.app.test_client() as c:
        # Test to level 0
        r = c.get(
            url_for("api.context_explorer_context_path", selected_code="BONE",),
            content_type="application/json",
        )

        assert r.json == ["BONE"]

        # Test to level 1
        r = c.get(
            url_for("api.context_explorer_context_path", selected_code="ES",),
            content_type="application/json",
        )

        assert r.json == ["BONE", "ES"]

        # Test to level 2
        r = c.get(
            url_for("api.context_explorer_context_path", selected_code="GB"),
            content_type="application/json",
        )
        assert r.json == ["BRAIN", "DIFG", "GB"]

        # Something is very wrong if we pass a nonsense code to this endpoint
        with pytest.raises(Exception):
            r = c.get(
                url_for("api.context_explorer_context_path", selected_code="NONSENSE",),
                content_type="application/json",
            )


def test_get_lineage_type_from_top_context():
    # Make sure all cases return the correct result
    top_context = "myeloid"

    lineage_type = _get_lineage_type_from_top_context(top_context)
    assert lineage_type == LineageType.Heme

    top_context = "Myeloid"

    lineage_type = _get_lineage_type_from_top_context(top_context)
    assert lineage_type == LineageType.Heme

    top_context = "MYELOID"

    lineage_type = _get_lineage_type_from_top_context(top_context)
    assert lineage_type == LineageType.Heme

    top_context = "solid"

    lineage_type = _get_lineage_type_from_top_context(top_context)
    assert lineage_type == LineageType.Solid

    top_context = "Solid"

    lineage_type = _get_lineage_type_from_top_context(top_context)
    assert lineage_type == LineageType.Solid


def test_get_context_dose_curves_invalid_request_arguments(populated_db):
    with populated_db.app.test_client() as c:
        with pytest.raises(AssertionError):
            r = c.get(
                url_for(
                    "api.context_explorer_context_dose_curves",
                    dataset_name="Chronos_Combined",
                    entity_full_label="BRD:PRC-003330600-058-29",
                    context_name="bone",
                    level="1",
                    out_group_type="All Others",
                ),
                content_type="application/json",
            )
