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
        tree = context_info["tree"]

        assert len(list(tree.keys())) > 0

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

        assert tree["node_level"] == 0
        assert tree["subtype_code"] == "BONE"
        assert len(tree["model_ids"]) > 0

        if len(tree["children"]) > 0:
            for child in tree["children"]:
                assert child["node_level"] > 0
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
            url_for("api.context_explorer_context_summary", tree_type="Lineage"),
            content_type="application/json",
        )
        context_summary = r.json

        # The data type list determines the number and order of rows on
        # the Context Explorer Data Availability graph.
        assert context_summary["summary"]["data_types"] == [
            "PRISM",
            "RNASeq",
            "WGS",
            "WES",
            "RNAi",
            "CRISPR",
        ]

        # There should be a value row for each data type.
        assert len(context_summary["summary"]["values"]) == len(
            context_summary["summary"]["data_types"]
        )

        for row in context_summary["summary"]["values"]:
            # Every row of values should consist of an integer for each potentially available cell line.
            assert len(row) == len(context_summary["summary"]["all_depmap_ids"])

        assert context_summary["table"] == [
            {
                "model_id": "ACH-000014",
                "subtype_code": "LYMPH",
                "level_0": "LYMPH",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Lymphoid",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": False,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "HS294T",
            },
            {
                "model_id": "ACH-000052",
                "subtype_code": "ES",
                "level_0": "BONE",
                "level_1": "ES",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Ewing Sarcoma",
                "node_level": 1,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "A673",
            },
            {
                "model_id": "ACH-000210",
                "subtype_code": "ES",
                "level_0": "BONE",
                "level_1": "ES",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Ewing Sarcoma",
                "node_level": 1,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": False,
                "cell_line_display_name": "CADOES1",
            },
            {
                "model_id": "ACH-000279",
                "subtype_code": "ES",
                "level_0": "BONE",
                "level_1": "ES",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Ewing Sarcoma",
                "node_level": 1,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "EWS502",
            },
            {
                "model_id": "ACH-000458",
                "subtype_code": "LYMPH",
                "level_0": "LYMPH",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Lymphoid",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "CJM",
            },
            {
                "model_id": "ACH-000552",
                "subtype_code": "LYMPH",
                "level_0": "LYMPH",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Lymphoid",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": True,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "HT29",
            },
            {
                "model_id": "ACH-000580",
                "subtype_code": "LYMPH",
                "level_0": "LYMPH",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Lymphoid",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "C32",
            },
            {
                "model_id": "ACH-000585",
                "subtype_code": "LUSC",
                "level_0": "LUNG",
                "level_1": "NSCLC",
                "level_2": "LUSC",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Lung Squamous Cell Carcinoma",
                "node_level": 2,
                "prism": False,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "EPLC272H",
            },
            {
                "model_id": "ACH-000706",
                "subtype_code": "LUAD",
                "level_0": "LUNG",
                "level_1": "NSCLC",
                "level_2": "LUAD",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Lung Adenocarcinoma",
                "node_level": 2,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "EKVX",
            },
            {
                "model_id": "ACH-000788",
                "subtype_code": "LYMPH",
                "level_0": "LYMPH",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Lymphoid",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": True,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "A2058",
            },
            {
                "model_id": "ACH-000805",
                "subtype_code": "LYMPH",
                "level_0": "LYMPH",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Lymphoid",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "COLO679",
            },
            {
                "model_id": "ACH-001001",
                "subtype_code": "OS",
                "level_0": "BONE",
                "level_1": "OS",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Osteosarcoma",
                "node_level": 1,
                "prism": True,
                "rna_seq": True,
                "wgs": True,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "143B",
            },
            {
                "model_id": "ACH-001170",
                "subtype_code": "LYMPH",
                "level_0": "LYMPH",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Lymphoid",
                "node_level": 0,
                "prism": False,
                "rna_seq": False,
                "wgs": False,
                "wes": False,
                "rnai": True,
                "crispr": False,
                "cell_line_display_name": "PETA",
            },
            {
                "model_id": "ACH-001205",
                "subtype_code": "ES",
                "level_0": "BONE",
                "level_1": "ES",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "Ewing Sarcoma",
                "node_level": 1,
                "prism": True,
                "rna_seq": False,
                "wgs": False,
                "wes": True,
                "rnai": False,
                "crispr": True,
                "cell_line_display_name": "TC32",
            },
        ]

        r = c.get(
            url_for(
                "api.context_explorer_context_summary", tree_type="MolecularSubtype"
            ),
            content_type="application/json",
        )
        context_summary = r.json

        assert context_summary["summary"] == {
            "values": [
                [True, True, False, True, True, True, True, True],
                [True, False, False, True, True, True, True, True],
                [False, False, False, True, False, False, False, True],
                [False, True, False, True, True, True, True, True],
                [True, False, True, True, True, True, True, True],
                [True, True, False, True, True, False, True, True],
            ],
            "data_types": ["PRISM", "RNASeq", "WGS", "WES", "RNAi", "CRISPR"],
            "all_depmap_ids": [
                [0, "ACH-000014"],
                [1, "ACH-001205"],
                [2, "ACH-001170"],
                [3, "ACH-000552"],
                [4, "ACH-000279"],
                [5, "ACH-000210"],
                [6, "ACH-000706"],
                [7, "ACH-001001"],
            ],
        }
        assert context_summary["table"] == [
            {
                "model_id": "ACH-001170",
                "subtype_code": "ALKHotspot",
                "level_0": "ALKHotspot",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "ALK Hotspot",
                "node_level": 0,
                "prism": False,
                "rna_seq": False,
                "wgs": False,
                "wes": False,
                "rnai": True,
                "crispr": False,
                "cell_line_display_name": "PETA",
            },
            {
                "model_id": "ACH-000210",
                "subtype_code": "ALKHotspot",
                "level_0": "ALKHotspot",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "ALK Hotspot",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": False,
                "cell_line_display_name": "CADOES1",
            },
            {
                "model_id": "ACH-000279",
                "subtype_code": "ALKHotspot",
                "level_0": "ALKHotspot",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "ALK Hotspot",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "EWS502",
            },
            {
                "model_id": "ACH-001205",
                "subtype_code": "ALKHotspot",
                "level_0": "ALKHotspot",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "ALK Hotspot",
                "node_level": 0,
                "prism": True,
                "rna_seq": False,
                "wgs": False,
                "wes": True,
                "rnai": False,
                "crispr": True,
                "cell_line_display_name": "TC32",
            },
            {
                "model_id": "ACH-000552",
                "subtype_code": "EGFR",
                "level_0": "EGFR",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "EGFR",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": True,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "HT29",
            },
            {
                "model_id": "ACH-000706",
                "subtype_code": "EGFR",
                "level_0": "EGFR",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "EGFR",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "EKVX",
            },
            {
                "model_id": "ACH-001001",
                "subtype_code": "EGFR",
                "level_0": "EGFR",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "EGFR",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": True,
                "wes": True,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "143B",
            },
            {
                "model_id": "ACH-000014",
                "subtype_code": "EGFR",
                "level_0": "EGFR",
                "level_1": "",
                "level_2": "",
                "level_3": "",
                "level_4": "",
                "level_5": "",
                "node_name": "EGFR",
                "node_level": 0,
                "prism": True,
                "rna_seq": True,
                "wgs": False,
                "wes": False,
                "rnai": True,
                "crispr": True,
                "cell_line_display_name": "HS294T",
            },
        ]


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

        assert r.json == {"path": ["BONE"], "tree_type": "Lineage"}

        # Test to level 1
        r = c.get(
            url_for("api.context_explorer_context_path", selected_code="ES",),
            content_type="application/json",
        )

        assert r.json == {"path": ["BONE", "ES"], "tree_type": "Lineage"}

        # Test to level 2
        r = c.get(
            url_for("api.context_explorer_context_path", selected_code="LUAD",),
            content_type="application/json",
        )

        assert r.json == {"path": ["LUNG", "NSCLC", "LUAD"], "tree_type": "Lineage"}

        # Test level 3 / also test a data driven genetic subtype that's part of the Lineage tree
        r = c.get(
            url_for(
                "api.context_explorer_context_path", selected_code="LUAD:EGFRp.L858R"
            ),
            content_type="application/json",
        )
        assert r.json == {
            "path": ["LUNG", "NSCLC", "LUAD", "LUAD:EGFRp.L858R"],
            "tree_type": "Lineage",
        }

        # Test a branch of the Molecular Subtype Tree
        r = c.get(
            url_for("api.context_explorer_context_path", selected_code="EGFRp.L858R"),
            content_type="application/json",
        )

        assert r.json == {
            "path": ["EGFR", "EGFRp.L858R"],
            "tree_type": "MolecularSubtype",
        }

        # Something is very wrong if we pass a nonsense code to this endpoint
        with pytest.raises(Exception):
            r = c.get(
                url_for("api.context_explorer_context_path", selected_code="NONSENSE",),
                content_type="application/json",
            )


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
